import type { Plan } from "./model";
import { REST, planDay, plannedFor } from "./plans";

/**
 * Moving and skipping one planned day from Train's week strip and day sheet.
 * Every change is a dated override on the plan (`overrides[date]`), the same
 * field the plan editor's Upcoming calendar writes, so the synced record keeps
 * its shape. An override equal to the template is dropped, so moving a
 * workout back where it came from leaves no trace. Pure, so it is tested.
 */

type PlanLike = Plan & { id: string };

/** A cell that is a workout to train (a routine, a day type or a group): not empty and not rest. */
export const isWorkoutCell = (cell: string | null | undefined) =>
  !!cell && cell !== REST;

/** The plan with `date` holding `cell`; an override equal to the template is removed. */
function withCell(plan: Plan, date: string, cell: string | null): Plan {
  const overrides = { ...plan.overrides };
  const template = planDay({ ...plan, overrides: {} }, date).cell;
  if (cell === template) delete overrides[date];
  else overrides[date] = cell;
  return { ...plan, overrides };
}

/**
 * The plan with the workout on `from` moved to `to`. When `to` holds another
 * workout the two trade days; otherwise `from` is left with nothing planned
 * (a rest day it lands on is simply replaced).
 */
export function moveDay(plan: Plan, from: string, to: string): Plan {
  if (from === to) return plan;
  const a = planDay(plan, from).cell;
  const b = planDay(plan, to).cell;
  return withCell(withCell(plan, to, a), from, isWorkoutCell(b) ? b : null);
}

/** The plan with `date` made a rest day. */
export const skipDay = (plan: Plan, date: string): Plan =>
  withCell(plan, date, REST);

/** How a date read before a change, so Undo can put exactly that back. */
export type DaySnapshot = { date: string; had: boolean; cell: string | null };

export const snapshotDay = (plan: Plan, date: string): DaySnapshot => ({
  date,
  had: date in plan.overrides,
  cell: plan.overrides[date] ?? null,
});

/** The plan with a date restored to a snapshot taken before a change. */
export function restoreDay(plan: Plan, snap: DaySnapshot): Plan {
  const overrides = { ...plan.overrides };
  if (snap.had) overrides[snap.date] = snap.cell;
  else delete overrides[snap.date];
  return { ...plan, overrides };
}

/**
 * Whether the workout planned on `from` can go to `to`: both days lie in the
 * same running plan, `to` is today or later and differs from `from`.
 */
export function canMoveTo<T extends PlanLike>(
  plans: readonly T[],
  from: string,
  to: string,
  today: string,
): boolean {
  if (to === from || to < today) return false;
  const source = plannedFor(plans, from);
  const target = plannedFor(plans, to);
  return !!source && !!target && source.plan.id === target.plan.id;
}

/** Whether a day's planned workout can be moved or skipped: a workout, today or later. */
export function canEditDay<T extends PlanLike>(
  plans: readonly T[],
  date: string,
  today: string,
): boolean {
  if (date < today) return false;
  return isWorkoutCell(plannedFor(plans, date)?.cell);
}
