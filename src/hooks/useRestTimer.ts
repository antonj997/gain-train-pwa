import { useEffect, useState } from "react";
import { draftKey, extendRestEnd, readRestEnd } from "@/lib/drafts";
import { local, writeStored } from "@/lib/storage";
import {
  readTrainingPreferences,
  TRAINING_PREFERENCES_EVENT,
} from "@/lib/preferences";
import { REST_DONE_MS, REST_EXTEND_SECONDS, restTotal } from "@/lib/rest-dock";
import { motionMs } from "@/lib/slow-motion";

/**
 * The rest between sets. `end` is when the rest runs out (kept on the phone,
 * so a reload carries on), `total` its length for the dock's fill, and
 * `doneAt` when the last one ran out: the dock says "Rest done" for 4 s. The
 * countdown is real time; only the dock's motion follows slow motion.
 */
export function useRestTimer(account: string, workoutId: string) {
  const key = draftKey(account, "rest", workoutId);
  const [preferences, setPreferences] = useState(readTrainingPreferences);
  const [end, setEnd] = useState(() => readRestEnd(local, key));
  const [known, setKnown] = useState<number | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const update = (value: number | null, length: number | null) => {
    setDoneAt(null);
    setEnd(value);
    setKnown(length);
    // A live timer still works when storage is unavailable.
    writeStored(key, value === null ? null : String(value));
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
  // Runs out exactly at `end`; a phone that slept checks again on return.
  useEffect(() => {
    if (!end) return;
    const check = () => {
      if (end > Date.now()) return;
      setEnd(null);
      setDoneAt(end);
      local.removeItem(key);
    };
    const timeout = window.setTimeout(check, Math.max(0, end - Date.now()));
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", check);
    };
  }, [end, key]);
  // "Rest done" leaves by itself.
  useEffect(() => {
    if (doneAt === null) return;
    const left = motionMs(REST_DONE_MS) - (Date.now() - doneAt);
    const timeout = window.setTimeout(() => setDoneAt(null), Math.max(0, left));
    return () => window.clearTimeout(timeout);
  }, [doneAt]);
  useEffect(() => {
    if (preferences.restSeconds > 0) return;
    setEnd(null);
    setDoneAt(null);
    local.removeItem(key);
  }, [preferences.restSeconds, key]);
  return {
    preferences,
    /** When the running rest ends (ms), or null. */
    end,
    /** The running rest's length in seconds, for the fill. */
    total: end ? restTotal(known, end, Date.now(), preferences.restSeconds) : 0,
    /** When the last rest ran out (ms), while "Rest done" shows. */
    doneAt,
    start: () => {
      if (preferences.restSeconds > 0)
        update(
          Date.now() + preferences.restSeconds * 1000,
          preferences.restSeconds,
        );
    },
    skip: () => update(null, null),
    /** A tap on the time: 15 s more. */
    extend: () => {
      if (!end) return;
      const now = Date.now();
      const next = extendRestEnd(end, now, REST_EXTEND_SECONDS);
      update(
        next,
        restTotal(known, end, now, preferences.restSeconds) +
          REST_EXTEND_SECONDS,
      );
    },
  };
}
