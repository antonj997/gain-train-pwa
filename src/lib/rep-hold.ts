import type { Library, WorkoutSet } from "../data/model";
import { t } from "../i18n";

/**
 * Reps with a hold: "6 reps with a 2 s hold". An exercise whose count is
 * "Reps + hold" (saved in the library's `repHold`) shows a hold field next to
 * reps, and each set keeps its `holdSec`. The measure stays "reps", so
 * records, estimated maxes and the charts read the set as weight × reps.
 */

/** The longest hold a set can carry, in seconds. */
export const HOLD_MAX = 600;

/** What the count heading's menu offers. */
export type CountChoice = "reps" | "repsHold" | "seconds";

/** The hold of a reps set in seconds, or null when it has none. */
export function holdOf(set: WorkoutSet): number | null {
  if (set.measure === "seconds" || set.measure === "cardio") return null;
  const hold = set.holdSec;
  return typeof hold === "number" && hold > 0 ? hold : null;
}

/** "2 s", or "" for a set without a hold. */
export function holdLabel(set: WorkoutSet) {
  const hold = holdOf(set);
  return hold === null ? "" : t("label.hold", { n: hold });
}

/** The count menu's choice for an exercise's measure and its saved hold setting. */
export function countChoice(
  measure: "reps" | "seconds",
  repHold: boolean,
): CountChoice {
  return measure === "seconds" ? "seconds" : repHold ? "repsHold" : "reps";
}

/** Ids of the exercises whose count is "Reps + hold". */
export const repHoldIds = (library: Library): ReadonlySet<string> =>
  new Set(library.repHold ?? []);

/** The library with one exercise's "Reps + hold" turned on or off. */
export function withRepHold(
  library: Library,
  exerciseId: string,
  on: boolean,
): Library {
  const ids = (library.repHold ?? []).filter((id) => id !== exerciseId);
  return { ...library, repHold: on ? [...ids, exerciseId] : ids };
}

/**
 * Sets checked between `before` and `after` while the hold field is hidden
 * lose their hold: the set is logged as the row showed it. Unchecked sets
 * keep theirs, so choosing "Reps + hold" again brings the values back.
 */
export function withoutHiddenHolds(
  before: readonly WorkoutSet[],
  after: WorkoutSet[],
): WorkoutSet[] {
  const wasDone = new Set(before.filter((s) => s.done).map((s) => s.id));
  if (!after.some((s) => s.done && !wasDone.has(s.id) && s.holdSec != null))
    return after;
  return after.map((s) => {
    if (!s.done || wasDone.has(s.id) || s.holdSec == null) return s;
    const next = { ...s };
    delete next.holdSec;
    return next;
  });
}
