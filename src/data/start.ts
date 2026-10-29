import {
  type Exercise,
  type RecordDoc,
  type RoutineRecord,
  type Workout,
  newSet,
  repeatExercises,
  today,
} from "./model";
import { previousResult } from "./workouts";
import { completedWorkouts } from "./selectors";
import { autoWorkoutName } from "../lib/workout-name";

export function suggestedExercises(items: Exercise[], records: RecordDoc[]) {
  const history = completedWorkouts(records);
  return repeatExercises(items).map((ex) => {
    const lastSession = history.find((r) =>
      r.payload.exercises.some(
        (e) => e.exerciseId === ex.exerciseId && e.sets.some((s) => s.done),
      ),
    );
    if (!lastSession) return ex;
    const prior = lastSession.payload.exercises
      .filter((e) => e.exerciseId === ex.exerciseId)
      .flatMap((e) => e.sets);
    return {
      ...ex,
      sets: ex.sets.map((set, index) => {
        const previous = previousResult(prior, ex.sets, index);
        return newSet(
          previous
            ? { ...set, reps: previous.reps, weight: previous.weight }
            : set,
        );
      }),
    };
  });
}

/**
 * A new draft: blank, or from a routine with the last results suggested.
 * `past` logs an earlier session, so no timer starts.
 */
export function newWorkout(
  records: RecordDoc[],
  { routine, past = false }: { routine?: RoutineRecord; past?: boolean } = {},
  now = Date.now(),
): Workout {
  return {
    routineId: routine?.id,
    name: autoWorkoutName(
      { name: "", exercises: [] },
      { routine: routine?.payload.name },
    ),
    date: today(),
    duration: null,
    startedAt: past ? null : now,
    createdAt: now,
    status: "draft",
    exercises: routine
      ? suggestedExercises(routine.payload.exercises, records)
      : [],
  };
}
