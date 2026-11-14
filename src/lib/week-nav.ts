import { canMoveTo } from "@/data/plan-moves";
import { plannedFor } from "@/data/plans";
import type { Plan } from "@/data/model";
import { daysBetween, shiftDate, weekStart } from "@/lib/dates";

/**
 * Train's week strip can show another week while a planned workout moves
 * into it: the day sheet's ‹ › follow the workout across a week's edge, and a
 * lifted day dragged past the strip's edge and held there steps the strip a
 * week. The strip's week is an offset in whole weeks from the week that holds
 * today. Pure, so it is tested (tests/week-nav.test.ts); WeekCard plays it.
 */

type PlanLike = Plan & { id: string };

/** Whole weeks from the week that holds `today` to the week that holds `date`. */
export const weekOffsetOf = (date: string, today: string) =>
  Math.round(daysBetween(weekStart(today), weekStart(date)) / 7);

/** The day at weekday `index` (0 = Monday) of the week `offset` weeks from today's. */
export const dateInWeek = (today: string, offset: number, index: number) =>
  shiftDate(weekStart(today), offset * 7 + index);

/** Monday to Sunday of the week `offset` weeks from today's. */
export const weekDates = (today: string, offset: number) =>
  Array.from({ length: 7 }, (_, index) => dateInWeek(today, offset, index));

/**
 * The days of the shown week that the workout planned on `from` may move to,
 * by the same rule as the arrows and the drop (`canMoveTo`): today or later,
 * in the same plan, not the day it is on.
 */
export function allowedInWeek<T extends PlanLike>(
  plans: readonly T[],
  from: string,
  today: string,
  offset: number,
): string[] {
  return weekDates(today, offset).filter((date) =>
    canMoveTo(plans, from, date, today),
  );
}

/**
 * The weeks the strip may show while the workout on `from` is dragged: from
 * the week that holds today (or the plan's first day, if later) to the week
 * of the plan's last day. Null when nothing is planned on `from`.
 */
export function weekRange<T extends PlanLike>(
  plans: readonly T[],
  from: string,
  today: string,
): { min: number; max: number } | null {
  const found = plannedFor(plans, from);
  if (!found) return null;
  const first = found.plan.startDate > today ? found.plan.startDate : today;
  const min = weekOffsetOf(first, today);
  return { min, max: Math.max(min, weekOffsetOf(found.plan.endDate, today)) };
}

// ---- Holding a lifted day past the strip's edge.

/** Held this long in the edge zone, the strip shows the next (or previous) week. */
export const EDGE_HOLD_MS = 600;
/** Pushed this far past the end day's stop, it changes week at once. */
export const EDGE_OVERSHOOT = 40;
/** After the strip has shown the week it stays: the strip returns to today's week this much later. */
export const LINGER_MS = 1200;

/** -1 the left edge (an earlier week), 1 the right edge (a later week), 0 neither. */
export type EdgeSide = -1 | 0 | 1;

export type EdgeState = {
  side: EdgeSide;
  /** When the finger entered the zone, or when the strip last changed week. */
  since: number;
  /** Whether a push past EDGE_OVERSHOOT may change week (once per push). */
  armed: boolean;
};

export const EDGE_IDLE: EdgeState = { side: 0, since: 0, armed: true };

export type EdgeInput = {
  /** Which end stop the ring is pushed past. */
  side: EdgeSide;
  /** How far past it, in px (0 inside the strip). */
  over: number;
  /** Where the edge zone starts, px past the stop: about the finger past the strip's edge. */
  zone: number;
  /** Whether the strip may show a week on that side (the plan has days there). */
  canStep: boolean;
  now: number;
};

export type EdgeResult = {
  state: EdgeState;
  /** The week to step now: -1, 1, or 0 for none. */
  step: EdgeSide;
  /** Ms until the hold completes, to look again then; null outside the zone. */
  wait: number | null;
};

/**
 * One look at the finger while a lifted day is dragged. Outside the zone,
 * nothing. In the zone, the hold runs: after `holdMs` the strip steps a week
 * and the hold starts over, so holding on steps on. A push past `overshoot`
 * steps at once, and again only after the finger eases back under it. A small
 * overshoot that is let go before `holdMs` never changes the week.
 */
export function edgeHold(
  state: EdgeState,
  { side, over, zone, canStep, now }: EdgeInput,
  holdMs = EDGE_HOLD_MS,
  overshoot = EDGE_OVERSHOOT,
): EdgeResult {
  if (!side || !canStep || over < zone)
    return { state: EDGE_IDLE, step: 0, wait: null };
  let next: EdgeState =
    state.side === side ? state : { side, since: now, armed: true };
  if (!next.armed && over < overshoot) next = { ...next, armed: true };
  if (next.armed && over >= overshoot)
    return {
      state: { side, since: now, armed: false },
      step: side,
      wait: holdMs,
    };
  const held = now - next.since;
  if (held >= holdMs)
    return {
      state: { side, since: now, armed: over < overshoot },
      step: side,
      wait: holdMs,
    };
  return { state: next, step: 0, wait: holdMs - held };
}

/**
 * The ring's give past an end stop: it follows a push past the first or last
 * day only a little, and less the further it goes, at most `max` px.
 */
export const resistance = (over: number, max = 12) =>
  over <= 0 ? 0 : (max * over) / (over + 2 * max);
