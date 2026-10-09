import { z } from "zod";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { readAccount, transact } from "@/data/database";
import {
  emptyState,
  validate,
  RecordValidationError,
  type LocalState,
  type Kind,
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
  type StartedWorkout,
} from "@/data/workout-start";
import { supabase, syncClient } from "@/integrations/supabase/client";
type Data = {
  state: LocalState;
  ready: boolean;
  error: string;
  syncing: boolean;
  online: boolean;
  save: (
    id: string,
    kind: Kind,
    payload: Payload,
    deleted?: boolean,
  ) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  restoreWorkout: (id: string) => Promise<void>;
  startWorkout: (
    id: string,
    payload: Workout,
    replace?: StartedWorkout[],
  ) => Promise<void>;
  sync: () => Promise<void>;
  resolve: (id: string, mine: boolean) => Promise<void>;
  importRecords: (records: RecordDoc[]) => Promise<void>;
};
const Context = createContext<Data | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const { account, user, ready: authReady } = useAuth();
  const [state, setState] = useState(emptyState),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [syncing, setSyncing] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const activeAccount = useRef(account);
  useEffect(() => {
    activeAccount.current = account;
    return () => {
      activeAccount.current = "";
    };
  }, [account]);
  const running = useRef(false);
  const reload = useCallback(async () => {
    const s = await readAccount(account);
    if (activeAccount.current === account) setState(s);
  }, [account]);
  useEffect(() => {
    let active = true;
    setReady(false);
    setState(emptyState());
    setError("");
    readAccount(account)
      .then((s) => {
        if (active) {
          setState(s);
          setReady(true);
        }
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
    if (
      running.current ||
      !supabase ||
      !user ||
      account !== user.id ||
      !navigator.onLine
    )
      return;
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
        if (activeAccount.current === account) setError("");
      } catch (e) {
        if (activeAccount.current === account)
          setError(
            "Saved on this phone. Sync will retry when the server is available.",
          );
      } finally {
        running.current = false;
        setSyncing(false);
      }
    };
    // Only one tab may send this account's queue at a time.
    if (navigator.locks)
      await navigator.locks.request("gain-sync-" + account, work);
    else await work();
  }, [account, user, reload]);
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
  useEffect(() => {
    const channel = new BroadcastChannel("gain-train");
    channel.onmessage = () => void reload();
    return () => channel.close();
  }, [reload]);
  const notify = () => {
    const channel = new BroadcastChannel("gain-train");
    channel.postMessage("changed");
    channel.close();
  };
  const save = async (
    id: string,
    kind: Kind,
    payload: Payload,
    deleted = false,
  ) => {
    if (deleted) return deleteRecord(id);
    let parsed: Payload;
    try {
      parsed = validate(kind, payload);
    } catch (e) {
      if (activeAccount.current === account)
        setError(
          e instanceof Error ? e.message : "Check the details before saving.",
        );
      throw e;
    }
    try {
      const next = await transact(account, (s) => {
        const old = s.records[id];
        if (kind === "workout" && old?.deleted)
          throw new RecordValidationError(
            "This workout was removed. Return to your log to resume your current workout.",
          );
        let saved = parsed;
        if (kind === "workout") {
          const workout = parsed as Workout;
          if (workout.status === "draft" && workout.startedAt !== null) {
            const others = startedWorkouts(s).filter(
              (record) => record.id !== id,
            );
            if (others.length) throw new WorkoutInProgressError(others);
          }
          const previous =
            old?.kind === "workout" ? (old.payload as Workout) : undefined;
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
        };
      });
      if (activeAccount.current === account) {
        setState(next);
        setError("");
      }
      notify();
      setTimeout(() => void sync(), 500);
    } catch (e) {
      const message =
        e instanceof WorkoutInProgressError
          ? "Another workout is already in progress. Return to Workout to resume it before restoring this one."
          : e instanceof RecordValidationError
            ? e.message
            : "Could not save on this phone. Keep this screen open and free some storage.";
      if (activeAccount.current === account) setError(message);
      throw new Error(message, { cause: e });
    }
  };
  const startWorkout = async (
    id: string,
    payload: Workout,
    replace?: StartedWorkout[],
  ) => {
    try {
      const next = await transact(account, (s) =>
        createWorkout(s, id, payload, replace),
      );
      if (activeAccount.current === account) {
        setState(next);
        setError("");
      }
      notify();
      setTimeout(() => void sync(), 500);
    } catch (e) {
      if (e instanceof WorkoutInProgressError) throw e;
      const message =
        e instanceof RecordValidationError
          ? e.message
          : "Could not start on this phone. Your current workout has been kept. Free some storage and try again.";
      if (activeAccount.current === account) setError(message);
      throw new Error(message, { cause: e });
    }
  };
  const deleteRecord = async (id: string) => {
    try {
      const next = await transact(account, (s) => {
        const saved = s.records[id];
        if (!saved)
          throw new RecordValidationError(
            "Could not find the saved record. Return to your log and try again.",
          );
        if (saved.deleted) return;
        s.records[id] = {
          ...saved,
          payload: validate(saved.kind, saved.payload),
          deleted: true,
          localVersion: saved.localVersion + 1,
          dirty: true,
        };
      });
      if (activeAccount.current === account) {
        setState(next);
        setError("");
      }
      notify();
      setTimeout(() => void sync(), 500);
    } catch (e) {
      const message =
        e instanceof RecordValidationError
          ? e.message
          : "Could not remove the saved record on this phone. Keep this screen open and try again.";
      if (activeAccount.current === account) setError(message);
      throw new Error(message, { cause: e });
    }
  };
  const restoreWorkout = async (id: string) => {
    try {
      const next = await transact(account, (s) => restoreRemovedWorkout(s, id));
      if (activeAccount.current === account) {
        setState(next);
        setError("");
      }
      notify();
      setTimeout(() => void sync(), 500);
    } catch (e) {
      const message =
        e instanceof RecordValidationError
          ? e.message
          : "Could not restore this workout on this phone. Free some storage and try again.";
      if (activeAccount.current === account) setError(message);
      throw new Error(message, { cause: e });
    }
  };
  const resolve = async (id: string, mine: boolean) => {
    await transact(account, (s) => {
      const r = s.records[id],
        remote = r?.conflict;
      if (!remote) return;
      s.outbox = s.outbox.filter((o) => o.id !== id);
      s.records[id] = mine
        ? {
            ...r,
            conflict: undefined,
            revision: remote.revision,
            localVersion: r.localVersion + 1,
            dirty: true,
          }
        : { ...remote, localVersion: r.localVersion + 1, dirty: false };
    });
    await reload();
    notify();
    void sync();
  };
  const importRecords = async (records: RecordDoc[]) => {
    try {
      if (records.length > 10000)
        throw new RecordValidationError("Backup is too large.");
      const restored: RecordDoc[] = [];
      for (const r of records) {
        if (
          !z.string().uuid().safeParse(r.id).success ||
          !z.enum(["workout", "routine", "exercise"]).safeParse(r.kind).success
        )
          throw new RecordValidationError(
            "Backup contains an invalid record ID or type.",
          );
        if (!r.deleted)
          restored.push({ ...r, payload: validate(r.kind, r.payload) });
      }
      const next = await transact(account, (s) => {
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
          };
          if (
            r.kind === "workout" &&
            (r.payload as Workout).status === "draft" &&
            (r.payload as Workout).startedAt !== null
          )
            restoredStartedWorkout = true;
        }
        if (restoredStartedWorkout && startedWorkouts(s).length > 1)
          throw new RecordValidationError(
            "A workout is already in progress. Finish or abandon it before restoring a backup with another started workout. No backup records were changed.",
          );
      });
      if (activeAccount.current === account) {
        setState(next);
        setError("");
      }
      notify();
      void sync();
    } catch (e) {
      const message =
        e instanceof RecordValidationError
          ? e.message
          : "Could not restore the backup on this phone. Free some storage and try again.";
      if (activeAccount.current === account) setError(message);
      throw new Error(message, { cause: e });
    }
  };
  return (
    <Context.Provider
      value={{
        state,
        ready: ready && authReady,
        error,
        syncing,
        online,
        save,
        deleteRecord,
        restoreWorkout,
        startWorkout,
        sync,
        resolve,
        importRecords,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const c = useContext(Context);
  if (!c) throw Error("Data provider missing");
  return c;
}
