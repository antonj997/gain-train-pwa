import type { WorkoutSet } from "../data/model";
import { clearSetInputText } from "./set-input";

export function hasExtraWeight(set: WorkoutSet): boolean {
  return set.load === "bodyweight" && set.extraWeight === true;
}

export function changeSetLoad(
  set: WorkoutSet,
  load: WorkoutSet["load"],
): WorkoutSet {
  if (set.done || set.load === load) return set;
  const result = { ...set, load, weight: null };
  delete result.extraWeight;
  delete result.bodyWeightKg;
  if (load !== "bodyweight" && result.measure === "seconds") {
    result.measure = "reps";
    result.reps = null;
  }
  return clearSetInputText(
    result,
    "weight",
    ...(set.measure === "seconds" && load !== "bodyweight"
      ? ["reps" as const]
      : []),
  );
}

export function changeSetMeasure(
  set: WorkoutSet,
  measure: "reps" | "seconds",
): WorkoutSet {
  if (set.done || (set.measure ?? "reps") === measure) return set;
  const result = { ...set, measure, reps: null };
  delete result.bodyWeightKg;
  if (measure === "seconds" && set.load !== "bodyweight") {
    result.load = "bodyweight";
    result.weight = null;
    delete result.extraWeight;
  }
  return clearSetInputText(
    result,
    "reps",
    ...(measure === "seconds" && set.load !== "bodyweight"
      ? ["weight" as const]
      : []),
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
