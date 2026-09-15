import { type Workout, type RecordDoc, validSet } from "./model";
import { progressFor } from "./analytics";

export function improvementRate(
  records: RecordDoc[],
  start: string,
  end: string,
) {
  let compared = 0,
    improved = 0;
  for (const exercise of progressFor(records)) {
    const points = exercise.points.filter((point) => point.date <= end);
    const latest = points.at(-1);
    if (!latest || latest.date < start) continue;
    const weighted = latest.e1rm !== null;
    const comparable = points.filter(
      (point) =>
        point.set.load === latest.set.load &&
        (weighted
          ? point.e1rm !== null
          : latest.set.load === "bodyweight" ||
            point.set.weight === latest.set.weight),
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

const dayMs = 86400000;
const dateAt = (date: string) => new Date(date + "T00:00:00Z");
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function shiftDate(date: string, days: number) {
  return dateKey(new Date(dateAt(date).getTime() + days * dayMs));
}
export function historyPeriod(month: string, now: string) {
  if (month === "6m" || month === "12m") {
    const date = dateAt(now);
    const count = month === "6m" ? 6 : 12;
    const target = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - count, 1),
    );
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
    const start = shiftDate(dateKey(target), 1);
    const days =
      Math.round((date.getTime() - dateAt(start).getTime()) / dayMs) + 1;
    return {
      start,
      end: now,
      days,
      previousStart: shiftDate(start, -days),
      previousEnd: shiftDate(start, -1),
      previousDays: days,
    };
  }
  if (!month) {
    const start = shiftDate(now, -29);
    return {
      start,
      end: now,
      days: 30,
      previousStart: shiftDate(start, -30),
      previousEnd: shiftDate(start, -1),
      previousDays: 30,
    };
  }
  const start = month + "-01";
  const first = dateAt(start);
  const endOfMonth = dateKey(
    new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)),
  );
  const end = month === now.slice(0, 7) ? now : endOfMonth;
  const days =
    Math.round((dateAt(end).getTime() - first.getTime()) / dayMs) + 1;
  const previousStart = dateKey(
    new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1)),
  );
  const previousMonthEnd = shiftDate(start, -1);
  const previousEnd =
    month === now.slice(0, 7)
      ? [shiftDate(previousStart, days - 1), previousMonthEnd].sort()[0]
      : previousMonthEnd;
  const previousDays =
    Math.round(
      (dateAt(previousEnd).getTime() - dateAt(previousStart).getTime()) / dayMs,
    ) + 1;
  return { start, end, days, previousStart, previousEnd, previousDays };
}
export function weekStart(date: string) {
  return shiftDate(date, -((dateAt(date).getUTCDay() + 6) % 7));
}
export function summarize(workouts: Workout[], days: number) {
  const durations = workouts.flatMap((w) =>
    w.duration === null ? [] : [w.duration],
  );
  const sets = workouts
    .flatMap((w) => w.exercises.flatMap((ex) => ex.sets))
    .filter((set) => set.done && validSet(set));
  return {
    volume: sets.reduce(
      (sum, set) =>
        sum + (set.load === "weight" ? (set.weight ?? 0) * (set.reps ?? 0) : 0),
      0,
    ),
    workouts: workouts.length,
    perWeek: workouts.length
      ? workouts.length /
        new Set(workouts.map((workout) => weekStart(workout.date))).size
      : 0,
    duration: durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null,
    minutes: durations.length
      ? durations.reduce((sum, value) => sum + value, 0)
      : null,
    sets: sets.length,
    workingSets: sets.filter((set) => set.section === "working").length,
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
