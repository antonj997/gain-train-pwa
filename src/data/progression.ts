import {
  validSet,
  type Exercise,
  type Level,
  type ProgressionItem,
  type RecordDoc,
  type WorkoutSet,
} from "./model";
import { catalogueById } from "./catalogue";
import { isDrop } from "./drops";
import { completedWorkouts, customExercises } from "./selectors";
import { isCardioSet } from "../lib/cardio";
import { daysBetween, shiftDate } from "../lib/dates";
import { trendPerDay } from "../lib/goal-pace";
import { hasExtraWeight } from "../lib/set-load";
import {
  loadIncrement,
  suggestProgression,
  type ProgressionInput,
} from "../lib/progression";

type Records = Record<string, RecordDoc> | readonly RecordDoc[];
const list = (records: Records) =>
  Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);

/** An exercise's category and equipment: the catalogue's, or a custom exercise's. */
export function exerciseInfo(
  records: Records,
  exerciseId: string,
): { category?: string; categories?: string[]; equipment?: string } {
  const builtin = catalogueById.get(exerciseId);
  if (builtin) return builtin;
  const custom = customExercises(records).find((r) => r.id === exerciseId);
  return custom
    ? {
        category: custom.payload.category,
        categories: custom.payload.categories,
        equipment: custom.payload.equipment,
      }
    : {};
}

/** The equipment lookup the plan helpers take. */
export const equipmentLookup = (records: Records) => {
  const cache = new Map<string, string | undefined>();
  return (exerciseId: string) => {
    if (!cache.has(exerciseId))
      cache.set(exerciseId, exerciseInfo(records, exerciseId).equipment);
    return cache.get(exerciseId);
  };
};

export type DetectedLevel = {
  level: Level;
  /** Months since the first finished workout, whole. */
  months: number;
  sessions: number;
};

/**
 * The training level the log suggests. Beginner under six months of logged
 * training or 24 sessions; experienced from two years and 150 sessions;
 * intermediate between. Someone who trained before the app can change it.
 */
export function detectLevel(records: Records, today: string): DetectedLevel {
  const done = completedWorkouts(list(records));
  const first = done.at(-1)?.payload.date;
  const months = first ? Math.floor(daysBetween(first, today) / 30.44) : 0;
  const sessions = done.length;
  const level: Level =
    months < 6 || sessions < 24
      ? "beginner"
      : months >= 24 && sessions >= 150
        ? "experienced"
        : "intermediate";
  return { level, months, sessions };
}

/** A checked working set with a weight to count: not a warm-up, drop, hold or cardio. */
const countsForLoad = (set: WorkoutSet) =>
  set.done &&
  set.section === "working" &&
  !isDrop(set) &&
  !isCardioSet(set) &&
  set.measure !== "seconds" &&
  (set.load === "weight" || hasExtraWeight(set)) &&
  validSet(set) &&
  (set.weight ?? 0) > 0 &&
  (set.reps ?? 0) > 0;

export type StartEstimate = {
  kg: number;
  /** "set": the heaviest set at the reps or more; "e1rm": converted from the best estimated one-rep max. */
  from: "set" | "e1rm";
  /** The set it came from. */
  setKg: number;
  setReps: number;
  date: string;
};

/**
 * A start weight for `reps` from recent history: the heaviest checked working
 * set done for at least that many reps in the last four weeks; without one,
 * the best estimated one-rep max (Epley) converted to the reps and rounded
 * down to the equipment's step. Looks back twelve weeks when the last four
 * hold nothing. Null with no history.
 */
