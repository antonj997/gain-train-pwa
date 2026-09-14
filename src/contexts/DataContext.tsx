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
  type LocalState,
  type Kind,
  type Payload,
  type RecordDoc,
  type RemoteDoc,
} from "@/data/model";
import { syncAccount } from "@/data/sync";
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
    try {
      const parsed = validate(kind, payload);
      const next = await transact(account, (s) => {
        const old = s.records[id];
        s.records[id] = {
          ...old,
          id,
          kind,
          payload: parsed,
          deleted,
          revision: old?.revision ?? 0,
          localVersion: (old?.localVersion ?? 0) + 1,
          dirty: true,
        };
      });
      if (activeAccount.current === account) setState(next);
      notify();
      setTimeout(() => void sync(), 500);
    } catch (e) {
      setError(
        "Could not save on this phone. Keep this screen open and free some storage.",
      );
      throw e;
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
    if (records.length > 10000) throw Error("Backup is too large.");
    for (const r of records) {
      z.string().uuid().parse(r.id);
      z.enum(["workout", "routine", "exercise"]).parse(r.kind);
      if (!r.deleted) validate(r.kind, r.payload);
    }
    await transact(account, (s) => {
      for (const r of records) {
        if (r.deleted || s.records[r.id]) continue;
        s.records[r.id] = {
          id: r.id,
          kind: r.kind,
          payload: validate(r.kind, r.payload),
          deleted: false,
          revision: 0,
          localVersion: 1,
          dirty: true,
        };
      }
    });
    await reload();
    notify();
    void sync();
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
