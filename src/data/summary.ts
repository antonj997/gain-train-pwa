import { type Workout, validSet } from "./model";
import { comparableSets, type ExerciseProgress } from "./analytics";
import { isDrop } from "./drops";
import { cardioTotals, isCardioSet } from "../lib/cardio";
import {
  addMonths,
  daysBetween,
  endOfMonth,
  shiftDate,
  weekStart,
} from "../lib/dates";

/** The share of exercises whose latest result beats their baseline; takes `progressFor`'s result. */
export function improvementRate(
  progress: readonly ExerciseProgress[],
  start: string,
  end: string,
) {
  let compared = 0,
    improved = 0;
  for (const exercise of progress) {
    const points = exercise.points.filter((point) => point.date <= end);
    const latest = points.at(-1);
    if (!latest || latest.date < start) continue;
    const weighted = latest.e1rm !== null;
    const comparable = points.filter((point) =>
      comparableSets(point.set, latest.set),
    );
    const baseline =
      comparable.filter((point) => point.date < start).at(-1) ?? comparable[0];
    if (!baseline || baseline === latest) continue;
    compared++;
    if (
      (weighted ? latest.e1rm! : latest.set.reps!) >
      (weighted ? baseline.e1rm! : baseline.set.reps!)
    )
      improved++;
  }
  return compared ? (improved / compared) * 100 : null;
}

/**
 * A History or Progress period ending `now` and the period before it:
 * "4w" (28 days), "3m", "6m" or "12m" (calendar months back), a month
 * (YYYY-MM, to `now` for the current one) or "" (the last 30 days).
 */
export function historyPeriod(month: string, now: string) {
  const span = (start: string, end: string) => daysBetween(start, end) + 1;
  const back = (start: string, days: number) => ({
    start,
    end: now,
    days,
    previousStart: shiftDate(start, -days),
    previousEnd: shiftDate(start, -1),
    previousDays: days,
  });
  if (month === "4w") return back(shiftDate(now, -27), 28);
  if (month === "3m" || month === "6m" || month === "12m") {
    const start = shiftDate(addMonths(now, -Number.parseInt(month)), 1);
    return back(start, span(start, now));
  }
  if (!month) return back(shiftDate(now, -29), 30);
  const start = month + "-01";
  const current = month === now.slice(0, 7);
  const end = current ? now : endOfMonth(month);
  const days = span(start, end);
  const previousStart = addMonths(start, -1);
  const previousMonthEnd = shiftDate(start, -1);
  // The current month so far compares with as many days of the month before.
  const previousEnd = current
    ? [shiftDate(previousStart, days - 1), previousMonthEnd].sort()[0]
    : previousMonthEnd;
  return {
    start,
    end,
    days,
    previousStart,
    previousEnd,
    previousDays: span(previousStart, previousEnd),
  };
}
/**
 * Workouts per active week, over finished weeks only: the Monday-Sunday week
 * that contains `now` is left out until it is over, so a quiet start to the
 * week does not drag the figure down. An active week has at least one workout.
 * Null, shown as a dash, when no finished week has a workout.
 */
function perWeek(workouts: Workout[], now: string) {
  const thisWeek = weekStart(now);
  const finished = workouts.filter(
    (workout) => weekStart(workout.date) < thisWeek,
  );
  const activeWeeks = new Set(finished.map((w) => weekStart(w.date))).size;
  return activeWeeks ? finished.length / activeWeeks : null;
}
export function summarize(workouts: Workout[], days: number, now: string) {
  const durations = workouts.flatMap((w) =>
    w.duration === null ? [] : [w.duration],
  );
  const sets = workouts
    .flatMap((w) => w.exercises.flatMap((ex) => ex.sets))
    .filter((set) => set.done && validSet(set));
  // A set and its drops count as one set; volume still includes every drop.
  const counted = sets.filter((set) => !isDrop(set));
  // Cardio is shown as time and distance; it is never volume or a strength set.
  const strengthCounted = counted.filter((set) => !isCardioSet(set));
  const cardio = cardioTotals(sets.filter(isCardioSet));
  return {
    cardioSec: cardio.durationSec,
    cardioM: cardio.distanceM,
    cardioKcal: cardio.calories,
    volume: sets.reduce(
      (sum, set) =>
        sum +
        (set.load === "weight" &&
        set.measure !== "seconds" &&
        set.measure !== "cardio"
          ? (set.weight ?? 0) * (set.reps ?? 0)
          : 0),
      0,
    ),
    workouts: workouts.length,
    perWeek: perWeek(workouts, now),
    duration: durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null,
    minutes: durations.length
      ? durations.reduce((sum, value) => sum + value, 0)
      : null,
    sets: counted.length,
    workingSets: strengthCounted.filter((set) => set.section === "working")
      .length,
  };
}
export function metricChange(
  value: number | null,
  previous: number | null,
  decimals = 0,
) {
  if (value === null || previous === null) return "No comparison";
  const change = Number((value - previous).toFixed(decimals));
  return change === 0
    ? "→ No change"
    : `${change > 0 ? "↑ +" : "↓ −"}${Math.abs(change).toFixed(decimals)}`;
}
