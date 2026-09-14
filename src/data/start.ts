import {
  type Exercise,
  type RecordDoc,
  type Workout,
  newSet,
  repeatExercises,
} from "./model";

export function suggestedExercises(items: Exercise[], records: RecordDoc[]) {
  const history = records
    .filter(
      (r) =>
        r.kind === "workout" &&
        !r.deleted &&
        (r.payload as Workout).status === "completed",
    )
    .sort((a, b) =>
      (b.payload as Workout).date.localeCompare((a.payload as Workout).date),
    );
  return repeatExercises(items).map((ex) => {
    const last = history
      .flatMap((r) => (r.payload as Workout).exercises)
      .find((e) => e.exerciseId === ex.exerciseId);
    if (!last) return ex;
    return {
      ...ex,
      sets: ex.sets.map((set, index) => newSet(last.sets[index] ?? set)),
    };
  });
}
