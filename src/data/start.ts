import {
  type Exercise,
  type RecordDoc,
  type Workout,
  newSet,
  repeatExercises,
} from "./model";
import {
  previousSetFor,
  sortWorkoutsNewest,
  setProfileOrdinal,
} from "./workouts";

export function suggestedExercises(items: Exercise[], records: RecordDoc[]) {
  const history = records
    .filter(
      (r) =>
        r.kind === "workout" &&
        !r.deleted &&
        (r.payload as Workout).status === "completed",
    )
    .sort(sortWorkoutsNewest);
  return repeatExercises(items).map((ex) => {
    const lastSession = history.find((r) =>
      (r.payload as Workout).exercises.some(
        (e) => e.exerciseId === ex.exerciseId && e.sets.some((s) => s.done),
      ),
    );
    if (!lastSession) return ex;
    const prior = (lastSession.payload as Workout).exercises
      .filter((e) => e.exerciseId === ex.exerciseId)
      .flatMap((e) => e.sets);
    return {
      ...ex,
      sets: ex.sets.map((set, index) => {
        const ordinal = setProfileOrdinal(ex.sets, index);
        const previous = previousSetFor(prior, set, ordinal);
        return newSet(
          previous
            ? { ...set, reps: previous.reps, weight: previous.weight }
            : set,
        );
      }),
    };
  });
}
