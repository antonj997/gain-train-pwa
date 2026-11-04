import { type WorkoutSet, validSet } from "./model";

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
