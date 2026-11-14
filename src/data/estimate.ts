import { type WorkoutSet, validSet } from "./model";
import { hasExtraWeight } from "../lib/set-load";

/** Estimated one-rep max (Epley) of a weighted set of at most 10 reps, in kg; otherwise null. */
export function estimate(s: WorkoutSet) {
  return s.measure !== "seconds" &&
    s.measure !== "cardio" &&
    validSet(s) &&
    s.load === "weight" &&
    s.weight &&
    s.reps &&
    s.reps <= 10
    ? s.weight * (1 + s.reps / 30)
    : null;
}

/**
 * Estimated one-rep max (Epley, at most 10 reps) of the whole load a set
 * moved, in kg: a weighted set's weight, or for a bodyweight set the
 * bodyweight logged with it plus any added weight, minus any assistance.
 * Null for a bodyweight set logged without a bodyweight, so sessions with
 * different added weight can be compared only once the bodyweight is known.
 */
export function loadEstimate(s: WorkoutSet) {
  const weighted = estimate(s);
  if (weighted !== null) return weighted;
  const body = s.bodyWeightKg;
  if (
    !body ||
    s.measure === "seconds" ||
    s.measure === "cardio" ||
    !validSet(s) ||
    !s.reps ||
    s.reps > 10
  )
    return null;
  const total =
    s.load === "bodyweight"
      ? body + (hasExtraWeight(s) ? (s.weight ?? 0) : 0)
      : s.load === "assisted"
        ? body - (s.weight ?? 0)
        : 0;
  return total > 0 ? total * (1 + s.reps / 30) : null;
}

/** A load that is the lifter's own body: plain, with added weight, or assisted. */
export const isBodyLoad = (s: WorkoutSet) =>
  s.load === "bodyweight" || s.load === "assisted";
