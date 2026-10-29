import { dropGroup, isDrop } from "../data/drops";
import {
  hasLoggedExercise,
  initialSet,
  type ExerciseDefaults,
} from "../data/workouts";
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
import { CARDIO_MAX, isCardioSet } from "./cardio";
import { getSetInputText } from "./set-input";
import { toggleSetCompletion } from "./set-editing";

export type SetIssues = Partial<
  Record<
    "weight" | "reps" | "durationSec" | "distanceM" | "level" | "calories",
    string
  >
>;

function getCardioIssues(set: WorkoutSet): SetIssues {
  const issues: SetIssues = {};
  const bad = (value: number | null | undefined, max: number, min = 0) =>
    value !== null &&
    value !== undefined &&
    (!Number.isFinite(value) || value < min || value > max);
  if (set.durationSec === null || set.durationSec === undefined)
    issues.durationSec = "Enter a time to complete this set.";
  else if (bad(set.durationSec, CARDIO_MAX.durationSec, 1))
    issues.durationSec = "Enter a time from 0:01 to 24:00:00.";
  if (bad(set.distanceM, CARDIO_MAX.distanceM))
    issues.distanceM = "Enter a distance from 0 to 1,000 km.";
  if (bad(set.level, CARDIO_MAX.level))
    issues.level = "Enter a level from 0 to 100.";
  if (bad(set.calories, CARDIO_MAX.calories))
    issues.calories = "Enter calories from 0 to 100,000.";
  // Text that is not a number yet ("20:", "3.") is not a value either.
  if (getSetInputText(set, "durationSec") !== undefined)
    issues.durationSec = "Enter a time like 20:00, or minutes like 20.";
  if (getSetInputText(set, "distanceM") !== undefined)
    issues.distanceM = "Enter a distance from 0 to 1,000 km.";
  if (getSetInputText(set, "level") !== undefined)
    issues.level = "Enter a level from 0 to 100.";
  if (getSetInputText(set, "calories") !== undefined)
    issues.calories = "Enter calories from 0 to 100,000.";
  return issues;
}

export function getSetIssues(set: WorkoutSet): SetIssues {
  if (set.measure === "cardio") return getCardioIssues(set);
  const issues: SetIssues = {};
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

/** True when the set and each of its drops have values that can be checked. */
export function groupComplete(sets: WorkoutSet[], index: number) {
  const { start, end } = dropGroup(sets, index);
  return sets.slice(start, end).every(validSet);
}

/**
 * Checks or unchecks a set together with its drops: the set decides, and every
 * drop follows it, even a drop an older app version left in the other state.
 * A set can only be checked once each of its drops is complete.
 */
export function toggleGroupCompletion(
  sets: WorkoutSet[],
  setId: string,
  profileWeight: number | null,
): WorkoutSet[] {
  const index = sets.findIndex((set) => set.id === setId);
  if (index < 0) return sets;
  const { start, end } = dropGroup(sets, index);
  const done = !sets[start].done;
  if (done && !groupComplete(sets, start)) return sets;
  return sets.map((set, i) =>
    i >= start && i < end && set.done !== done
      ? toggleSetCompletion(set, profileWeight)
      : set,
  );
}

/**
 * A new unchecked set like the last one that is not a drop. With no set left
 * it starts from the exercise's own defaults; `custom` holds a custom
 * exercise's saved ones (the catalogue knows its own).
 */
export function appendSet(
  exercise: Exercise,
  custom?: ExerciseDefaults,
): Exercise {
  const prior = exercise.sets.filter((set) => !isDrop(set)).at(-1);
  return {
    ...exercise,
    sets: [
      ...exercise.sets,
      prior ? newSet(prior) : initialSet(exercise.exerciseId, custom),
    ],
  };
}

/** A routine's exercise as planned: a planned set is never checked, even one saved that way earlier. */
export function withoutChecks(exercise: Exercise): Exercise {
  if (!exercise.sets.some((s) => s.done)) return exercise;
  return {
    ...exercise,
    sets: exercise.sets.map((s) =>
      s.done ? { ...s, done: false, bodyWeightKg: undefined } : s,
    ),
  };
}

/** The exercise a card is changed to, with a custom exercise's own defaults. */
export type ExerciseTarget = { id: string; name: string } & ExerciseDefaults;

/** True when the sets of the card's current exercise don't fit the target (strength vs cardio). */
export function changeDiscardsSets(
  exercise: Exercise,
  target: ExerciseTarget,
): boolean {
  const toCardio = isCardioSet(initialSet(target.id, target));
  return exercise.sets.some(isCardioSet) !== toCardio;
}

/** How many sets have entered values or are checked, and so would be lost. */
export function loggedSetCount(exercise: Exercise): number {
  return exercise.sets.filter((set) =>
    hasLoggedExercise({ ...exercise, sets: [set] }),
  ).length;
}

/**
 * The card with another exercise, keeping its own id. The same kind of
 * exercise (strength or cardio) keeps every set as it is; another kind gets
 * the same number of fresh, empty, unchecked sets, and its drops are dropped.
 */
export function changeExercise(
  exercise: Exercise,
  target: ExerciseTarget,
): Exercise {
  const base = { ...exercise, exerciseId: target.id, name: target.name };
  if (!changeDiscardsSets(exercise, target)) return base;
  const count = Math.max(1, exercise.sets.filter((set) => !isDrop(set)).length);
  return {
    ...base,
    sets: Array.from({ length: count }, () => initialSet(target.id, target)),
  };
}
