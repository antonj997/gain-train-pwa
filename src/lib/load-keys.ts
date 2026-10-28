import type { WorkoutSet } from "../data/model";
import {
  changeExtraWeight,
  changeSetLoad,
  changeSetMeasure,
  hasExtraWeight,
} from "./set-load";

export type LoadKey = "weight" | "bw" | "bwplus" | "assisted";
export type LoadMarker = "none" | "bw" | "plus" | "minus" | "kg";
type Measure = "reps" | "seconds";

export function loadKeyOf(set: WorkoutSet): LoadKey {
  if (set.load === "assisted") return "assisted";
  if (set.load === "bodyweight") return hasExtraWeight(set) ? "bwplus" : "bw";
  return "weight";
}

/** Changes an unchecked set's load key; a checked set is returned unchanged. */
export function withLoadKey(set: WorkoutSet, key: LoadKey): WorkoutSet {
  if (set.done) return set;
  if (key === "weight") return changeSetLoad(set, "weight");
  if (key === "assisted") return changeSetLoad(set, "assisted");
  return changeExtraWeight(changeSetLoad(set, "bodyweight"), key === "bwplus");
}

// The most common value. A tie goes to the value met first, i.e. the earliest set's.
function mostCommon<T>(values: T[], none: T): T {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = none;
  let bestCount = 0;
  for (const [value, count] of counts)
    if (count > bestCount) [best, bestCount] = [value, count];
  return best;
}

export function defaultLoadKey(sets: WorkoutSet[]): LoadKey {
  return mostCommon(sets.map(loadKeyOf), "weight");
}

const measureOf = (set: WorkoutSet): Measure => set.measure ?? "reps";

export function exerciseMeasure(sets: WorkoutSet[]): Measure {
  return mostCommon(sets.map(measureOf), "reps");
}

const MARKERS: Record<LoadKey, LoadMarker> = {
  bw: "bw",
  bwplus: "plus",
  assisted: "minus",
  weight: "kg",
};

export function loadMarker(set: WorkoutSet, defaultKey: LoadKey): LoadMarker {
  const key = loadKeyOf(set);
  return key === defaultKey ? "none" : MARKERS[key];
}

const HEADINGS: Record<LoadKey, "kg" | "BW" | "+kg" | "Assist"> = {
  weight: "kg",
  bw: "BW",
  bwplus: "+kg",
  assisted: "Assist",
};

export function loadHeading(key: LoadKey): "kg" | "BW" | "+kg" | "Assist" {
  return HEADINGS[key];
}

/** "Reps/sec" when the sets mix both measures. */
export function countHeading(sets: WorkoutSet[]): "Reps" | "Sec" | "Reps/sec" {
  const measures = new Set(sets.map(measureOf));
  if (measures.size > 1) return "Reps/sec";
  return measures.has("seconds") ? "Sec" : "Reps";
}

/** Sets every unchecked set to the key, overwriting per-set exceptions. */
export function applyExerciseLoad(
  sets: WorkoutSet[],
  key: LoadKey,
): WorkoutSet[] {
  return sets.map((set) => withLoadKey(set, key));
}

/** Sets every unchecked set to the measure; seconds makes them bodyweight. */
export function applyExerciseCount(
  sets: WorkoutSet[],
  measure: Measure,
): WorkoutSet[] {
  return sets.map((set) => changeSetMeasure(set, measure));
}

export function allowedLoadKeys(measure: Measure): LoadKey[] {
  return measure === "seconds"
    ? ["bw", "bwplus"]
    : ["weight", "bw", "bwplus", "assisted"];
}
