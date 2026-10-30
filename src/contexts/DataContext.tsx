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
  RecordValidationError,
  type LocalState,
} from "@/data/model";
import {
  deleteRecordIn,
  importRecordsIn,
  parseImport,
  resolveConflictIn,
  retryRejectedIn,
  saveRecordIn,
  copyPhoneLogIn,
  saveLibraryIn,
  type CopyResult,
  type ImportResult,
} from "@/data/actions";
import {
  createWorkout,
  restoreRemovedWorkout,
  WorkoutInProgressError,
} from "@/data/workout-start";
import { useSyncLoop } from "@/hooks/useSyncLoop";
import { PHONE_ACCOUNT } from "@/lib/auth-account";
import { staleDraftKeys } from "@/lib/drafts";
import { local, storedKeys } from "@/lib/storage";
import { notifyOtherTabs, onOtherTabChange } from "@/lib/tab-sync";
import { t } from "@/i18n";

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
    [error, setError] = useState("");
  const activeAccount = useRef(account);
  useEffect(() => {
    activeAccount.current = account;
    return () => {
      activeAccount.current = "";
    };
  }, [account]);
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
        if (!active) return;
        setState(s);
        setReady(true);
        for (const key of staleDraftKeys(storedKeys(), account, s.records))
          local.removeItem(key);
      })
      .catch(() => {
        if (active) {
          setError(t("err.storageUnavailable"));
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [account]);
  const { sync, scheduleSync, syncing, online, syncHealth } = useSyncLoop({
    account,
    user,
    enabled: ready && authReady,
    activeAccount,
    reload,
    setError,
  });
  const syncRef = useRef(sync);
  syncRef.current = sync;
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

    const deleteRecord: Data["deleteRecord"] = (id) =>
      commit(() => change((s) => deleteRecordIn(s, id)), {
        storage: t("err.removeFailed"),
      });
    const save: Data["save"] = (id, kind, payload, deleted = false) => {
      if (deleted) return deleteRecord(id);
      return commit(
        () => {
          const parsed = validate(kind, payload);
          return change((s) => saveRecordIn(s, id, kind, parsed));
        },
        {
          storage: t("err.saveOnPhone"),
          inProgress: t("err.inProgressTrain"),
        },
      );
    };
    const startWorkout: Data["startWorkout"] = (id, payload, replace) =>
      commit(() => change((s) => createWorkout(s, id, payload, replace)), {
        storage: t("err.startOnPhone"),
      });
    const restoreWorkout: Data["restoreWorkout"] = (id) =>
      commit(() => change((s) => restoreRemovedWorkout(s, id)), {
        storage: t("err.restoreWorkoutPhone"),
      });
    const resolve: Data["resolve"] = (id, mine) =>
      commit(() => change((s) => resolveConflictIn(s, id, mine)), {
        storage: t("err.choiceOnPhone"),
      });
    const retryRejected: Data["retryRejected"] = () =>
      commit(() => change(retryRejectedIn), {
        storage: t("err.retryOnPhone"),
      });
    const importRecords: Data["importRecords"] = async (records) => {
      // Download what the server has first, so records it already holds are
      // kept as they are instead of being sent again as new.
      await syncRef.current();
      let result: ImportResult = { added: 0, restored: 0, kept: 0 };
      await commit(
        () => {
          const restored = parseImport(records);
          return change((s) => {
            result = importRecordsIn(s, restored);
          });
        },
        {
          storage: t("err.restoreBackupPhone"),
        },
      );
      return result;
    };
    const copyPhoneLog: Data["copyPhoneLog"] = async () => {
      await syncRef.current();
      let result: CopyResult = { added: 0, pastWorkouts: 0 };
      await commit(
        async () => {
          const phone = parseImport(
            Object.values((await readAccount(PHONE_ACCOUNT)).records),
          );
          return change((s) => {
            result = copyPhoneLogIn(s, account, phone);
          });
        },
        {
          storage: t("err.copyPhoneStorage"),
        },
      );
      return result;
    };
    const saveLibrary: Data["saveLibrary"] = (library) =>
      commit(
        () => {
          const parsed = validate("library", library);
          return change((s) => saveLibraryIn(s, account, parsed));
        },
        {
          storage: t("err.saveOnPhone"),
        },
      );
    return {
      save,
      deleteRecord,
      copyPhoneLog,
      saveLibrary,
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
