// Week matching (v6 spec §D9): which planned workout days of a week were
// done, missed or moved. A finished workout fills at most one planned day of
// its week, tried in turn: the planned day on its own date, the nearest
// planned day whose cell is its routine, the earliest open planned day on or
// before its date. A second workout on a planned day that is already filled
// is an extra. A workout that fills a day on another date is moved from
// that date; one that fills nothing is an extra. A planned day moved in the
// plan itself (the week strip's drag writes an override pair) also reads as
// moved from its old day. Pure, so it is tested (tests/week-match.test.ts).
import type { Plan } from "./model";
import { REST, planDay } from "./plans";
import { isWorkoutCell } from "./plan-moves";
import { daysBetween, shiftDate } from "../lib/dates";

type PlanLike = Pick<
  Plan,
  "startDate" | "endDate" | "cycleWeeks" | "template" | "overrides"
>;

/** A finished workout as matching needs it. */
export type DoneWorkout = {
  id: string;
  date: string;
  routineId?: string | null;
};

export type DayState =
  "done" | "missed" | "planned" | "plannedToday" | "today" | "rest";

export type DayMatch = {
  date: string;
  /** The planned workout cell (after overrides), or null when none is planned. */
  planned: string | null;
  /** Every finished workout on the date, extras included. */
  workoutIds: string[];
  state: DayState;
  /** The day this one's workout was planned on or moved from, when another. */
  movedFrom?: string;
  /** The day this one's planned workout went to (done or moved there). */
  movedTo?: string;
  /** Set by P6 (Sport): the day was filled by other training. */
  other?: boolean;
};

export type WeekMatch = {
  days: DayMatch[];
  /** Every planned day of the week is matched. */
  fulfilled: boolean;
  /** Finished workouts that filled no planned day. */
  extras: number;
  /** Planned days filled by a finished workout. */
  matched: number;
  /** Planned workout days in the week. */
  planned: number;
};

/** A routine-only resolver: a cell that is a routine id, else null. */
export const routineCell = (cell: string | null | undefined) =>
  cell && cell !== REST && !cell.includes(":") ? cell : null;

/** The planned cell of a date inside the plan's period, or null. */
function plannedCell(
  plan: PlanLike,
  date: string,
  isWorkout: (cell: string | null | undefined) => boolean,
) {
  if (date < plan.startDate || date > plan.endDate) return null;
  const { cell } = planDay(plan, date);
  return isWorkout(cell) ? cell : null;
}

/**
 * The date a planned day was moved from by the plan's overrides: `date` holds
 * an override workout the template does not have there, and another day of
 * the week whose template had that workout no longer holds it. The nearest
 * such day wins.
 */
function overrideSource(plan: PlanLike, date: string, week: string[]) {
  if (!(date in plan.overrides)) return undefined;
  const cell = plan.overrides[date];
  const template = (d: string) => planDay({ ...plan, overrides: {} }, d).cell;
  if (!isWorkoutCell(cell) || template(date) === cell) return undefined;
  let best: string | undefined;
  for (const other of week) {
    if (other === date || !(other in plan.overrides)) continue;
    if (template(other) !== cell || plan.overrides[other] === cell) continue;
    if (
      !best ||
      Math.abs(daysBetween(other, date)) < Math.abs(daysBetween(best, date))
    )
      best = other;
  }
  return best;
}

/**
 * Matches a week's finished workouts to its planned days. `weekStart` is the
 * Monday; workouts outside the week or after `today` are ignored. `resolve`
 * maps a cell to the routine id it starts (null for a group or day type), and
 * `isWorkout` says which cells are workout days.
 */
export function matchWeek(
  plan: PlanLike,
  done: readonly DoneWorkout[],
  weekStart: string,
  today: string,
  resolve: (cell: string | null) => string | null = routineCell,
  isWorkout: (cell: string | null | undefined) => boolean = isWorkoutCell,
): WeekMatch {
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
  const planned = new Map<string, string>();
  for (const date of dates) {
    const cell = plannedCell(plan, date, isWorkout);
    if (cell) planned.set(date, cell);
  }
  const workouts = done
    .filter((w) => dates.includes(w.date) && w.date <= today)
    .map((w, i) => ({ w, i }))
    .sort((a, b) => a.w.date.localeCompare(b.w.date) || a.i - b.i)
    .map(({ w }) => w);

  /** Planned date to the date of the workout that filled it. */
  const filled = new Map<string, string>();
  let extras = 0;
  for (const w of workouts) {
    const open = [...planned.keys()].filter((d) => !filled.has(d));
    let target: string | undefined = open.find((d) => d === w.date);
    // A second workout on a planned day already filled is a double session:
    // an extra, never a later day done early.
    const doubled = !target && planned.has(w.date);
    if (!target && !doubled && w.routineId) {
      const same = open.filter(
        (d) => resolve(planned.get(d) ?? null) === w.routineId,
      );
      same.sort(
        (a, b) =>
          Math.abs(daysBetween(w.date, a)) - Math.abs(daysBetween(w.date, b)) ||
          a.localeCompare(b),
      );
      target = same[0];
    }
    if (!target && !doubled) target = open.find((d) => d <= w.date);
    if (target) filled.set(target, w.date);
    else extras++;
  }

  const days = dates.map((date): DayMatch => {
    const cell = planned.get(date) ?? null;
    const workoutIds = workouts.filter((w) => w.date === date).map((w) => w.id);
    const day: DayMatch = { date, planned: cell, workoutIds, state: "rest" };
    const source = overrideSource(plan, date, dates);
    if (source) day.movedFrom = source;
    const filledFrom = [...filled].find(([, on]) => on === date)?.[0];
    if (filledFrom && filledFrom !== date)
      day.movedFrom = overrideSource(plan, filledFrom, dates) ?? filledFrom;
    const filledOn = filled.get(date);
    if (filledOn && filledOn !== date) day.movedTo = filledOn;
    if (workoutIds.length) day.state = "done";
    else if (cell && !filled.has(date))
      day.state =
        date < today ? "missed" : date === today ? "plannedToday" : "planned";
    else day.state = date === today ? "today" : "rest";
    return day;
  });
  // The old day of a plan move points at its new day.
  for (const day of days)
    if (day.movedFrom && !days.find((d) => d.date === day.movedFrom)?.movedTo) {
      const from = days.find((d) => d.date === day.movedFrom);
      if (from && !from.planned) from.movedTo = day.date;
    }

  return {
    days,
    fulfilled: [...planned.keys()].every((d) => filled.has(d)),
    extras,
    matched: filled.size,
    planned: planned.size,
  };
}