export function estimateStartLoad(
  records: Records,
  exerciseId: string,
  reps: number,
  today: string,
): StartEstimate | null {
  const equipment = exerciseInfo(records, exerciseId).equipment;
  const history = completedWorkouts(list(records));
  for (const days of [28, 84]) {
    const from = shiftDate(today, -days);
    const sets: { set: WorkoutSet; date: string }[] = [];
    for (const w of history) {
      if (w.payload.date < from || w.payload.date > today) continue;
      for (const ex of w.payload.exercises)
        if (ex.exerciseId === exerciseId)
          for (const set of ex.sets)
            if (countsForLoad(set)) sets.push({ set, date: w.payload.date });
    }
    if (!sets.length) continue;
    let direct: { set: WorkoutSet; date: string } | null = null;
    for (const s of sets)
      if (
        s.set.reps! >= reps &&
        (!direct ||
          s.set.weight! > direct.set.weight! ||
          (s.set.weight === direct.set.weight && s.date > direct.date))
      )
        direct = s;
    if (direct)
      return {
        kg: direct.set.weight!,
        from: "set",
        setKg: direct.set.weight!,
        setReps: direct.set.reps!,
        date: direct.date,
      };
    let best: { set: WorkoutSet; date: string; e1rm: number } | null = null;
    for (const s of sets) {
      const e1rm = s.set.weight! * (1 + Math.min(s.set.reps!, 12) / 30);
      if (!best || e1rm > best.e1rm) best = { ...s, e1rm };
    }
    const raw = best!.e1rm / (1 + reps / 30);
    const step = loadIncrement(equipment, raw);
    return {
      kg: Math.max(step, Math.floor(raw / step + 1e-9) * step),
      from: "e1rm",
      setKg: best!.set.weight!,
      setReps: best!.set.reps!,
      date: best!.date,
    };
  }
  return null;
}

/**
 * The lift's recent trend in kg a week: the slope of each session's heaviest
 * checked working set over the last six weeks (at least three sessions over
 * two weeks). Null when the log is too thin.
 */
export function recentTrend(
  records: Records,
  exerciseId: string,
  today: string,
): number | null {
  const points: { date: string; value: number }[] = [];
  for (const w of completedWorkouts(list(records))) {
    let best = 0;
    for (const ex of w.payload.exercises)
      if (ex.exerciseId === exerciseId)
        for (const set of ex.sets)
          if (countsForLoad(set)) best = Math.max(best, set.weight!);
    if (best > 0) points.push({ date: w.payload.date, value: best });
  }
  const perDay = trendPerDay(points, today);
  return perDay === null ? null : perDay * 7;
}

const mostCommon = (values: number[]) => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  for (const [v, n] of counts)
    if (
      best === null ||
      n > counts.get(best)! ||
      (n === counts.get(best) && v < best)
    )
      best = v;
  return best;
};

/** The reps a lift is planned for: the routine's working sets, else the last session's, else 8. */
export function defaultReps(
  records: Records,
  exerciseId: string,
  routineExercise?: Exercise,
) {
  const working = (sets: readonly WorkoutSet[]) =>
    sets
      .filter((s) => s.section === "working" && !isDrop(s) && (s.reps ?? 0) > 0)
      .map((s) => s.reps!);
  const fromRoutine =
    routineExercise && mostCommon(working(routineExercise.sets));
  if (fromRoutine) return fromRoutine;
  for (const w of completedWorkouts(list(records)))
    for (const ex of w.payload.exercises)
      if (ex.exerciseId === exerciseId) {
        const reps = mostCommon(working(ex.sets.filter((s) => s.done)));
        if (reps) return reps;
      }
  return 8;
}

/** True when a routine's exercise can be progressed by weight: not cardio, timed or bodyweight only. */
export function progressable(ex: Exercise) {
  if (!ex.sets.length) return true;
  return ex.sets.some(
    (s) =>
      !isCardioSet(s) &&
      s.measure !== "seconds" &&
      (s.load === "weight" || hasExtraWeight(s)),
  );
}

type PhaseShape = Pick<ProgressionInput, "weeks" | "deloadWeeks" | "cycle">;

/**
 * A new progression row with suggested values: reps from the routine or the
 * log, the start from history (or the routine's planned weight; 0 when there
 * is neither, for the user to enter), the level from the log and the target
 * at the reasonable rate.
 */
export function newProgressionItem(
  records: Records,
  exercise: { id: string; name: string },
  phase: PhaseShape,
  today: string,
  routineExercise?: Exercise,
): ProgressionItem {
  const reps = defaultReps(records, exercise.id, routineExercise);
  const estimate = estimateStartLoad(records, exercise.id, reps, today);
  const planned = routineExercise?.sets.find(
    (s) => s.section === "working" && !isDrop(s) && (s.weight ?? 0) > 0,
  )?.weight;
  const startKg = estimate?.kg ?? planned ?? 0;
  const { level } = detectLevel(records, today);
  const info = exerciseInfo(records, exercise.id);
  const targetKg =
    startKg > 0
      ? suggestProgression({
          exercise: info,
          startKg,
          reps,
          level,
          equipment: info.equipment,
          trendKgPerWeek: recentTrend(records, exercise.id, today),
          ...phase,
        }).suggestedTargetKg
      : 0;
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    reps,
    startKg,
    targetKg,
    level,
  };
}
