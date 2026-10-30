import { daysBetween, shiftDate } from "./dates";

/** One reading of a goal's metric: a day and its value in kg. */
export type GoalPoint = { date: string; value: number };

/** How far back the trend looks: six weeks. */
export const TREND_DAYS = 42;
/** The trend needs this many readings, spread over at least this many days. */
export const TREND_MIN_POINTS = 3;
export const TREND_MIN_SPAN = 14;

/**
 * The least-squares slope, in kg per day, of the readings in the `days` up to
 * and including `today`. Null when there are too few readings, or they sit too
 * close together, to say anything.
 */
export function trendPerDay(
  points: readonly GoalPoint[],
  today: string,
  days = TREND_DAYS,
): number | null {
  const from = shiftDate(today, -days);
  const recent = points.filter((p) => p.date >= from && p.date <= today);
  if (recent.length < TREND_MIN_POINTS) return null;
  const xs = recent.map((p) => daysBetween(from, p.date));
  if (Math.max(...xs) - Math.min(...xs) < TREND_MIN_SPAN) return null;
  const n = recent.length;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = recent.reduce((sum, p) => sum + p.value, 0) / n;
  let top = 0;
  let bottom = 0;
  recent.forEach((p, i) => {
    top += (xs[i] - meanX) * (p.value - meanY);
    bottom += (xs[i] - meanX) ** 2;
  });
  return bottom ? top / bottom : null;
}

/** When the goal is due: days left, the last day, or days overdue. */
export type Deadline =
  | { kind: "left"; days: number }
  | { kind: "today" }
  | { kind: "overdue"; days: number };

export function deadline(daysLeft: number): Deadline {
  if (daysLeft > 0) return { kind: "left", days: daysLeft };
  if (daysLeft === 0) return { kind: "today" };
  return { kind: "overdue", days: -daysLeft };
}

/**
 * The recent trend against the rate the goal needs, both in kg per week toward
 * the target (positive means closer). `unknown` without a trend.
 */
export type Pace =
  | { kind: "unknown" }
  | { kind: "ahead" | "on-track" | "behind"; needed: number; trend: number };

/** A trend this much faster than needed is "ahead"; this much of it is still "on track". */
const AHEAD = 1.2;
const ON_TRACK = 0.9;

/**
 * Whether the trend gets from `current` to `target` by the date. Null when there
 * is nothing to pace: the goal is met (or `current` is unknown), or no days are left.
 * Works both ways, so a bodyweight goal that goes down is paced like a lift.
 */
export function goalPace({
  current,
  target,
  daysLeft,
  perDay,
}: {
  current: number | null;
  target: number;
  daysLeft: number;
  perDay: number | null;
}): Pace | null {
  if (current === null || daysLeft <= 0) return null;
  const toward = Math.sign(target - current);
  if (toward === 0) return null;
  if (perDay === null) return { kind: "unknown" };
  const needed = (Math.abs(target - current) / daysLeft) * 7;
  const trend = perDay * toward * 7;
  return {
    kind:
      trend >= needed * AHEAD
        ? "ahead"
        : trend >= needed * ON_TRACK
          ? "on-track"
          : "behind",
    needed,
    trend,
  };
}

/** Projections further out than this are not shown. */
export const PROJECTION_MAX_DAYS = 730;

/**
 * The day the trend reaches `target` from `current`, or null when it points
 * away from it, is flat, or would take more than two years.
 */
export function projectedDate({
  current,
  target,
  perDay,
  today,
}: {
  current: number | null;
  target: number;
  perDay: number | null;
  today: string;
}): string | null {
  if (current === null || perDay === null) return null;
  const toward = Math.sign(target - current);
  const speed = perDay * toward;
  if (toward === 0 || speed <= 0) return null;
  const days = Math.ceil(Math.abs(target - current) / speed);
  return days > PROJECTION_MAX_DAYS ? null : shiftDate(today, days);
}
