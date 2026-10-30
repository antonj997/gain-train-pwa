import {
  validSet,
  type ExerciseRecord,
  type RecordDoc,
  type RoutineRecord,
  type Workout,
  type WorkoutRecord,
} from "./model";
import { isDrop } from "./drops";
import { t } from "../i18n";

type Records = Record<string, RecordDoc> | readonly RecordDoc[];
const list = (records: Records) =>
  Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);

const isWorkout = (record: RecordDoc): record is WorkoutRecord =>
  record.kind === "workout";

const sessionTime = (workout: Workout) =>
  workout.completedAt ?? workout.startedAt ?? workout.createdAt ?? 0;
/** Newest date first; same-day sessions by finish or start time, then id. */
export function sortWorkoutsNewest(a: WorkoutRecord, b: WorkoutRecord) {
  return (
    b.payload.date.localeCompare(a.payload.date) ||
    sessionTime(b.payload) - sessionTime(a.payload) ||
    b.id.localeCompare(a.id)
  );
}

/** Workouts that are not deleted, newest first, optionally of one status. */
export function workouts(records: Records, status?: Workout["status"]) {
  return list(records)
    .filter(
      (record): record is WorkoutRecord =>
        isWorkout(record) &&
        !record.deleted &&
        (!status || record.payload.status === status),
    )
    .sort(sortWorkoutsNewest);
}
/**
 * Started drafts, the most recently started first. Only one can be started on
 * this phone, but sync can bring another from a second device; the first one is
 * the running workout and the others are offered to resume or abandon.
 */
export const runningWorkouts = (records: Records) =>
  workouts(records, "draft")
    .filter((record) => record.payload.startedAt !== null)
    .sort(
      (a, b) =>
        b.payload.startedAt! - a.payload.startedAt! || b.id.localeCompare(a.id),
    );
export const completedWorkouts = (records: Records) =>
  workouts(records, "completed");
export const draftWorkouts = (records: Records) => workouts(records, "draft");

export const routines = (records: Records) =>
  list(records).filter(
    (record): record is RoutineRecord =>
      record.kind === "routine" && !record.deleted,
  );

export const customExercises = (records: Records) =>
  list(records).filter(
    (record): record is ExerciseRecord =>
      record.kind === "exercise" && !record.deleted,
  );

/** Each custom exercise's saved defaults, by id, for sets added from scratch. */
export const customDefaults = (records: Records) =>
  new Map(
    customExercises(records).map(({ id, payload }) => [
      id,
      {
        category: payload.category,
        load: payload.load,
        measure: payload.measure,
      },
    ]),
  );

type HasSets = Pick<Workout, "exercises">;
/** Checked sets that would be saved: done and valid. A set and its drops count as one. */
export const doneSetCount = ({ exercises }: HasSets) =>
  exercises.reduce(
    (n, ex) =>
      n + ex.sets.filter((s) => !isDrop(s) && s.done && validSet(s)).length,
    0,
  );
/** Planned or logged sets. A set and its drops count as one. */
export const setCount = ({ exercises }: HasSets) =>
  exercises.reduce((n, ex) => n + ex.sets.filter((s) => !isDrop(s)).length, 0);

/** The first unchecked set of a workout, such as "Bench Press set 3". */
export function nextSetLabel({ exercises }: HasSets) {
  for (const exercise of exercises) {
    let number = 0;
    for (const set of exercise.sets) {
      if (isDrop(set)) continue;
      number++;
      if (!set.done)
        return t("badge.nextSet", { exercise: exercise.name, n: number });
    }
  }
  return null;
}
