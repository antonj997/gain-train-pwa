import type { Goal, Plan, RecordDoc, WorkoutSet } from "./model";
import { completedWorkouts } from "./selectors";
import {
  type CheckinState,
  type ReadyToTest,
  type StrengthPoint,
  type StrengthTrend,
  checkinLoad,
  checkinState,
  deloadMondays,
  liftLog,
  reachedByLift,
  readyToTest,
  strengthPace,
  strengthProjection,
  strengthSeries,
  strengthTarget,
  strengthTrend,
  WINDOW_DAYS,
} from "./lift-goal";
import { daysBetween, isoDate, shiftDate } from "../lib/dates";
import {
  formatWeight,
  formatWeightValue,
  getWeightUnit,
  type WeightUnit,
} from "../lib/units";
import {
  type Deadline,
  type GoalPoint,
  type Pace,
  deadline,
  goalPace,
  projectedDate,
  trendPerDay,
} from "../lib/goal-pace";
import { t } from "../i18n";

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
  /** What the goal is measured in: kilograms, or estimated one-rep max kilograms (every lift goal). */
  unit: "kg" | "kg e1RM";
  /** Where the bar starts, where the user is now (null with no data) and the target. */
  start: number;
  current: number | null;
  target: number;
  /** A lift goal's "now": the set it comes from and its day. */
  source: { set: WorkoutSet; date: string } | null;
  /** 0 to 1. Below 1 until the goal is met, however strong the lift is. */
  fraction: number;
  met: boolean;
  /** The day the goal was reached; null until then. */
  reachedOn: string | null;
  /** Whole days until `byDate`; negative once it has passed. */
  daysLeft: number;
};

/** What a lift goal's numbers need besides the log. */
export type GoalContext = {
  /** The user's plans: a deload week places the check-in in the week before. */
  plans?: readonly Pick<
    Plan,
    "startDate" | "endDate" | "cycleWeeks" | "weekKinds" | "paused"
  >[];
  /** The goal exercise's equipment, for the check-in's load step. */
  equipmentOf?: (exerciseId: string) => string | undefined;
  /** The unit the app shows: in pounds the check-in is on a 5 lb step. */
  unit?: WeightUnit;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** A lift that is strong enough but not yet done stops just short of full. */
const ALMOST = 0.99;

/** A lift goal's strength picture: everything goalProgress and goalInsight read. */
function liftPicture(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
) {
  const log = liftLog(goal.exerciseId ?? "", records, profile.bodyWeightKg);
  const bodyWeightKg = profile.bodyWeightKg ?? log.bodyWeightKg;
  const target = strengthTarget(goal, log.body, bodyWeightKg);
  const points = strengthSeries(log);
  const created = isoDate(new Date(goal.createdAt));
  return { log, bodyWeightKg, target, points, created };
}

type LiftPicture = ReturnType<typeof liftPicture>;

function liftProgress(
  goal: Goal,
  picture: LiftPicture,
  today: string,
): GoalProgress {
  const { log, target, points, created } = picture;
  // The strongest session; of equals the latest, so "now" names a recent set.
  const best = (list: readonly StrengthPoint[]) =>
    list.reduce<StrengthPoint | null>(
      (top, p) => (!top || p.value >= top.value ? p : top),
      null,
    );
  // The best before the goal; with none, the first session after it.
  const before = points.filter((p) => p.date <= created);
  const firstDay = points.find((p) => p.date > created)?.date;
  const start =
    best(before.length ? before : points.filter((p) => p.date === firstDay))
      ?.value ?? 0;
  // Now: the best session of the last four weeks, else the latest one.
  const from = shiftDate(today, -(WINDOW_DAYS - 1));
  const now =
    best(points.filter((p) => p.date >= from && p.date <= today)) ??
    points.at(-1) ??
    null;
  const current = now?.value ?? null;
  const reachedOn = goal.reachedOn ?? reachedByLift(goal, log, target, created);
  const met = reachedOn !== null;
  const aim = target ?? goal.targetKg;
  const fraction = met
    ? 1
    : current === null || target === null
      ? 0
      : aim <= start
        ? current >= aim
          ? ALMOST
          : 0
        : Math.min(ALMOST, clamp((current - start) / (aim - start)));
  return {
    unit: "kg e1RM",
    start,
    current,
    target: aim,
    source: now ? { set: now.set, date: now.date } : null,
    fraction,
    met,
    reachedOn,
    daysLeft: daysBetween(today, goal.byDate),
  };
}

/**
 * How far a goal has come. A bodyweight goal compares the profile's weight with
 * the weight saved when the goal was set. A lift goal compares strength: the
 * estimated one-rep max of each session's best set of 1–10 reps (lift-goal.ts),
 * from the best before the goal was made (or, with none, the first session
 * after it) to the target's, with "now" the best of the last four weeks. A
 * lift goal is met only by the real lift (reachedByLift).
 */
export function goalProgress(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
): GoalProgress {
  if (goal.kind === "lift")
    return liftProgress(goal, liftPicture(goal, records, profile), today);
  const daysLeft = daysBetween(today, goal.byDate);
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
    source: null,
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

/** One reading a day, oldest first: the day's mean. */
function dailyMean(samples: readonly GoalPoint[]) {
  const days = new Map<string, number[]>();
  for (const s of samples)
    days.set(s.date, [...(days.get(s.date) ?? []), s.value]);
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));
}

/**
 * The goal's metric over time, one reading a day, oldest first. A lift goal
 * reads each session's strength (strengthSeries). A bodyweight goal reads the
 * starting weight on the day the goal was made, the bodyweight saved with
 * checked bodyweight sets, and the profile's weight today.
 */
