import { z } from "zod";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth";
import { DataContext, type Data } from "./useData";
import { readAccount, transact } from "@/data/database";
import {
  emptyState,
  validate,
  isFromNewerApp,
  RecordValidationError,
  SCHEMA_VERSION,
  recordKinds,
  type LocalState,
  type Payload,
  type RecordDoc,
  type RemoteDoc,
  type Workout,
} from "@/data/model";
import { syncAccount } from "@/data/sync";
import {
  createWorkout,
  startedWorkouts,
  restoreRemovedWorkout,
  WorkoutInProgressError,
} from "@/data/workout-start";
import { supabase, syncClient } from "@/integrations/supabase/client";
import { staleDraftKeys } from "@/lib/drafts";
import { local, storedKeys } from "@/lib/storage";
import { readSyncHealth, recordSyncResult } from "@/lib/sync-health";
import { notifyOtherTabs, onOtherTabChange } from "@/lib/tab-sync";

// Batches a burst of edits (typing a set, checking several sets) into one upload.
const SYNC_DELAY_MS = 1500;
const NEWER_APP_MESSAGE =
  "This was saved by a newer version of Gain Train. Close and reopen the app to update it, then try again.";
const IN_PROGRESS_MESSAGE =
  "Another workout is already in progress. Return to Workout to resume it before restoring this one.";

type Failure = {
  /** Shown when the device write fails for a reason other than validation. */
  storage: string;
  /** Shown for a conflicting running workout; when absent the error is rethrown as is. */
  inProgress?: string;
};

