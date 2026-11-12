import type { WorkoutSet } from "../data/model";
import { clearSetInputText } from "./set-input";

export function hasExtraWeight(set: WorkoutSet): boolean {
  return set.load === "bodyweight" && set.extraWeight === true;
}

/**
 * True when the set's weight field means something: a weight, the added
 * weight on bodyweight or the assistance. Plain bodyweight and "none" have no
 * weight to show or type.
 */
export function hasWeightField(set: WorkoutSet): boolean {
  return (
    set.load === "weight" || set.load === "assisted" || hasExtraWeight(set)
  );
}

/**
 * A timed hold may be held with any load but assisted: bodyweight (with or
 * without added weight), a plain weight such as a kettlebell, or none.
 */
export const holdAllowsLoad = (load: WorkoutSet["load"]) => load !== "assisted";

export function changeSetLoad(
  set: WorkoutSet,
  load: WorkoutSet["load"],
): WorkoutSet {
  if (set.done || set.load === load) return set;
  const result = { ...set, load, weight: null };
  delete result.extraWeight;
  delete result.bodyWeightKg;
  const leavesHold = result.measure === "seconds" && !holdAllowsLoad(load);
  if (leavesHold) {
    result.measure = "reps";
    result.reps = null;
  }
  return clearSetInputText(
    result,
    "weight",
    ...(leavesHold ? ["reps" as const] : []),
  );
}

export function changeSetMeasure(
  set: WorkoutSet,
  measure: "reps" | "seconds",
): WorkoutSet {
  if (set.done || (set.measure ?? "reps") === measure) return set;
  const result = { ...set, measure, reps: null };
  delete result.bodyWeightKg;
  // Switching the count to Hold makes weighted and assisted sets bodyweight
  // holds, as before; a load-free set stays load-free. A hold can still be
  // given a weight afterwards (changeSetLoad keeps it a hold).
  const toBodyweight =
    measure === "seconds" && (set.load === "weight" || set.load === "assisted");
  if (toBodyweight) {
    result.load = "bodyweight";
    result.weight = null;
    delete result.extraWeight;
  }
  return clearSetInputText(
    result,
    "reps",
    ...(toBodyweight ? ["weight" as const] : []),
  );
}

export function changeExtraWeight(
  set: WorkoutSet,
  enabled: boolean,
): WorkoutSet {
  if (set.done || set.load !== "bodyweight" || hasExtraWeight(set) === enabled)
    return set;
  const result = { ...set, weight: null };
  delete result.bodyWeightKg;
  if (enabled) result.extraWeight = true;
  else delete result.extraWeight;
  return clearSetInputText(result, "weight");
}
