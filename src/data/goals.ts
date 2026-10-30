import { validSet, type Goal, type RecordDoc, type WorkoutSet } from "./model";
import { estimate } from "./analytics";
import { isDrop } from "./drops";
import { completedWorkouts } from "./selectors";
import { isCardioSet } from "../lib/cardio";
import { daysBetween, isoDate } from "../lib/dates";
import {
  type Deadline,
  type GoalPoint,
  type Pace,
  deadline,
  goalPace,
  projectedDate,
  trendPerDay,
} from "../lib/goal-pace";
import { formatDecimal, t } from "../i18n";

export type GoalItem = Goal & { id: string };

/** The user's goals that are not deleted, soonest deadline first. */
export function activeGoals(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
): GoalItem[] {
  const all = Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);
  return all
    .flatMap((r) =>
      r.kind === "goal" && !r.deleted ? [{ ...r.payload, id: r.id }] : [],
    )
    .sort(
      (a, b) => a.byDate.localeCompare(b.byDate) || a.createdAt - b.createdAt,
    );
}

export type GoalProgress = {
  /** What the goal is measured in: kilograms, or estimated one-rep max kilograms. */
  unit: "kg" | "kg e1RM";
  /** Where the bar starts, where the user is now (null with no data) and the target. */
  start: number;
  current: number | null;
  target: number;
  /** 0 to 1. */
  fraction: number;
  met: boolean;
  /** The day the goal was reached; null until then. */
  reachedOn: string | null;
  /** Whole days until `byDate`; negative once it has passed. */
  daysLeft: number;
};

/** Heaviest or best-estimated checked working sets of an exercise, with their dates. */
function liftSamples(
  goal: Goal,
  records: readonly RecordDoc[],
  mode: "weight" | "e1rm",
) {
  const samples: { date: string; value: number }[] = [];
  for (const record of completedWorkouts(records as RecordDoc[])) {
    for (const exercise of record.payload.exercises) {
      if (exercise.exerciseId !== goal.exerciseId) continue;
      for (const set of exercise.sets) {
        if (!countsForLift(set)) continue;
        const value = mode === "e1rm" ? estimate(set) : set.weight;
        if (value !== null && value > 0)
          samples.push({ date: record.payload.date, value });
      }
    }
  }
  return samples.sort((a, b) => a.date.localeCompare(b.date));
}

const countsForLift = (set: WorkoutSet) =>
  set.done &&
  set.section === "working" &&
  !isDrop(set) &&
  !isCardioSet(set) &&
  set.measure !== "seconds" &&
  set.load === "weight" &&
  validSet(set);

/** The lift goal's measure: the heaviest weight for one rep, else the estimated 1RM. */
const liftMode = (goal: Goal) =>
  goal.estimated || (goal.reps ?? 1) > 1 ? "e1rm" : "weight";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How far a goal has come. A bodyweight goal compares the profile's weight with
 * the weight saved when the goal was set. A lift goal compares the best checked
 * working set of the exercise: for one rep the heaviest weight, otherwise the
 * estimated one-rep max against the target's. The bar runs from the best before
 * the goal was made (or, with none, the best of the first session after it) to
 * the target.
 */
export function goalProgress(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
): GoalProgress {
  const daysLeft = daysBetween(today, goal.byDate);
  if (goal.kind === "bodyweight") {
    const current = profile.bodyWeightKg;
    const start = goal.startKg ?? current ?? goal.targetKg;
    const losing = start > goal.targetKg;
    const reached =
      current !== null &&
      (losing ? current <= goal.targetKg : current >= goal.targetKg);
    const met = !!goal.reachedOn || reached;
    return {
      unit: "kg",
      start,
      current,
      target: goal.targetKg,
      fraction: met
        ? 1
        : current === null || start === goal.targetKg
          ? 0
          : clamp((current - start) / (goal.targetKg - start)),
      met,
      reachedOn: goal.reachedOn ?? (reached ? today : null),
      daysLeft,
    };
  }

  const reps = goal.reps ?? 1;
  const mode = liftMode(goal);
  const target =
    mode === "weight" || goal.estimated
      ? goal.targetKg
      : goal.targetKg * (1 + reps / 30);
  const samples = liftSamples(goal, records, mode);
  const created = isoDate(new Date(goal.createdAt));
  const best = (list: typeof samples) =>
    list.reduce((top, s) => Math.max(top, s.value), 0);
  // The best before the goal; with none, the first session after it.
  const before = samples.filter((s) => s.date <= created);
  const firstDay = samples.find((s) => s.date > created)?.date;
  const start = before.length
    ? best(before)
    : best(samples.filter((s) => s.date === firstDay));
  const current = samples.length ? best(samples) : null;
  const first = samples.find((s) => s.value >= target && s.date >= created);
  const reachedOn =
    goal.reachedOn ??
    (current !== null && current >= target ? (first?.date ?? created) : null);
  const met = reachedOn !== null;
  return {
    unit: mode === "e1rm" ? "kg e1RM" : "kg",
    start,
    current,
    target,
    fraction: met
      ? 1
      : current === null || target <= start
        ? 0
        : clamp((current - start) / (target - start)),
    met,
    reachedOn,
    daysLeft,
  };
}

