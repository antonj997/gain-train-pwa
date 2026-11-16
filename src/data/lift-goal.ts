// A lift goal measured as strength, not as the heaviest weight (approved plan,
// 16 November 2026). Pure, so it is tested (tests/lift-goal.test.ts).
//
// - Strength is the estimated one-rep max of each session's best set of 1–10
//   reps: Epley, as in estimate.ts, on the whole load (bodyweight lifts count
//   the bodyweight plus added weight, minus assistance, as loadEstimate does).
//   A single is its own load: 110 × 1 is 110 kg, not 113.7. The target is
//   measured the same way, so a goal of 110 × 1 is reached in strength at 110
//   and a goal of 100 × 5 at 100 × (1 + 5/30) ≈ 116.7.
// - The status compares the mean of the per-session best over the last four
//   weeks with the four weeks before: up or down by more than 2.5 %, or flat.
//   Each window needs three sessions, or there is too little data to say.
// - A goal is reached only by the real lift: a checked working set of at least
//   the weight (the added weight for bodyweight lifts) for at least the reps.
//   When the smoothed strength reaches the target first, it is time to test.
// - Check-ins (kontrollpass): every four weeks, or after six sessions with the
//   lift, whichever comes first, as many reps as possible at about 85 % of the
//   target. A plan's deload week within those four weeks moves the check-in to
//   the week before it. Due-ness and results come from the log; only skips are
//   stored, on the goal (checkinSkips).
import { validSet, type Goal, type Plan, type WorkoutSet } from "./model";
import type { RecordDoc } from "./model";
import { isDrop } from "./drops";
import { isBodyLoad } from "./estimate";
import { isDeloadWeek, phaseWeeks } from "./phase";
import { completedWorkouts } from "./selectors";
import { isCardioSet } from "../lib/cardio";
import { daysBetween, shiftDate, weekStart } from "../lib/dates";
import { type GoalPoint, PROJECTION_MAX_DAYS } from "../lib/goal-pace";
import { loadIncrement, roundToStep } from "../lib/progression";
import { hasExtraWeight } from "../lib/set-load";
import { fromUnit, toUnit, type WeightUnit } from "../lib/units";

/** Each smoothing window: four weeks. */
export const WINDOW_DAYS = 28;
/** A window needs this many sessions to say anything. */
export const MIN_SESSIONS = 3;
/** Up or down by more than this share is a change; within it is flat. */
export const STATUS_BAND = 0.025;
/** A check-in falls due this many days after the last one… */
export const CHECKIN_DAYS = 28;
/** …or on the day of this many sessions with the lift since, if sooner. */
export const CHECKIN_SESSIONS = 6;
/** The check-in's weight: this share of the target, on the lift's load step. */
export const CHECKIN_SHARE = 0.85;
/** The heaviest reps a session's best set may have to count for strength. */
export const MAX_STRENGTH_REPS = 10;

const EPSILON = 1e-6;
const round3 = (kg: number) => Math.round(kg * 1000) / 1000;

/**
 * Strength for `load` kg lifted `reps` times: the Epley estimate of the
 * one-rep max, except that a single is its own load.
 */
export const strength = (load: number, reps: number) =>
  reps <= 1 ? load : load * (1 + reps / 30);

/** A checked working set that can say something about a lift goal. */
export const isLiftSet = (set: WorkoutSet) =>
  set.done &&
  set.section === "working" &&
  !isDrop(set) &&
  !isCardioSet(set) &&
  set.measure !== "seconds" &&
  set.load !== "none" &&
  validSet(set) &&
  (set.reps ?? 0) >= 1;

/** The added weight of a bodyweight set: negative for assistance, 0 for plain bodyweight. */
export const addedWeight = (set: WorkoutSet) =>
  hasExtraWeight(set)
    ? (set.weight ?? 0)
    : set.load === "assisted"
      ? -(set.weight ?? 0)
      : 0;

/**
 * The whole load a set moved, in kg: its weight, or for a bodyweight set the
 * bodyweight logged with it (else `bodyWeightKg`) plus added weight, minus
 * assistance. Null when it cannot be known.
 */
export function wholeLoad(set: WorkoutSet, bodyWeightKg: number | null) {
  if (set.load === "weight")
    return set.weight && set.weight > 0 ? set.weight : null;
  if (!isBodyLoad(set)) return null;
  const body = set.bodyWeightKg ?? bodyWeightKg;
  if (!body) return null;
  const total = body + addedWeight(set);
  return total > 0 ? total : null;
}

/** One checked working set of the goal's exercise, with its day and whole load. */
export type LiftSet = { date: string; set: WorkoutSet; load: number | null };