export function DataProvider({ children }: { children: ReactNode }) {
  const { account, user, ready: authReady } = useAuth();
  const [state, setState] = useState(emptyState),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [syncing, setSyncing] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [syncHealth, setSyncHealth] = useState(() => readSyncHealth(account));
  const activeAccount = useRef(account);
  useEffect(() => {
    activeAccount.current = account;
    return () => {
      activeAccount.current = "";
    };
  }, [account]);
  const running = useRef(false),
    rerun = useRef(false),
    syncTimer = useRef<ReturnType<typeof setTimeout>>();
  const reload = useCallback(async () => {
    const s = await readAccount(account);
    if (activeAccount.current === account) setState(s);
  }, [account]);
  useEffect(() => {
    let active = true;
    setReady(false);
    setState(emptyState());
    setError("");
    setSyncHealth(readSyncHealth(account));
    readAccount(account)
      .then((s) => {
        if (!active) return;
        setState(s);
        setReady(true);
        for (const key of staleDraftKeys(storedKeys(), account, s.records))
          local.removeItem(key);
      })
      .catch(() => {
        if (active) {
          setError(
            "Device storage is unavailable. Allow site storage to safely log workouts.",
          );
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [account]);
  const sync = useCallback(async () => {
    clearTimeout(syncTimer.current);
    if (!supabase || !user || account !== user.id || !navigator.onLine) return;
    // A change made during a sync is sent by one more run right after it.
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    setSyncing(true);
    const work = async () => {
      try {
        const {
          data: { session },
        } = await supabase!.auth.getSession();
        if (
          !session ||
          session.user.id !== account ||
          activeAccount.current !== account
        )
          return;
        const client = syncClient(session.access_token);
        await syncAccount(
          account,
          {
            push: async (op) => {
              const { data, error } = await client.rpc("sync_gain_record", {
                p_id: op.id,
                p_kind: op.kind,
                p_payload: op.payload,
                p_deleted: op.deleted,
                p_base_revision: op.baseRevision,
                p_op_id: op.opId,
              });
              if (error) throw error;
              return data as { record: RemoteDoc; conflict?: boolean };
            },
            pull: async (cursor) => {
              const { data, error } = await client
                .from("gain_records")
                .select("id,kind,payload,revision,deleted,change_seq")
                .gt("change_seq", cursor)
                .order("change_seq")
                .limit(200);
              if (error) throw error;
              return data as RemoteDoc[];
            },
          },
          () => {
            void reload();
          },
          () => activeAccount.current === account,
        );
        if (activeAccount.current === account) {
          setError("");
          setSyncHealth(recordSyncResult(account, true));
        }
      } catch {
        if (activeAccount.current === account) {
          setError(
            "Saved on this phone. Sync will retry when the server is available.",
          );
          setSyncHealth(recordSyncResult(account, false));
        }
      } finally {
        running.current = false;
        setSyncing(false);
        if (rerun.current) {
          rerun.current = false;
          void syncRef.current();
        }
      }
    };
    // Only one tab may send this account's queue at a time.
    if (navigator.locks)
      await navigator.locks.request("gain-sync-" + account, work);
    else await work();
  }, [account, user, reload]);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const scheduleSync = useCallback(() => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void syncRef.current(), SYNC_DELAY_MS);
  }, []);
  useEffect(() => () => clearTimeout(syncTimer.current), []);
  useEffect(() => {
    const onOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    const onFocus = () => {
      void reload();
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(() => void sync(), 30000);
    if (ready && authReady) void sync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
    };
  }, [sync, reload, ready, authReady]);
  useEffect(() => onOtherTabChange(() => void reload()), [reload]);

  const actions = useMemo(() => {
    // Every local write: one IndexedDB transaction, then refresh this tab, tell
    // other tabs and queue an upload. Validation messages are shown as they are.
    const commit = async (
      write: () => Promise<LocalState>,
      failure: Failure,
    ) => {
      try {
        const next = await write();
        if (activeAccount.current === account) {
          setState(next);
          setError("");
        }
        notifyOtherTabs();
        scheduleSync();
      } catch (e) {
        if (e instanceof WorkoutInProgressError && !failure.inProgress) throw e;
        const message =
          e instanceof WorkoutInProgressError
            ? failure.inProgress!
            : e instanceof RecordValidationError
              ? e.message
              : failure.storage;
        if (activeAccount.current === account) setError(message);
        throw new Error(message, { cause: e });
      }
    };
    const change = (update: (s: LocalState) => void) =>
      transact(account, update);
    // A new local version supersedes any earlier server rejection.
    const nextVersion = (record: RecordDoc): Partial<RecordDoc> => ({
      localVersion: record.localVersion + 1,
      dirty: true,
      syncError: undefined,
    });

    const deleteRecord: Data["deleteRecord"] = (id) =>
      commit(
        () =>
          change((s) => {
            const saved = s.records[id];
            if (!saved)
              throw new RecordValidationError(
                "Could not find the saved record. Return to your log and try again.",
              );
            if (saved.deleted) return;
            s.records[id] = {
              ...saved,
              ...nextVersion(saved),
              payload: validate(saved.kind, saved.payload),
              deleted: true,
            } as RecordDoc;
          }),
        {
          storage:
            "Could not remove the saved record on this phone. Keep this screen open and try again.",
        },
      );
    const save: Data["save"] = (id, kind, payload, deleted = false) => {
      if (deleted) return deleteRecord(id);
      return commit(
        () => {
          const parsed = validate(kind, payload);
          return change((s) => {
            const old = s.records[id];
            if (old && isFromNewerApp(old.payload))
              throw new RecordValidationError(NEWER_APP_MESSAGE);
            if (kind === "workout" && old?.deleted)
              throw new RecordValidationError(
                "This workout was removed. Return to your log to resume your current workout.",
              );
            let saved: Payload = { ...parsed, schemaVersion: SCHEMA_VERSION };
            if (kind === "workout") {
              const workout = saved as Workout;
              if (workout.status === "draft" && workout.startedAt !== null) {
                const others = startedWorkouts(s).filter(
                  (record) => record.id !== id,
                );
                if (others.length) throw new WorkoutInProgressError(others);
              }
              const previous =
                old?.kind === "workout" ? old.payload : undefined;
              const now = Date.now();
              saved = {
                ...workout,
                createdAt: previous
                  ? (previous.createdAt ?? workout.createdAt)
                  : (workout.createdAt ?? now),
                ...(workout.status === "completed"
                  ? {
                      completedAt:
                        previous?.status === "completed"
                          ? previous.completedAt
                          : (workout.completedAt ?? now),
                    }
                  : {}),
              };
            }
            s.records[id] = {
              ...old,
              id,
              kind,
              payload: saved,
              deleted,
              revision: old?.revision ?? 0,
              localVersion: (old?.localVersion ?? 0) + 1,
              dirty: true,
              syncError: undefined,
            } as RecordDoc;
          });
        },
        {
          storage:
            "Could not save on this phone. Keep this screen open and free some storage.",
          inProgress: IN_PROGRESS_MESSAGE,
        },
      );
    };
    const startWorkout: Data["startWorkout"] = (id, payload, replace) =>
      commit(() => change((s) => createWorkout(s, id, payload, replace)), {
        storage:
          "Could not start on this phone. Your current workout has been kept. Free some storage and try again.",
      });
    const restoreWorkout: Data["restoreWorkout"] = (id) =>
      commit(() => change((s) => restoreRemovedWorkout(s, id)), {
        storage:
          "Could not restore this workout on this phone. Free some storage and try again.",
      });
    const resolve: Data["resolve"] = (id, mine) =>
      commit(
        () =>
          change((s) => {
            const r = s.records[id],
              remote = r?.conflict;
            if (!remote) return;
            s.outbox = s.outbox.filter((o) => o.id !== id);
            s.records[id] = (
              mine
                ? {
                    ...r,
                    ...nextVersion(r),
                    conflict: undefined,
                    revision: remote.revision,
                  }
                : { ...remote, localVersion: r.localVersion + 1, dirty: false }
            ) as RecordDoc;
          }),
        { storage: "Could not save your choice on this phone. Try again." },
      );
    const retryRejected: Data["retryRejected"] = () =>
      commit(
        () =>
          change((s) => {
            for (const record of Object.values(s.records))
              delete record.syncError;
          }),
        { storage: "Could not retry on this phone. Try again." },
      );
    const importRecords: Data["importRecords"] = (records) =>
      commit(
        () => {
          if (records.length > 10000)
            throw new RecordValidationError("Backup is too large.");
          const restored: RecordDoc[] = [];
          for (const r of records) {
            if (
              !z.string().uuid().safeParse(r.id).success ||
              !z.enum(recordKinds).safeParse(r.kind).success
            )
              throw new RecordValidationError(
                "Backup contains an invalid record ID or type.",
              );
            if (!r.deleted)
              restored.push({
                ...r,
                payload: validate(r.kind, r.payload),
              } as RecordDoc);
          }
          return change((s) => {
            let restoredStartedWorkout = false;
            for (const r of restored) {
              const old = s.records[r.id];
              if (old && !old.deleted) continue;
              if (old && old.kind !== r.kind)
                throw new RecordValidationError(
                  "A backup record does not match its saved record type.",
                );
              s.records[r.id] = {
                ...old,
                id: r.id,
                kind: r.kind,
                payload: r.payload,
                deleted: false,
                revision: old?.revision ?? 0,
                localVersion: (old?.localVersion ?? 0) + 1,
                dirty: true,
                syncError: undefined,
              } as RecordDoc;
              if (
                r.kind === "workout" &&
                r.payload.status === "draft" &&
                r.payload.startedAt !== null
              )
                restoredStartedWorkout = true;
            }
            if (restoredStartedWorkout && startedWorkouts(s).length > 1)
              throw new RecordValidationError(
                "A workout is already in progress. Finish or abandon it before restoring a backup with another started workout. No backup records were changed.",
              );
          });
        },
        {
          storage:
            "Could not restore the backup on this phone. Free some storage and try again.",
        },
      );
    return {
      save,
      deleteRecord,
      restoreWorkout,
      startWorkout,
      resolve,
      retryRejected,
      importRecords,
    };
  }, [account, scheduleSync]);

  const value = useMemo<Data>(
    () => ({
      state,
      ready: ready && authReady,
      error,
      syncing,
      online,
      syncHealth,
      sync,
      ...actions,
    }),
    [
      state,
      ready,
      authReady,
      error,
      syncing,
      online,
      syncHealth,
      sync,
      actions,
    ],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
