import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/contexts/useData";
import { validate, type Workout } from "@/data/model";
import {
  draftKey,
  readDraft,
  writeDraft,
  parseWorkoutRecovery,
} from "@/lib/drafts";
import { errorMessage } from "@/lib/errors";
import { local } from "@/lib/storage";
import { assertNotFuture, workoutContentKey } from "@/lib/workout-editor";
import { t } from "@/i18n";

// Save once typing pauses instead of on every keystroke. The recovery draft is
// still written on every change, so nothing typed is lost in between.
const AUTOSAVE_DELAY_MS = 600;
const saveFailed = () => t("actions.saveFailed");
const finishedElsewhereMessage = () => t("autosave.finishedElsewhere");

type PendingSave = { value: Workout; version: number; retained: boolean };

/**
 * Editor state for one workout. Drafts save automatically; completed workouts
 * being edited only change on an explicit save. Both keep a recovery draft on
 * the phone until saved, since iOS ends a backgrounded app quickly. Also
 * reports when the stored workout was changed in another tab or on another
 * device.
 */
export function useWorkoutAutosave(
  id: string,
  account: string,
  initial: Workout,
) {
  const { state, save } = useData();
  // Fixed for the editor's lifetime: a draft finished on another device while
  // open here must not turn this screen into "edit a finished workout".
  const [editing] = useState(initial.status === "completed");
  const status: Workout["status"] = editing ? "completed" : "draft";
  const recoveryKey = draftKey(account, editing ? "edit" : "workout", id);
  const [recovered] = useState(() =>
    readDraft(local, recoveryKey, (value) =>
      parseWorkoutRecovery(value, status),
    ),
  );
  const [workout, setWorkoutState] = useState<Workout>(
    recovered?.workout ?? initial,
  );
  // The entries as last changed, for edits that build on the previous one
  // before React re-renders (see `changeWith`).
  const latest = useRef(workout);
  const setWorkout = (value: Workout) => {
    latest.current = value;
    setWorkoutState(value);
  };
  const [saved, setSaved] = useState(!recovered);
  const [error, setError] = useState<string | null>(
    recovered
      ? editing
        ? t("autosave.recoveredEdit")
        : t("autosave.recoveredDraft")
      : null,
  );
  const queue = useRef(Promise.resolve());
  const version = useRef(0);
  const locked = useRef(false);
  const pending = useRef<PendingSave | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // What this editor last loaded or saved; anything else stored came from
  // elsewhere. A recovered draft starts from the version it was made on.
  const known = useRef(recovered?.base ?? workoutContentKey(initial));
  const inFlight = useRef<string | null>(null);

  const stored = state.records[id];
  const storedWorkout =
    stored?.kind === "workout" && !stored.deleted ? stored.payload : null;
  // Canonicalising is not free; do it once per stored version, not per keystroke.
  const storedKey = useMemo(
    () => (storedWorkout ? workoutContentKey(storedWorkout) : null),
    [storedWorkout],
  );
  const finishedElsewhere = !editing && storedWorkout?.status === "completed";
  const finishedRef = useRef(finishedElsewhere);
  finishedRef.current = finishedElsewhere;

  /** Keeps unsaved entries on the phone, with the stored version they build on. */
  const retain = (value: Workout | null) =>
    writeDraft(
      local,
      recoveryKey,
      value && { workout: value, base: known.current },
    );

  /** Starts any waiting save now. Resolves when every queued save has settled. */
  const flush = () => {
    clearTimeout(timer.current);
    const job = pending.current;
    pending.current = null;
    if (job)
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          if (finishedRef.current) throw new Error(finishedElsewhereMessage());
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
            retain(null);
          }
        })
        .catch((cause) => {
          if (job.version === version.current)
            setError(
              cause instanceof Error &&
                cause.message === finishedElsewhereMessage()
                ? finishedElsewhereMessage()
                : errorMessage(cause, saveFailed()) +
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
    if (finishedRef.current) throw new Error(finishedElsewhereMessage());
    const key = workoutContentKey(validate("workout", value));
    inFlight.current = key;
    try {
      await save(id, "workout", value);
      known.current = key;
    } finally {
      inFlight.current = null;
    }
    retain(null);
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
    const value = { ...next, status };
    setWorkout(value);
    setSaved(false);
    setError(null);
    const current = ++version.current;
    // A finished workout being edited changes only on an explicit save; an
    // edit that is back to the saved version needs no recovery draft.
    if (editing) {
      retain(workoutContentKey(value) === known.current ? null : value);
      return;
    }
    const retained = retain(value);
    if (finishedRef.current) {
      setError(finishedElsewhereMessage());
      return;
    }
    try {
      validate("workout", value);
      assertNotFuture(value);
    } catch (cause) {
      // Keep the last valid state: save what was waiting, not this entry.
      void flush();
      setError(
        errorMessage(cause, saveFailed()) +
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
  const changeRef = useRef(change);
  changeRef.current = change;
  /** Applies `update` to the latest entries; one identity for the editor's lifetime. */
  const changeWith = useCallback(
    (update: (workout: Workout) => Workout) =>
      changeRef.current(update(latest.current)),
    [],
  );

  const changedElsewhere =
    !!storedKey &&
    !finishedElsewhere &&
    !pending.current &&
    storedKey !== known.current &&
    storedKey !== inFlight.current;

  return {
    workout,
    change,
    changeWith,
    editing,
    saved,
    error,
    setError,
    flush,
    saveNow,
    /** Forgets this screen's unsaved entries, e.g. after "Discard changes". */
    discard: () => {
      clearTimeout(timer.current);
      pending.current = null;
      retain(null);
    },
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
      if (!storedWorkout) return;
      clearTimeout(timer.current);
      pending.current = null;
      version.current++;
      known.current = storedKey!;
      setWorkout(storedWorkout);
      setSaved(true);
      setError(null);
      retain(null);
    },
    /** Keeps this screen's entries; a draft saves them over the stored version. */
    keepMine: () => {
      known.current = storedKey!;
      if (!editing) change(latest.current);
    },
  };
}