export function goalSeries(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
): GoalPoint[] {
  if (goal.kind === "lift")
    return liftPicture(goal, records, profile).points.map(
      ({ date, value }) => ({ date, value }),
    );
  const created = isoDate(new Date(goal.createdAt));
  const samples: GoalPoint[] = [];
  for (const record of completedWorkouts(records as RecordDoc[]))
    for (const exercise of record.payload.exercises)
      for (const set of exercise.sets)
        if (set.done && set.bodyWeightKg && record.payload.date <= today)
          samples.push({ date: record.payload.date, value: set.bodyWeightKg });
  const points = dailyMean(samples).filter(
    (p) => p.date !== created && p.date !== today,
  );
  if (goal.startKg !== undefined && created <= today)
    points.push({ date: created, value: goal.startKg });
  if (profile.bodyWeightKg !== null)
    points.push({ date: today, value: profile.bodyWeightKg });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** A lift goal's strength reading: the smoothed status, pace, test and check-ins. */
export type StrengthInsight = {
  /** True when the lift is done with bodyweight: its weights are added weight. */
  body: boolean;
  trend: StrengthTrend;
  /** Whether the smoothed trend reaches the target by the date; null with too little data. */
  pace: "on" | "off" | null;
  /** Strong enough on the smoothed numbers: try the goal's real lift. */
  ready: ReadyToTest | null;
  /** The check-ins; null for a met goal, or a bodyweight lift without a bodyweight. */
  checkin: CheckinState | null;
};

export type GoalInsight = {
  progress: GoalProgress;
  /** Readings since the goal was made (the start included), for the sparkline. */
  sinceStart: GoalPoint[];
  /**
   * The trend in kg per day: a bodyweight goal's six-week least-squares line,
   * a lift goal's smoothed strength between its two four-week windows. Null
   * with too little data.
   */
  perDay: number | null;
  deadline: Deadline;
  /** A bodyweight goal's pace; null once met, when no days are left, and for lift goals. */
  pace: Pace | null;
  /** When the trend reaches the target; null when it does not head there. */
  projected: string | null;
  /** A lift goal's strength reading; null for a bodyweight goal. */
  strength: StrengthInsight | null;
};

/** Everything the Goals tab shows for one goal. */
export function goalInsight(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
  context: GoalContext = {},
): GoalInsight {
  if (goal.kind === "lift")
    return liftInsight(goal, records, profile, today, context);
  const progress = goalProgress(goal, records, profile, today);
  const series = goalSeries(goal, records, profile, today);
  const created = isoDate(new Date(goal.createdAt));
  const sinceStart = series.filter((p) => p.date >= created);
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
    strength: null,
  };
}

function liftInsight(
  goal: Goal,
  records: readonly RecordDoc[],
  profile: { bodyWeightKg: number | null },
  today: string,
  context: GoalContext,
): GoalInsight {
  const picture = liftPicture(goal, records, profile);
  const progress = liftProgress(goal, picture, today);
  const { log, points, created, target, bodyWeightKg } = picture;
  // The sparkline starts from the best before the goal, drawn on its day.
  const before = points.filter((p) => p.date <= created);
  const sinceStart = [
    ...(before.length
      ? [{ date: created, value: Math.max(...before.map((p) => p.value)) }]
      : []),
    ...points
      .filter((p) => p.date > created)
      .map(({ date, value }) => ({ date, value })),
  ];
  const trend = strengthTrend(points, today);
  const open = !progress.met;
  const ready =
    target === null ? null : readyToTest(goal, trend, target, progress.met);
  const load =
    open && goal.exerciseId
      ? checkinLoad(goal, {
          body: log.body,
          bodyWeightKg,
          equipment: context.equipmentOf?.(goal.exerciseId),
          unit: context.unit,
        })
      : null;
  const checkin =
    load === null
      ? null
      : checkinState({
          goal,
          log,
          load,
          created,
          today,
          deloads: deloadMondays(context.plans ?? []),
        });
  return {
    progress,
    sinceStart,
    perDay: trend.perDay,
    deadline: deadline(progress.daysLeft),
    pace: null,
    projected:
      open && !ready && target !== null
        ? strengthProjection(trend, target, today)
        : null,
    strength: {
      body: log.body,
      trend,
      pace:
        open && !ready && target !== null
          ? strengthPace(trend, target, goal.byDate, today)
          : null,
      ready,
      // Ready to test: the test itself is the check-in.
      checkin: checkin && ready ? { ...checkin, due: null } : checkin,
    },
  };
}

/** "110 × 1", "+20 × 5" or "≈ 120": a lift goal's own lift, short, in the shown unit. */
export function goalLiftText(goal: Goal, body: boolean) {
  const kg = formatWeightValue(goal.targetKg, getWeightUnit(), 2);
  if (goal.estimated) return `≈ ${kg}`;
  return `${body ? "+" : ""}${kg} × ${goal.reps ?? 1}`;
}

/** A goal's name for lists: "Bench Press 110 kg × 1" or "Bodyweight 80 kg" (or lb). */
export function goalTitle(goal: Goal) {
  const kg = (value: number) => formatWeight(value, getWeightUnit(), 2);
  if (goal.kind === "bodyweight")
    return t("goals.titleBodyweight", { kg: kg(goal.targetKg) });
  const name = goal.exerciseName ?? t("goals.lift");
  return goal.estimated
    ? t("goals.titleEstimated", { name, kg: kg(goal.targetKg) })
    : `${name} ${kg(goal.targetKg)} × ${goal.reps ?? 1}`;
}
