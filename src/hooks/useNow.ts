import { useEffect, useState } from "react";

/**
 * The current time in ms, refreshed every 30 seconds and on returning to the
 * app while `active`; a running workout's timer uses it.
 */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);
  return now;
}
