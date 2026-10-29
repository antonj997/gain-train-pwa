import {
  newSet,
  validSet,
  type Exercise,
  type RecordDoc,
  type WorkoutRecord,
  type WorkoutSet,
} from "./model";
import { catalogueById } from "./catalogue";
import { dropGroup, isDrop } from "./drops";
import { completedWorkouts, sortWorkoutsNewest } from "./selectors";
import { hasExtraWeight } from "../lib/set-load";

/**
 * A new exercise's first set. A catalogue exercise knows its own category; a
 * custom exercise passes the category it was saved with.
 */
export function initialSet(exerciseId: string, category?: string): WorkoutSet {
  const defaults = catalogueById.get(exerciseId);
  if (defaults?.measure === "cardio" || category === "Cardio")
    return { ...newSet(), measure: "cardio" };
  return {
    ...newSet(),
    load: defaults?.load ?? "weight",
    ...(defaults?.measure === "seconds" ? { measure: "seconds" as const } : {}),
  };
}

export function hasLoggedExercise(ex: Exercise) {
  return ex.sets.some(
    (set) =>
      set.done ||
      set.reps !== null ||
      set.weight !== null ||
      [set.durationSec, set.distanceM, set.level, set.calories].some(
        (value) => value !== null && value !== undefined,
      ),
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

/** Position among earlier sets with the same profile. Drops are not counted. */
export function setProfileOrdinal(sets: WorkoutSet[], index: number) {
  return sets
    .slice(0, index)
    .filter((set) => !isDrop(set) && setProfileMatches(set, sets[index]))
    .length;
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

/**
 * What this row did last time. A set is matched among the earlier session's
 * sets, ignoring its drops. A drop is matched to the drop at the same position
 * after that set's result, or the last one if there are fewer.
 */
export function previousResult(
  prior: WorkoutSet[],
  sets: WorkoutSet[],
  index: number,
): WorkoutSet | undefined {
  const current = sets[index];
  if (!isDrop(current))
    return previousSetFor(
      prior.filter((set) => !isDrop(set)),
      current,
      setProfileOrdinal(sets, index),
    );
  const { start } = dropGroup(sets, index);
  // A drop with no set above it (older app versions) has nothing to follow.
  if (isDrop(sets[start])) return undefined;
  const parent = previousResult(prior, sets, start);
  if (!parent) return undefined;
  const parentIndex = prior.indexOf(parent);
  const drops = prior
    .slice(parentIndex + 1, dropGroup(prior, parentIndex).end)
    .filter((set) => set.done && validSet(set));
  return drops[index - start - 1] ?? drops.at(-1);
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
