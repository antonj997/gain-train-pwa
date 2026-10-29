import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { User } from "@supabase/supabase-js";
import { syncAccount } from "@/data/sync";
import { supabaseTransport } from "@/data/transport";
import { supabase, syncClient } from "@/integrations/supabase/client";
import { readSyncHealth, recordSyncResult } from "@/lib/sync-health";

// Batches a burst of edits (typing a set, checking several sets) into one upload.
const SYNC_DELAY_MS = 1500;
const SYNC_INTERVAL_MS = 30_000;

/**
 * When and how an account's log syncs: on start, every 30 seconds, when the
 * app comes back or reconnects, and shortly after local edits. Only one tab
 * sends an account's queue at a time.
 */
export function useSyncLoop({
  account,
  user,
  enabled,
  activeAccount,
  reload,
  setError,
}: {
  account: string;
  user: User | null;
  /** False until the local log and auth have loaded. */
  enabled: boolean;
  /** The account the provider shows now; "" once it has moved on. */
  activeAccount: MutableRefObject<string>;
  /** Re-reads the account's stored log into the provider. */
  reload: () => Promise<void>;
  setError: (message: string) => void;
}) {
  const [syncing, setSyncing] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [syncHealth, setSyncHealth] = useState(() => readSyncHealth(account));
  useEffect(() => setSyncHealth(readSyncHealth(account)), [account]);
  const running = useRef(false),
    rerun = useRef(false),
    syncTimer = useRef<ReturnType<typeof setTimeout>>();
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
        await syncAccount(
          account,
          supabaseTransport(syncClient(session.access_token)),
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
  }, [account, user, reload, activeAccount, setError]);
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
    const timer = setInterval(() => void sync(), SYNC_INTERVAL_MS);
    if (enabled) void sync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(timer);
    };
  }, [sync, reload, enabled]);
  return { sync, scheduleSync, syncing, online, syncHealth };
}
