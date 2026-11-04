import { shiftDate, weekStart, weekdayIndex, weekdayNames } from "@/lib/dates";
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

/** Monday to Sunday of the week that contains `now`, marking days with a workout. */
export function weekStrip(dates: readonly string[], now: string): WeekDay[] {
  const start = weekStart(now);
  const done = new Set(dates);
  return weekdayNames("narrow").map((label, index) => {
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

/** One Monday-to-Sunday week of the weekly-goal strip. */
export type GoalWeek = {
  /** The Monday, YYYY-MM-DD. */
  start: string;
  workouts: number;
  met: boolean;
  /** The week that holds `now`; it is still running. */
  current: boolean;
  /** False for weeks before the first workout: they are not counted against the goal. */
  tracked: boolean;
};

export type WeeklyGoalStats = {
  goal: number;
  /** Workouts so far this week. */
  done: number;
  /** Days left in this week, today included: 7 on Monday, 1 on Sunday. */
  daysLeft: number;
  /** Finished weeks that met the goal, out of the tracked ones among the last 4 and 12. */
  last4: { met: number; of: number };
  last12: { met: number; of: number };
  /** Consecutive weeks met, as `goalStreak` counts them. */
  streak: number;
  /** The longest run of met weeks since the first workout. */
  best: number;
  /** The last `weeks` weeks, oldest first, ending with this week. */
  series: GoalWeek[];
};

/**
 * The Goals tab's weekly-goal figures. Finished weeks count from the week of
 * the first workout on, so a new user is not marked down for weeks before it;
 * the running week is never in the hit rate.
 */
export function weeklyGoalStats(
  dates: readonly string[],
  goal: number,
  now: string,
  weeks = 12,
): WeeklyGoalStats {
  const thisWeek = weekStart(now);
  const perWeek = new Map<string, number>();
  let first: string | null = null;
  for (const date of dates) {
    if (date > now) continue;
    const week = weekStart(date);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
    if (first === null || week < first) first = week;
  }
  const count = (week: string) => perWeek.get(week) ?? 0;
  const tracked = (week: string) => first !== null && week >= first;
  const hitRate = (n: number) => {
    let met = 0;
    let of = 0;
    for (let i = 1; i <= n; i++) {
      const week = shiftDate(thisWeek, -7 * i);
      if (!tracked(week)) break;
      of++;
      if (count(week) >= goal) met++;
    }
    return { met, of };
  };
  let best = 0;
  if (first !== null)
    for (
      let week = first, run = 0;
      week <= thisWeek;
      week = shiftDate(week, 7)
    ) {
      run = count(week) >= goal ? run + 1 : 0;
      best = Math.max(best, run);
    }
  const series = Array.from({ length: weeks }, (_, i) => {
    const start = shiftDate(thisWeek, -7 * (weeks - 1 - i));
    return {
      start,
      workouts: count(start),
      met: count(start) >= goal,
      current: start === thisWeek,
      tracked: tracked(start),
    };
  });
  const streak = goalStreak(dates, goal, now);
  return {
    goal,
    done: count(thisWeek),
    daysLeft: 7 - weekdayIndex(now),
    last4: hitRate(4),
    last12: hitRate(12),
    streak,
    best: Math.max(best, streak),
    series,
  };
}
