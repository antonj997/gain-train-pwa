import { type RecordDoc, type WorkoutSet, validSet } from "./model";
import { isDrop } from "./drops";
import { completedWorkouts } from "./selectors";
import { hasExtraWeight } from "../lib/set-load";
import { cardioTotals, isCardioSet } from "../lib/cardio";
export function estimate(s: WorkoutSet) {
  return s.measure !== "seconds" &&
    s.measure !== "cardio" &&
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
export type CardioSession = {
  date: string;
  workoutId: string;
  durationSec: number;
  distanceM: number;
  calories: number;
};

/**
 * Cardio exercises with one entry per workout: the time, distance and calories
 * of its checked sets added up. Oldest session first; the exercise trained most
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

/** Points compare only within the same load, extra weight, section and measure. */
const profileKey = (set: WorkoutSet) =>
  [set.load, hasExtraWeight(set), set.section, set.measure ?? "reps"].join("|");

/**
 * Sessions that beat every earlier comparable session of the exercise by
 * estimated 1RM, oldest first. An exercise's first session is a starting point,
 * not a best. Drops never reach `progressFor`, so they cannot set one.
 * Takes `progressFor`'s result, so a page computes that once.
 */
export function bestEvents(progress: readonly ExerciseProgress[]) {
  const events: (ProgressPoint & {
    exerciseId: string;
    name: string;
    e1rm: number;
  })[] = [];
  for (const item of progress) {
    // The best earlier estimate per profile. A point with an estimate only
    // compares with earlier points that have one too (see comparableSets).
    const best = new Map<string, number>();
    for (const point of item.points) {
      if (point.e1rm === null) continue;
      const key = profileKey(point.set);
      const before = best.get(key);
      if (before !== undefined && point.e1rm > before)
        events.push({
          ...point,
          e1rm: point.e1rm,
          exerciseId: item.id,
          name: item.name,
        });
      best.set(key, Math.max(before ?? 0, point.e1rm));
    }
  }
  return events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );
}

/** Ids of the workouts that set a new best estimate for any exercise. */
export function newBestWorkoutIds(progress: readonly ExerciseProgress[]) {
  return new Set(bestEvents(progress).map((event) => event.workoutId));
}

/** The latest new best of each exercise set from `start` to `end`, newest first. */
export function recentBests(
  progress: readonly ExerciseProgress[],
  start: string,
  end: string,
  limit = 4,
) {
  const seen = new Set<string>();
  return bestEvents(progress)
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

/** A set that counts as a lift with a load: weighted, or bodyweight with added weight; reps, not time. */
const liftedLoad = (s: WorkoutSet): "weight" | "extra" | null =>
  s.measure === "seconds" || s.measure === "cardio" || !s.weight
    ? null
    : s.load === "weight"
      ? "weight"
      : hasExtraWeight(s)
        ? "extra"
        : null;

/**
 * The heaviest weight lifted in any completed set of an exercise: drops count,
 * warm-ups do not. A tie on weight goes to the set with the most reps, then
 * the most recent. Weighted sets and bodyweight sets with added weight are not
 * compared with each other: the kind of the latest such set decides. Null for
 * assisted, bodyweight-only, timed and cardio exercises.
 */
export function heaviestLift(records: RecordDoc[], exerciseId: string) {
  type Candidate = {
    set: WorkoutSet;
    date: string;
    workoutId: string;
    order: number;
    kind: "weight" | "extra";
  };
  const candidates: Candidate[] = [];
  let order = 0;
  // Oldest first, so `order` grows with time within a day too.
  for (const record of completedWorkouts(records).reverse()) {
    for (const exercise of record.payload.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;
      for (const set of exercise.sets) {
        order++;
        if (!set.done || set.section === "warmup" || !validSet(set)) continue;
        const kind = liftedLoad(set);
        if (!kind) continue;
        candidates.push({
          set,
          date: record.payload.date,
          workoutId: record.id,
          order,
          kind,
        });
      }
    }
  }
  if (!candidates.length) return null;
  const newer = (a: Candidate, b: Candidate) =>
    a.date.localeCompare(b.date) || a.order - b.order;
  const latest = candidates.reduce((a, b) => (newer(b, a) > 0 ? b : a));
  const best = candidates
    .filter((c) => c.kind === latest.kind)
    .reduce((a, b) => {
      const byWeight = (b.set.weight ?? 0) - (a.set.weight ?? 0);
      if (byWeight) return byWeight > 0 ? b : a;
      const byReps = (b.set.reps ?? 0) - (a.set.reps ?? 0);
      if (byReps) return byReps > 0 ? b : a;
      return newer(b, a) > 0 ? b : a;
    });
  return { set: best.set, date: best.date, workoutId: best.workoutId };
}
