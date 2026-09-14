import {
  type RecordDoc,
  type Workout,
  type WorkoutSet,
  validSet,
} from "./model";
export function estimate(s: WorkoutSet) {
  return s.load === "weight" && s.weight && s.reps && s.reps <= 10
    ? s.weight * (1 + s.reps / 30)
    : null;
}
export function progressFor(records: RecordDoc[]) {
  const map = new Map<
    string,
    {
      name: string;
      points: { date: string; set: WorkoutSet; e1rm: number | null }[];
    }
  >();
  for (const record of records) {
    if (record.kind !== "workout" || record.deleted) continue;
    const w = record.payload as Workout;
    if (w.status !== "completed") continue;
    for (const ex of w.exercises) {
      const sets = ex.sets.filter(
        (s) => s.done && s.section === "working" && validSet(s),
      );
      if (!sets.length) continue;
      const top = [...sets].sort(
        (a, b) => (estimate(b) ?? b.reps ?? 0) - (estimate(a) ?? a.reps ?? 0),
      )[0];
      const item = map.get(ex.exerciseId) ?? { name: ex.name, points: [] };
      item.points.push({ date: w.date, set: top, e1rm: estimate(top) });
      map.set(ex.exerciseId, item);
    }
  }
  return [...map.entries()]
    .map(([id, x]) => ({
      id,
      ...x,
      points: x.points.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort(
      (a, b) =>
        b.points.at(-1)!.date.localeCompare(a.points.at(-1)!.date) ||
        a.name.localeCompare(b.name),
    );
}
export function baseline(
  points: { date: string; e1rm: number | null }[],
  cutoff: string,
) {
  return (
    points.filter((p) => p.date <= cutoff && p.e1rm !== null).at(-1)?.e1rm ??
    null
  );
}