/** The goal's exercise in the log, oldest first. */
export type LiftLog = {
  /** Its sets of the goal's kind of load: weighted, or bodyweight (plain, added or assisted). */
  sets: LiftSet[];
  /** True when the exercise is done with bodyweight: the newest set says. */
  body: boolean;
  /** Days with a checked working set of the exercise, oldest first. */
  days: string[];
  /** The newest bodyweight logged with a set of it, for a bodyweight lift. */
  bodyWeightKg: number | null;
};

/**
 * The goal exercise's checked working sets in the finished workouts, oldest
 * first, of the newest set's kind of load (a weighted and a bodyweight version
 * of a lift are not compared).
 */
export function liftLog(
  exerciseId: string,
  records: readonly RecordDoc[],
  bodyWeightKg: number | null,
): LiftLog {
  const found: { date: string; set: WorkoutSet }[] = [];
  for (const record of completedWorkouts(records as RecordDoc[]))
    for (const exercise of record.payload.exercises)
      if (exercise.exerciseId === exerciseId)
        for (const set of exercise.sets)
          if (isLiftSet(set)) found.push({ date: record.payload.date, set });
  // Stable: sets keep their order within a day.
  found.sort((a, b) => a.date.localeCompare(b.date));
  const body = found.length ? isBodyLoad(found[found.length - 1].set) : false;
  const sets = found
    .filter((f) => isBodyLoad(f.set) === body)
    .map((f) => ({ ...f, load: wholeLoad(f.set, bodyWeightKg) }));
  const logged = [...sets].reverse().find((s) => s.set.bodyWeightKg)?.set;
  return {
    sets,
    body,
    days: [...new Set(found.map((f) => f.date))],
    bodyWeightKg: logged?.bodyWeightKg ?? null,
  };
}

/** A session's best set for strength: its day, strength, the set and its load. */
export type StrengthPoint = GoalPoint & { set: WorkoutSet; load: number };

