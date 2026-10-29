import { shiftDate, weekStart } from "@/lib/dates";
import { doneSetCount } from "@/data/selectors";
import type { Workout } from "@/data/model";

type Logged = Pick<Workout, "date" | "duration" | "exercises">;

export type WeekDay = {
  date: string;
  /** Single-letter weekday, Monday first. */
  label: string;
  /** Day of the month. */
  day: number;
  done: boolean;
  today: boolean;
};

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday to Sunday of the week that contains `now`, marking days with a workout. */
export function weekStrip(dates: readonly string[], now: string): WeekDay[] {
  const start = weekStart(now);
  const done = new Set(dates);
  return LETTERS.map((label, index) => {
    const date = shiftDate(start, index);
    return {
      date,
      label,
      day: Number(date.slice(8)),
      done: done.has(date),
      today: date === now,
    };
  });
}

/** Workouts, finished sets and minutes trained in the week that contains `now`. */
export function weekTotals(workouts: readonly Logged[], now: string) {
  const start = weekStart(now);
  const week = workouts.filter((w) => weekStart(w.date) === start);
  return {
    workouts: week.length,
    sets: week.reduce((n, w) => n + doneSetCount(w), 0),
    minutes: week.reduce((n, w) => n + (w.duration ?? 0), 0),
  };
}

/**
 * Consecutive weeks that met the goal. The count ends with last week; the
 * current week joins it once it reaches the goal too. Zero without a goal.
 */
export function goalStreak(
  dates: readonly string[],
  goal: number | null,
  now: string,
) {
  if (!goal) return 0;
  const perWeek = new Map<string, number>();
  for (const date of dates) {
    const week = weekStart(date);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }
  const thisWeek = weekStart(now);
  let streak = (perWeek.get(thisWeek) ?? 0) >= goal ? 1 : 0;
  for (
    let week = shiftDate(thisWeek, -7);
    (perWeek.get(week) ?? 0) >= goal;
    week = shiftDate(week, -7)
  )
    streak++;
  return streak;
}
