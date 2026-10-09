import {
  newSet,
  validSet,
  type Exercise,
  type RecordDoc,
  type Workout,
  type WorkoutSet,
} from "./model";

const sessionTime = (workout: Workout) =>
  workout.completedAt ?? workout.startedAt ?? workout.createdAt ?? 0;

export function sortWorkoutsNewest(a: RecordDoc, b: RecordDoc) {
  const left = a.payload as Workout;
  const right = b.payload as Workout;
  return (
    right.date.localeCompare(left.date) ||
    sessionTime(right) - sessionTime(left) ||
    b.id.localeCompare(a.id)
  );
}

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
    left.section === right.section &&
    (left.measure ?? "reps") === (right.measure ?? "reps")
  );
}

export function setProfileOrdinal(sets: WorkoutSet[], index: number) {
  return sets
    .slice(0, index)
    .filter((set) => setProfileMatches(set, sets[index])).length;
}

export function priorWorkouts(
  records: RecordDoc[],
  current: RecordDoc,
  date: string,
) {
  const editingCompleted = (current.payload as Workout).status === "completed";
  return records
    .filter(
      (record) =>
        record.id !== current.id &&
        !record.deleted &&
        record.kind === "workout" &&
        (record.payload as Workout).status === "completed" &&
        (record.payload as Workout).date <= date &&
        (!editingCompleted || sortWorkoutsNewest(record, current) > 0),
    )
    .sort(sortWorkoutsNewest);
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
