// Whether a set beat the same set last time: the small up arrow on a checked
// row. Pure, so it is tested (tests/set-improvement.test.ts).
import { type WorkoutSet, validSet } from "./model";
import { isDrop } from "./drops";
import { previousResult } from "./workouts";
import { hasExtraWeight } from "../lib/set-load";
import { holdOf } from "../lib/rep-hold";

/** Weights are stored in kg, sometimes converted from pounds. */
const EPSILON = 1e-6;

/**
 * True when `cur` is better than `prev`, the set in the same position last
 * time. Both must be the same kind of set (load, added weight, measure);
 * cardio never compares. The load is the weight, the added weight on
 * bodyweight, or for an assisted set the assistance turned around, since less
 * help is better; plain bodyweight has none. Better is:
 * - more load at the same reps or more,
 * - the same load with more reps (a timed hold: more seconds),
 * - for weighted and added-weight reps sets, more weight × reps with the load
 *   not lower.
 * Reps + hold, when both sets have a hold: the hold must not be shorter for
 * the rules above, and the same load and reps with a longer hold is better too.
 */
export function improvedSince(
  prev: WorkoutSet | null | undefined,
  cur: WorkoutSet,
): boolean {
  if (!prev || !validSet(prev) || !validSet(cur)) return false;
  const measure = cur.measure ?? "reps";
  if (
    measure === "cardio" ||
    (prev.measure ?? "reps") !== measure ||
    prev.load !== cur.load ||
    hasExtraWeight(prev) !== hasExtraWeight(cur)
  )
    return false;
  const loaded = cur.load !== "bodyweight" || hasExtraWeight(cur);
  const sign = cur.load === "assisted" ? -1 : 1;
  const before = loaded ? sign * (prev.weight ?? 0) : 0;
  const now = loaded ? sign * (cur.weight ?? 0) : 0;
  if (now < before - EPSILON) return false;
  const sameLoad = now <= before + EPSILON;
  const prevHold = holdOf(prev);
  const curHold = holdOf(cur);
  const holds = prevHold !== null && curHold !== null;
  if (holds && curHold < prevHold) return false;
  const reps = cur.reps!;
  const prevReps = prev.reps!;
  if (!sameLoad && reps >= prevReps) return true;
  if (sameLoad && reps > prevReps) return true;
  const volume = measure === "reps" && cur.load !== "assisted" && loaded;
  if (volume && cur.weight! * reps > prev.weight! * prevReps + EPSILON)
    return true;
  return holds && sameLoad && reps === prevReps && curHold > prevHold;
}

/**
 * The ids of the working sets (not warm-ups, cool-downs or drops) that beat
 * the set in the same position last time. `prior` is the previous session's
 * sets; the match is the Previous column's (previousResult).
 */
export function improvedSetIds(
  sets: WorkoutSet[],
  prior: WorkoutSet[] | undefined,
): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!prior?.length) return ids;
  sets.forEach((set, index) => {
    if (!set.done || set.section !== "working" || isDrop(set)) return;
    if (improvedSince(previousResult(prior, sets, index), set)) ids.add(set.id);
  });
  return ids;
}