/** One reading a day, oldest first: the day's highest value or its mean. */
function daily(samples: readonly GoalPoint[], pick: "max" | "mean") {
  const days = new Map<string, number[]>();
  for (const s of samples)
    days.set(s.date, [...(days.get(s.date) ?? []), s.value]);
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value:
        pick === "max"
          ? Math.max(...values)
          : values.reduce((sum, v) => sum + v, 0) / values.length,
    }));
}

/**
 * The goal's metric over time, one reading a day, oldest first. A lift goal
 * reads the best checked working set of each session in the goal's measure. A
 * bodyweight goal reads the starting weight on the day the goal was made, the
 * bodyweight saved with checked bodyweight sets, and the profile's weight today.
 */
export function goalSeries(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
): GoalPoint[] {
  if (goal.kind === "lift")
    return daily(liftSamples(goal, records, liftMode(goal)), "max");
  const created = isoDate(new Date(goal.createdAt));
  const samples: GoalPoint[] = [];
  for (const record of completedWorkouts(records as RecordDoc[]))
    for (const exercise of record.payload.exercises)
      for (const set of exercise.sets)
        if (set.done && set.bodyWeightKg && record.payload.date <= today)
          samples.push({ date: record.payload.date, value: set.bodyWeightKg });
  const points = daily(samples, "mean").filter(
    (p) => p.date !== created && p.date !== today,
  );
  if (goal.startKg !== undefined && created <= today)
    points.push({ date: created, value: goal.startKg });
  if (profile.bodyWeightKg !== null)
    points.push({ date: today, value: profile.bodyWeightKg });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export type GoalInsight = {
  progress: GoalProgress;
  /** Readings since the goal was made (the start included), for the sparkline. */
  sinceStart: GoalPoint[];
  /** The six-week trend in kg per day, null with too little data. */
  perDay: number | null;
  deadline: Deadline;
  /** Null once met or when no days are left. */
  pace: Pace | null;
  /** When the trend reaches the target; null when it does not head there. */
  projected: string | null;
};

/** Everything the Goals tab shows for one goal. */
export function goalInsight(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
): GoalInsight {
  const progress = goalProgress(goal, records, profile, today);
  const series = goalSeries(goal, records, profile, today);
  const created = isoDate(new Date(goal.createdAt));
  // A lift starts from its best before the goal, drawn on the day it was made.
  const before = series.filter((p) => p.date <= created);
  const sinceStart = [
    ...(goal.kind === "lift" && before.length
      ? [{ date: created, value: Math.max(...before.map((p) => p.value)) }]
      : []),
    ...series.filter((p) =>
      goal.kind === "lift" ? p.date > created : p.date >= created,
    ),
  ];
  // The trend is in the goal's own measure, so it compares with the target.
  const slope = trendPerDay(series, today);
  const open = !progress.met;
  return {
    progress,
    sinceStart,
    perDay: slope,
    deadline: deadline(progress.daysLeft),
    pace: open
      ? goalPace({
          current: progress.current,
          target: progress.target,
          daysLeft: progress.daysLeft,
          perDay: slope,
        })
      : null,
    projected: open
      ? projectedDate({
          current: progress.current,
          target: progress.target,
          perDay: slope,
          today,
        })
      : null,
  };
}

/** A goal's name for lists: "Bench Press 110 kg × 1" or "Bodyweight 80 kg". */
export function goalTitle(goal: Goal) {
  const kg = (value: number) => `${formatDecimal(Number(value.toFixed(2)))} kg`;
  if (goal.kind === "bodyweight")
    return t("goals.titleBodyweight", { kg: kg(goal.targetKg) });
  const name = goal.exerciseName ?? t("goals.lift");
  return goal.estimated
    ? t("goals.titleEstimated", { name, kg: kg(goal.targetKg) })
    : `${name} ${kg(goal.targetKg)} × ${goal.reps ?? 1}`;
}
