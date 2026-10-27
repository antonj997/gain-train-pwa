import { useEffect, useRef, useState } from "react";
import { useData } from "@/contexts/useData";
import { validate, type Workout } from "@/data/model";
import {
  draftKey,
  readDraft,
  writeDraft,
  parseWorkoutDraft,
} from "@/lib/drafts";
import { errorMessage } from "@/lib/errors";
import { local } from "@/lib/storage";
import { assertNotFuture, workoutContentKey } from "@/lib/workout-editor";

// Save once typing pauses instead of on every keystroke. The recovery draft is
// still written on every change, so nothing typed is lost in between.
export const AUTOSAVE_DELAY_MS = 600;
const SAVE_FAILED = "Could not save. Retry to keep your changes.";

type PendingSave = { value: Workout; version: number; retained: boolean };

/**
 * Editor state for one workout. Drafts save automatically; completed workouts
 * being edited only change on an explicit save. Also reports when the stored
 * workout was changed in another tab or on another device.
 */
export function useWorkoutAutosave(
  id: string,
  account: string,
  initial: Workout,
) {
  const { state, save } = useData();
  const editing = initial.status === "completed";
  const recoveryKey = draftKey(account, "workout", id);
  const [recovered] = useState(() =>
    editing ? null : readDraft(local, recoveryKey, parseWorkoutDraft),
  );
  const [workout, setWorkout] = useState<Workout>(recovered ?? initial);
  const [saved, setSaved] = useState(!recovered);
  const [error, setError] = useState<string | null>(
    recovered
      ? "Recovered unsaved entries. Correct any errors, then retry saving."
      : null,
  );
  const queue = useRef(Promise.resolve());
  const version = useRef(0);
  const locked = useRef(false);
  const pending = useRef<PendingSave | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // What this editor last loaded or saved; anything else stored came from elsewhere.
  const known = useRef(workoutContentKey(initial));
  const inFlight = useRef<string | null>(null);

  /** Starts any waiting save now. Resolves when every queued save has settled. */
  const flush = () => {
    clearTimeout(timer.current);
    const job = pending.current;
    pending.current = null;
    if (job)
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          // Saving normalizes the entry (e.g. trims the name); compare that form.
          const key = workoutContentKey(validate("workout", job.value));
          inFlight.current = key;
          try {
            await save(id, "workout", job.value);
            known.current = key;
          } finally {
            inFlight.current = null;
          }
          if (job.version === version.current) {
            setSaved(true);
            setError(null);
            writeDraft(local, recoveryKey, null);
          }
        })
        .catch((cause) => {
          if (job.version === version.current)
            setError(
              errorMessage(cause, SAVE_FAILED) +
                (job.retained
                  ? " Unsaved entries are kept on this phone. Retry saving."
                  : " Keep this screen open and retry saving."),
            );
        });
    return queue.current;
  };
  /** Saves `value` (e.g. the finished workout) after anything still waiting. */
  const saveNow = async (value: Workout) => {
    await flush();
    const key = workoutContentKey(validate("workout", value));
    inFlight.current = key;
    try {
      await save(id, "workout", value);
      known.current = key;
    } finally {
      inFlight.current = null;
    }
    writeDraft(local, recoveryKey, null);
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  // Save before the app is backgrounded or this screen closes.
  useEffect(() => {
    const now = () => void flushRef.current();
    const hidden = () => {
      if (document.visibilityState === "hidden") now();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", now);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", now);
      now();
    };
  }, []);

  function change(next: Workout) {
    if (locked.current) return;
    const value = { ...next, status: initial.status };
    setWorkout(value);
    setSaved(false);
    setError(null);
    const current = ++version.current;
    if (editing) return;
    const retained = writeDraft(local, recoveryKey, value);
    try {
      validate("workout", value);
      assertNotFuture(value);
    } catch (cause) {
      // Keep the last valid state: save what was waiting, not this entry.
      void flush();
      setError(
        errorMessage(cause, SAVE_FAILED) +
          (retained
            ? " Unsaved entries are kept on this phone."
            : " Keep this screen open until corrected."),
      );
      return;
    }
    pending.current = { value, version: current, retained };
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => void flushRef.current(),
      AUTOSAVE_DELAY_MS,
    );
  }

  const stored = state.records[id];
  const storedKey =
    stored?.kind === "workout" && !stored.deleted
      ? workoutContentKey(stored.payload)
      : null;
  const changedElsewhere =
    !!storedKey &&
    !pending.current &&
    storedKey !== known.current &&
    storedKey !== inFlight.current;

  return {
    workout,
    change,
    editing,
    saved,
    error,
    setError,
    flush,
    saveNow,
    /** Ignores edits while finishing or abandoning. */
    lock: () => {
      locked.current = true;
    },
    unlock: () => {
      locked.current = false;
    },
    changedElsewhere,
    /** Replaces this screen's entries with the stored version. */
    loadLatest: () => {
      if (stored?.kind !== "workout") return;
      clearTimeout(timer.current);
      pending.current = null;
      version.current++;
      known.current = storedKey!;
      setWorkout(stored.payload);
      setSaved(true);
      setError(null);
      writeDraft(local, recoveryKey, null);
    },
    /** Keeps this screen's entries; a draft saves them over the stored version. */
    keepMine: () => {
      known.current = storedKey!;
      if (!editing) change(workout);
    },
  };
}
