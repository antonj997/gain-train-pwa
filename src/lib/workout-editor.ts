import {
  newSet,
  today,
  validSet,
  validate,
  RecordValidationError,
  type Exercise,
  type Workout,
  type WorkoutSet,
} from "../data/model";
import { hasExtraWeight } from "./set-load";
import { getSetInputText } from "./set-input";

export function getSetIssues(set: WorkoutSet): {
  weight?: string;
  reps?: string;
} {
  const issues: { weight?: string; reps?: string } = {};
  const unit = set.measure === "seconds" ? "seconds" : "reps";
  if (set.reps === null) issues.reps = `Enter ${unit} to complete this set.`;
  else if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > 10000)
    issues.reps = `Enter whole ${unit} from 1 to 10,000.`;
  if (hasExtraWeight(set)) {
    if (set.weight === null)
      issues.weight = "Enter added kg to complete this set.";
    else if (
      !Number.isFinite(set.weight) ||
      set.weight <= 0 ||
      set.weight > 10000
    )
      issues.weight = "Enter added weight greater than 0 and up to 10,000 kg.";
  } else if (set.load !== "bodyweight") {
    if (set.weight === null)
      issues.weight = "Enter kg, or choose Bodyweight above.";
    else if (
      !Number.isFinite(set.weight) ||
      set.weight < 0 ||
      set.weight > 10000
    )
      issues.weight = "Enter a weight from 0 to 10,000 kg.";
  }
  if (getSetInputText(set, "reps") !== undefined)
    issues.reps = `Enter whole ${unit} from 1 to 10,000.`;
  if (getSetInputText(set, "weight") !== undefined)
    issues.weight = "Enter a weight from 0 to 10,000 kg.";
  return issues;
}

/** The date input's max only limits its picker; typed or pasted dates need this too. */
export function assertNotFuture(workout: Workout) {
  if (workout.date > today())
    throw new RecordValidationError("Choose today or an earlier date.");
}

// Fields a save adds, so they don't count as someone else's edit.
const savedOnly = new Set(["schemaVersion", "createdAt", "completedAt"]);
const canonical = (value: unknown, top = false): unknown =>
  Array.isArray(value)
    ? value.map((item) => canonical(item))
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => !(top && savedOnly.has(key)))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
/** Compares what a person entered, ignoring key order and save timestamps. */
export const workoutContentKey = (workout: Workout) =>
  JSON.stringify(canonical(workout, true));

export function finishWorkout(workout: Workout, now = Date.now()): Workout {
  assertNotFuture(workout);
  if (
    workout.exercises.some((ex) =>
      ex.sets.some((set) => set.done && !validSet(set)),
    )
  )
    throw Error("Correct the checked sets, or uncheck them before saving.");
  const result: Workout = {
    ...workout,
    status: "completed",
    completedAt:
      workout.status === "completed"
        ? workout.completedAt
        : (workout.completedAt ?? now),
    duration:
      workout.duration ??
      (workout.status !== "completed" && workout.startedAt
        ? Math.min(
            1440,
            Math.max(0, Math.floor((now - workout.startedAt) / 60000)),
          )
        : null),
    exercises: workout.exercises
      .map((ex) => ({
        ...ex,
        sets: ex.sets.filter((set) => set.done && validSet(set)),
      }))
      .filter((ex) => ex.sets.length > 0),
  };
  return validate("workout", result);
}

export function resizePlannedSets(exercise: Exercise, count: number): Exercise {
  if (!Number.isInteger(count) || count < 1 || count > 100) return exercise;
  const sets = exercise.sets.slice(0, count);
  while (sets.length < count) sets.push(newSet(sets.at(-1)));
  return { ...exercise, sets };
}
