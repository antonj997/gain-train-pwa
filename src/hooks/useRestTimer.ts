import { useEffect, useState } from "react";
import { draftKey, extendRestEnd, readRestEnd } from "@/lib/drafts";
import {
  readTrainingPreferences,
  TRAINING_PREFERENCES_EVENT,
} from "@/lib/preferences";

export function useRestTimer(account: string, workoutId: string) {
  const key = draftKey(account, "rest", workoutId);
  const [preferences, setPreferences] = useState(readTrainingPreferences);
  const [end, setEnd] = useState(() => readRestEnd(localStorage, key));
  const [now, setNow] = useState(Date.now);
  const [elapsed, setElapsed] = useState(false);
  const update = (value: number | null) => {
    setElapsed(false);
    setNow(Date.now());
    setEnd(value);
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {
      /* A live timer still works. */
    }
  };
  useEffect(() => {
    const refresh = () => setPreferences(readTrainingPreferences());
    window.addEventListener(TRAINING_PREFERENCES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(TRAINING_PREFERENCES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    if (!end) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (end <= time) {
        setEnd(null);
        setElapsed(true);
        try {
          localStorage.removeItem(key);
        } catch {
          /* Expired timer can safely be ignored on reload. */
        }
      }
    };
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [end, key]);
  useEffect(() => {
    if (preferences.restSeconds > 0) return;
    setEnd(null);
    setElapsed(false);
    try {
      localStorage.removeItem(key);
    } catch {
      /* Rest is off. */
    }
  }, [preferences.restSeconds, key]);
  return {
    preferences,
    elapsed,
    remaining: end ? Math.max(0, Math.ceil((end - now) / 1000)) : 0,
    start: () => {
      if (preferences.restSeconds > 0)
        update(Date.now() + preferences.restSeconds * 1000);
    },
    skip: () => update(null),
    extend: () => update(extendRestEnd(end, Date.now(), 30)),
  };
}