/** The strength of each day's best set of 1–10 reps, oldest first. */
export function strengthSeries(log: Pick<LiftLog, "sets">): StrengthPoint[] {
  const best = new Map<string, StrengthPoint>();
  for (const { date, set, load } of log.sets) {
    const reps = set.reps ?? 0;
    if (load === null || reps < 1 || reps > MAX_STRENGTH_REPS) continue;
    const value = strength(load, reps);
    const top = best.get(date);
    if (!top || value > top.value) best.set(date, { date, value, set, load });
  }
  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** One smoothing window: the mean strength, its sessions and their mean day (days from today, ≤ 0). */
export type StrengthWindow = { mean: number; sessions: number; at: number };

export type StrengthStatus = "up" | "flat" | "down" | "insufficient";

export type StrengthTrend = {
  status: StrengthStatus;
  /** The last four weeks, today included; null without a session in them. */
  recent: StrengthWindow | null;
  /** The four weeks before; null without a session in them. */
  previous: StrengthWindow | null;
  /** The recent mean against the previous, as a share (0.03 is 3 % up); null without both windows. */
  change: number | null;
  /** Strength gained a day between the two windows' mean days; null with too little data. */
  perDay: number | null;
};

function windowOf(
  points: readonly GoalPoint[],
  today: string,
  from: number,
): StrengthWindow | null {
  const inside = points
    .map((p) => ({ ...p, ago: daysBetween(p.date, today) }))
    .filter((p) => p.ago >= from && p.ago < from + WINDOW_DAYS);
  if (!inside.length) return null;
  const n = inside.length;
  return {
    mean: inside.reduce((sum, p) => sum + p.value, 0) / n,
    sessions: n,
    at: -inside.reduce((sum, p) => sum + p.ago, 0) / n,
  };
}

/** The status from a change: beyond ±2.5 % is up or down, the edges themselves flat. */
export function statusOf(
  change: number,
): Exclude<StrengthStatus, "insufficient"> {
  // Rounded, so 102.5 against 100 is exactly 2.5 % and flat.
  const share = Math.round(change * 1e9) / 1e9;
  return share > STATUS_BAND ? "up" : share < -STATUS_BAND ? "down" : "flat";
}

/**
 * The smoothed trend: the mean per-session strength over the last four weeks
 * against the four weeks before. Too little data unless each window has at
 * least three sessions.
 */
export function strengthTrend(
  points: readonly GoalPoint[],
  today: string,
): StrengthTrend {
  const recent = windowOf(points, today, 0);
  const previous = windowOf(points, today, WINDOW_DAYS);
  const change =
    recent && previous && previous.mean > 0
      ? recent.mean / previous.mean - 1
      : null;
  const enough =
    change !== null &&
    recent!.sessions >= MIN_SESSIONS &&
    previous!.sessions >= MIN_SESSIONS;
  return {
    status: enough ? statusOf(change) : "insufficient",
    recent,
    previous,
    change,
    perDay:
      enough && recent!.at > previous!.at
        ? (recent!.mean - previous!.mean) / (recent!.at - previous!.at)
        : null,
  };
}

/**
 * Whether the smoothed trend, carried on to `byDate`, reaches `target`:
 * "on" or "off". Null when there is too little data or no day is left.
 */
export function strengthPace(
  trend: StrengthTrend,
  target: number,
  byDate: string,
  today: string,
): "on" | "off" | null {
  if (trend.status === "insufficient" || !trend.recent || trend.perDay === null)
    return null;
  const daysLeft = daysBetween(today, byDate);
  if (daysLeft <= 0) return null;
  const atDate =
    trend.recent.mean + trend.perDay * (daysLeft - trend.recent.at);
  return atDate >= target - EPSILON ? "on" : "off";
}

/**
 * When the smoothed trend reaches `target`: only while it is going up on
 * enough data, still below the target, and within two years.
 */
export function strengthProjection(
  trend: StrengthTrend,
  target: number,
  today: string,
): string | null {
  const { recent, perDay } = trend;
  if (trend.status !== "up" || !recent || perDay === null || perDay <= 0)
    return null;
  if (recent.mean >= target - EPSILON) return null;
  const days = Math.ceil((target - recent.mean) / perDay + recent.at);
  return days <= 0 || days > PROJECTION_MAX_DAYS
    ? null
    : shiftDate(today, days);
}

/**
 * The goal's target as strength. A bodyweight lift's weight is added weight,
 * so it needs the lifter's bodyweight: null without one.
 */
export function strengthTarget(
  goal: Pick<Goal, "targetKg" | "reps" | "estimated">,
  body: boolean,
  bodyWeightKg: number | null,
): number | null {
  if (goal.estimated) return goal.targetKg;
  const reps = goal.reps ?? 1;
  if (!body) return strength(goal.targetKg, reps);
  return bodyWeightKg ? strength(bodyWeightKg + goal.targetKg, reps) : null;
}

/** True when the set is the goal's real lift: the weight (added weight) for the reps, or more. */
export function isRealLift(
  goal: Pick<Goal, "targetKg" | "reps" | "estimated">,
  lift: LiftSet,
  body: boolean,
  target: number | null,
) {
  const reps = lift.set.reps ?? 0;
  if (goal.estimated)
    return (
      target !== null &&
      lift.load !== null &&
      reps <= MAX_STRENGTH_REPS &&
      strength(lift.load, reps) >= target - EPSILON
    );
  if (reps < (goal.reps ?? 1)) return false;
  const weight = body
    ? hasExtraWeight(lift.set)
      ? (lift.set.weight ?? 0)
      : null
    : lift.set.load === "weight"
      ? (lift.set.weight ?? 0)
      : null;
  return weight !== null && weight >= goal.targetKg - EPSILON;
}

/**
 * The day the goal was reached by the real lift: the first such set from the
 * day the goal was made, or that day when it had been done before. Null when
 * it has not been done.
 */
export function reachedByLift(
  goal: Pick<Goal, "targetKg" | "reps" | "estimated">,
  log: Pick<LiftLog, "sets" | "body">,
  target: number | null,
  created: string,
): string | null {
  const hits = log.sets.filter((s) => isRealLift(goal, s, log.body, target));
  if (!hits.length) return null;
  return hits.find((s) => s.date >= created)?.date ?? created;
}

/** What to try once strength says the goal is within reach: the goal's own lift. */
export type ReadyToTest = { weight: number; reps: number };

/**
 * "Ready to test": the smoothed strength (the last four weeks' mean, on at
 * least three sessions) has reached the target, but the real lift is not done.
 */
export function readyToTest(
  goal: Pick<Goal, "targetKg" | "reps" | "estimated">,
  trend: Pick<StrengthTrend, "recent">,
  target: number | null,
  met: boolean,
): ReadyToTest | null {
  const recent = trend.recent;
  if (met || goal.estimated || target === null || !recent) return null;
  if (recent.sessions < MIN_SESSIONS || recent.mean < target - EPSILON)
    return null;
  return { weight: goal.targetKg, reps: goal.reps ?? 1 };
}

// ---------------------------------------------------------------- Check-ins

/**
 * The check-in's load in kg: 85 % of the target weight on the lift's load
 * step (loadIncrement; 5 lb when the app shows pounds). For a bodyweight lift
 * it is added weight: 85 % of the whole target load less the bodyweight, 0
 * for plain bodyweight. Null for a bodyweight lift without a bodyweight.
 */
export function checkinLoad(
  goal: Pick<Goal, "targetKg">,
  {
    body,
    bodyWeightKg,
    equipment,
    unit = "kg",
  }: {
    body: boolean;
    bodyWeightKg: number | null;
    equipment?: string | null;
    unit?: WeightUnit;
  },
): number | null {
  const onStep = (kg: number) =>
    unit === "lb"
      ? round3(fromUnit(roundToStep(toUnit(kg, "lb"), 5), "lb"))
      : round3(roundToStep(kg, loadIncrement(equipment, kg)));
  if (!body) return onStep(goal.targetKg * CHECKIN_SHARE);
  if (!bodyWeightKg) return null;
  const added = (bodyWeightKg + goal.targetKg) * CHECKIN_SHARE - bodyWeightKg;
  return added <= 0 ? 0 : onStep(added);
}

/** The Mondays of the plans' deload weeks, oldest first. Paused plans plan nothing. */
export function deloadMondays(
  plans: readonly Pick<
    Plan,
    "startDate" | "endDate" | "cycleWeeks" | "weekKinds" | "paused"
  >[],
): string[] {
  const mondays: string[] = [];
  for (const plan of plans) {
    if (plan.paused) continue;
    const first = weekStart(plan.startDate);
    for (let week = 1; week <= phaseWeeks(plan); week++)
      if (isDeloadWeek(plan, week))
        mondays.push(shiftDate(first, 7 * (week - 1)));
  }
  return [...new Set(mondays)].sort();
}

/** A check-in done: the day, its strength and the set. */
export type CheckinResult = { date: string; value: number; set: WorkoutSet };

export type CheckinState = {
  /** The check-in's load in kg (added weight for a bodyweight lift). */
  load: number;
  /** The week the check-in is due and not yet done or skipped: Monday to Sunday. */
  due: { week: string; end: string } | null;
  /** The Monday of the week the next check-in falls due: this week's while it is due. */
  next: string;
  /** The latest check-in done. */
  last: CheckinResult | null;
};

/**
 * When the next check-in falls due after `anchor` (the goal's day, or the
 * last check-in's): four weeks on, or the day of the sixth session with the
 * lift, whichever comes first. A plan's deload week starting within those
 * four weeks puts it in the week before instead.
 */
export function checkinDue(
  anchor: string,
  days: readonly string[],
  deloads: readonly string[] = [],
): { date: string; week: string } {
  const byTime = shiftDate(anchor, CHECKIN_DAYS);
  const deload = deloads.find(
    (monday) => shiftDate(monday, -7) > anchor && monday <= byTime,
  );
  if (deload) {
    const week = shiftDate(deload, -7);
    return { date: week, week };
  }
  const after = days.filter((d) => d > anchor);
  const bySessions =
    after.length >= CHECKIN_SESSIONS ? after[CHECKIN_SESSIONS - 1] : null;
  const date = bySessions && bySessions < byTime ? bySessions : byTime;
  return { date, week: weekStart(date) };
}

/** True when a set counts as the check-in: at its load or heavier. */
const meetsCheckin = (lift: LiftSet, load: number, body: boolean) =>
  (body ? addedWeight(lift.set) : (lift.set.weight ?? 0)) >= load - EPSILON;

/**
 * The goal's check-ins, walked from the day the goal was made to `today`. A
 * check-in is done when a set at its load or heavier is logged in the week it
 * is due (the result is that set's strength); a skipped or missed week moves
 * the next one on an interval from the day it was due.
 */
export function checkinState({
  goal,
  log,
  load,
  created,
  today,
  deloads = [],
}: {
  goal: Pick<Goal, "checkinSkips">;
  log: Pick<LiftLog, "sets" | "days" | "body">;
  load: number;
  created: string;
  today: string;
  deloads?: readonly string[];
}): CheckinState {
  const skips = new Set(goal.checkinSkips ?? []);
  const thisWeek = weekStart(today);
  let anchor = created;
  let previous: string | null = null;
  let last: CheckinResult | null = null;
  // Each turn moves at least a week on; the cap only guards a broken date.
  for (let turn = 0; turn < 2000; turn++) {
    let { date, week } = checkinDue(anchor, log.days, deloads);
    if (previous && week <= previous) {
      week = shiftDate(previous, 7);
      if (date < week) date = week;
    }
    previous = week;
    if (week > thisWeek) return { load, due: null, next: week, last };
    const end = shiftDate(week, 6);
    let hit: CheckinResult | null = null;
    for (const lift of log.sets) {
      if (lift.date < week || lift.date > end || lift.date > today) continue;
      if (lift.date <= anchor || lift.load === null) continue;
      if (!meetsCheckin(lift, load, log.body)) continue;
      const value = strength(lift.load, lift.set.reps ?? 1);
      if (!hit || value > hit.value)
        hit = { date: lift.date, value, set: lift.set };
    }
    if (hit) {
      last = hit;
      anchor = hit.date;
      continue;
    }
    if (skips.has(week) || end < today) {
      anchor = date;
      continue;
    }
    return { load, due: { week, end }, next: week, last };
  }
  return { load, due: null, next: thisWeek, last };
}
