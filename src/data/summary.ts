import { type Workout, validSet } from "./model";

const dayMs = 86400000;
const dateAt = (date: string) => new Date(date + "T00:00:00Z");
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export function shiftDate(date: string, days: number) {
  return dateKey(new Date(dateAt(date).getTime() + days * dayMs));
}
export function historyPeriod(month: string, now: string) {
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
    workouts: workouts.length,
    perWeek: (workouts.length * 7) / days,
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
