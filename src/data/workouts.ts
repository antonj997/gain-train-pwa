import {
  newSet,
  validSet,
  type Exercise,
  type RecordDoc,
  type WorkoutRecord,
  type WorkoutSet,
} from "./model";
import { completedWorkouts, sortWorkoutsNewest } from "./selectors";
import { hasExtraWeight } from "../lib/set-load";

const bodyweightExercises = new Set([
  "builtin:pull-up",
  "builtin:chin-up",
  "builtin:push-up",
  "builtin:dip",
  "builtin:tricep-dip",
  "builtin:hyperextension",
  "builtin:glute-bridge",
  "builtin:plank",
  "builtin:side-plank",
  "builtin:ab-wheel",
  "builtin:hanging-leg-raise",
]);

export function initialSet(exerciseId: string): WorkoutSet {
  return {
    ...newSet(),
    load: bodyweightExercises.has(exerciseId) ? "bodyweight" : "weight",
    ...(exerciseId === "builtin:plank" || exerciseId === "builtin:side-plank"
      ? { measure: "seconds" as const }
      : {}),
  };
}

export function hasLoggedExercise(ex: Exercise) {
  return ex.sets.some(
    (set) => set.done || set.reps !== null || set.weight !== null,
  );
}

export function setProfileMatches(left: WorkoutSet, right: WorkoutSet) {
  return (
    left.load === right.load &&
    hasExtraWeight(left) === hasExtraWeight(right) &&
    (!hasExtraWeight(left) || left.weight === right.weight) &&
    left.section === right.section &&
    (left.measure ?? "reps") === (right.measure ?? "reps")
  );
}

export function setProfileOrdinal(sets: WorkoutSet[], index: number) {
  return sets
    .slice(0, index)
    .filter((set) => setProfileMatches(set, sets[index])).length;
}

/** Completed sessions before this one, newest first, for previous-result hints. */
export function priorWorkouts(
  records: RecordDoc[],
  current: WorkoutRecord,
  date: string,
) {
  const editingCompleted = current.payload.status === "completed";
  return completedWorkouts(records).filter(
    (record) =>
      record.id !== current.id &&
      record.payload.date <= date &&
      (!editingCompleted || sortWorkoutsNewest(record, current) > 0),
  );
}

export function previousSetFor(
  prior: WorkoutSet[],
  current: WorkoutSet,
  index: number,
) {
  const matches = (set: WorkoutSet) =>
    set.done && validSet(set) && setProfileMatches(set, current);
  const matching = prior.filter(matches);
  return matching[index] ?? matching.at(-1);
}

export type LastSession = { date: string; sets: WorkoutSet[] };
/**
 * The most recent session per exercise that has a completed set, from
 * newest-first history. Built once so set rows don't each rescan history.
 */
export function lastSessions(history: WorkoutRecord[]) {
  const sessions = new Map<string, LastSession>();
  for (const { payload } of history)
    for (const exercise of payload.exercises)
      if (
        !sessions.has(exercise.exerciseId) &&
        exercise.sets.some((s) => s.done && validSet(s))
      )
        sessions.set(exercise.exerciseId, {
          date: payload.date,
          sets: exercise.sets,
        });
  return sessions;
}
