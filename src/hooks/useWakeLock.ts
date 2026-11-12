import { useEffect } from "react";

type Sentinel = { released: boolean; release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

/**
 * Keeps the screen on while `active` (a running workout), where the Screen
 * Wake Lock API exists. The browser drops the lock when the page is hidden,
 * so it is asked for again on return; leaving or finishing releases it. Any
 * refusal (battery saver, an older browser) is silent.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!api || typeof api.request !== "function") return;
    let sentinel: Sentinel | null = null;
    let stopped = false;
    const request = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      try {
        const next = await api.request("screen");
        if (stopped) void next.release().catch(() => {});
        else sentinel = next;
      } catch {
        // Not allowed now: the screen just sleeps as usual.
      }
    };
    const onVisible = () => void request();
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
