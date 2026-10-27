import { type RecordDoc, type WorkoutSet, validSet } from "./model";
import { completedWorkouts } from "./selectors";
import { hasExtraWeight } from "../lib/set-load";
export function estimate(s: WorkoutSet) {
  return s.measure !== "seconds" &&
    validSet(s) &&
    s.load === "weight" &&
    s.weight &&
    s.reps &&
    s.reps <= 10
    ? s.weight * (1 + s.reps / 30)
    : null;
}
export function comparableSets(a: WorkoutSet, b: WorkoutSet) {
  if (
    a.load !== b.load ||
    hasExtraWeight(a) !== hasExtraWeight(b) ||
    a.section !== b.section ||
    (a.measure ?? "reps") !== (b.measure ?? "reps")
  )
    return false;
  const aEstimate = estimate(a),
    bEstimate = estimate(b);
  return aEstimate !== null || bEstimate !== null
    ? aEstimate !== null && bEstimate !== null
    : (a.load === "bodyweight" && !hasExtraWeight(a)) || a.weight === b.weight;
}
export function progressFor(records: RecordDoc[]) {
  const map = new Map<
    string,
    {
      name: string;
      points: {
        date: string;
        workoutId: string;
        set: WorkoutSet;
        e1rm: number | null;
      }[];
    }
  >();
  for (const record of completedWorkouts(records).reverse()) {
    const w = record.payload;
    const grouped = new Map<string, { name: string; sets: WorkoutSet[] }>();
    for (const ex of w.exercises) {
      const group = grouped.get(ex.exerciseId) ?? { name: ex.name, sets: [] };
      group.sets.push(...ex.sets);
      grouped.set(ex.exerciseId, group);
    }
    for (const [exerciseId, ex] of grouped) {
      const sets = ex.sets.filter(
        (s) => s.done && s.section === "working" && validSet(s),
      );
      if (!sets.length) continue;
      const latestProfile = sets.at(-1)!;
      const top = sets
        .filter((s) => comparableSets(s, latestProfile))
        .sort(
          (a, b) => (estimate(b) ?? b.reps ?? 0) - (estimate(a) ?? a.reps ?? 0),
        )[0];
      const item = map.get(exerciseId) ?? { name: ex.name, points: [] };
      item.name = ex.name;
      item.points.push({
        date: w.date,
        workoutId: record.id,
        set: top,
        e1rm: estimate(top),
      });
      map.set(exerciseId, item);
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
