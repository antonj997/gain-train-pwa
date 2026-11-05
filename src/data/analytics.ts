import { type RecordDoc, type WorkoutSet, validSet } from "./model";
import { isDrop } from "./drops";
import { completedWorkouts } from "./selectors";
import { hasExtraWeight } from "../lib/set-load";
import { cardioTotals, isCardioSet, type CardioTotals } from "../lib/cardio";
import { estimate } from "./estimate";
import { exerciseRecords, type ExercisePr } from "./exercise-records";
export { estimate };
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
      // A drop continues the set above it, so it is never a session's best set.
      // Cardio has no best set: it is listed by cardioProgressFor instead.
      const sets = ex.sets.filter(
        (s) =>
          s.done &&
          s.section === "working" &&
          !isDrop(s) &&
          !isCardioSet(s) &&
          validSet(s),
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
/** One workout's checked sets of a cardio exercise, added up (see cardioTotals). */
export type CardioSession = {
  date: string;
  workoutId: string;
} & CardioTotals;

/**
 * Cardio exercises with one entry per workout: the time, distance and calories
 * of its checked sets added up, with average heart rate and incline. Oldest session first; the exercise trained most
 * recently comes first.
 */
export function cardioProgressFor(records: RecordDoc[]) {
  const map = new Map<string, { name: string; sessions: CardioSession[] }>();
  for (const record of completedWorkouts(records).reverse()) {
    const w = record.payload;
    const grouped = new Map<string, { name: string; sets: WorkoutSet[] }>();
    for (const ex of w.exercises) {
      const sets = ex.sets.filter(
        (s) => isCardioSet(s) && s.done && validSet(s),
      );
      if (!sets.length) continue;
      const group = grouped.get(ex.exerciseId) ?? { name: ex.name, sets: [] };
      group.sets.push(...sets);
      grouped.set(ex.exerciseId, group);
    }
    for (const [exerciseId, group] of grouped) {
      const item = map.get(exerciseId) ?? { name: group.name, sessions: [] };
      item.name = group.name;
      item.sessions.push({
        date: w.date,
        workoutId: record.id,
        ...cardioTotals(group.sets),
      });
      map.set(exerciseId, item);
    }
  }
  return [...map.entries()]
    .map(([id, x]) => ({
      id,
      ...x,
      sessions: x.sessions.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort(
      (a, b) =>
        b.sessions.at(-1)!.date.localeCompare(a.sessions.at(-1)!.date) ||
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

/** One exercise's progress: its best working set per session, oldest first. */
export type ExerciseProgress = ReturnType<typeof progressFor>[number];
type Progress = ExerciseProgress;
type ProgressPoint = Progress["points"][number];

/** Ids of the workouts that set a PR for any exercise (see prEvents). */
export function newBestWorkoutIds(events: readonly ExercisePr[]) {
  return new Set(events.map((event) => event.workoutId));
}

/** The latest PR of each exercise set from `start` to `end`, newest first. */
export function recentBests(
  events: readonly ExercisePr[],
  start: string,
  end: string,
  limit = 4,
) {
  const seen = new Set<string>();
  return events
    .filter((event) => event.date >= start && event.date <= end)
    .reverse()
    .filter(
      (event) => !seen.has(event.exerciseId) && seen.add(event.exerciseId),
    )
    .slice(0, limit);
}

/**
 * What an exercise row and its detail show: the latest result, the earlier
 * sessions that compare with it, and the best of those.
 */
export function exerciseStats(item: Progress) {
  const latest = item.points.at(-1)!;
  const weighted = latest.e1rm !== null;
  const timed = latest.set.measure === "seconds";
  const comparable = item.points.filter((point) =>
    comparableSets(point.set, latest.set),
  );
  const valueOf = (point: ProgressPoint) =>
    weighted ? point.e1rm! : (point.set.reps ?? 0);
  const best = comparable.reduce(
    (top, point) => (valueOf(point) >= valueOf(top) ? point : top),
    latest,
  );
  return { latest, weighted, timed, comparable, valueOf, best };
}

/**
 * Points for an SVG polyline that draws `values` left to right, scaled to the
 * box with a margin so the stroke is not clipped. One value, or values that are
 * all equal, make a flat line through the middle.
 */
export function sparklinePoints(
  values: number[],
  width = 64,
  height = 28,
  margin = 2,
) {
  if (!values.length) return "";
  if (values.length === 1) values = [values[0], values[0]];
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const step = (width - 2 * margin) / (values.length - 1);
  const round = (n: number) => Number(n.toFixed(1));
  return values
    .map((value, i) => {
      const y = span
        ? margin + (1 - (value - min) / span) * (height - 2 * margin)
        : height / 2;
      return `${round(margin + i * step)},${round(y)}`;
    })
    .join(" ");
}

/**
 * The heaviest weight lifted in any completed set of an exercise: drops count,
 * warm-ups do not. A tie on weight goes to the set with the most reps, then
 * the most recent. Weighted sets and bodyweight sets with added weight are not
 * compared with each other: the kind of the latest such set decides. Null for
 * assisted, bodyweight-only, timed and cardio exercises. The rule lives in
 * exercise-records.ts, so Progress and the exercise's Records agree.
 */
export function heaviestLift(records: RecordDoc[], exerciseId: string) {
  return exerciseRecords(records, exerciseId).heaviest;
}
