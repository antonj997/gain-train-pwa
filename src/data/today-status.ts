import type { Workout } from "./model";
import type { PlannedDay } from "./plans";
import type { CategoriesOf } from "./muscle-sets";
import { doneSetCount } from "./selectors";
import { shiftDate } from "../lib/dates";

/**
 * What Train's Today card shows once the day has been trained. Pure, so it is
 * tested (tests/today-status.test.ts); the card only formats what this
 * returns.
 *
 * - "open": nothing is finished today, so the card offers today's workout as
 *   before (see `todayPick` in today.ts).
 * - "done": a workout is finished today and no plan runs today (none, one
 *   still to start, an ended or a paused one). The card says so with the
 *   newest workout.
 * - "planDone": a workout is finished today inside a running plan. `fit` says
 *   how today's workouts sit against today's cell:
 *   - "match": today held a workout and one of today's workouts matches it;
 *   - "other": today held a workout, and none of them matches it;
 *   - "rest": today was a rest day in the plan;
 *   - "unplanned": nothing was planned today (or a deleted routine).
 *
 * A running workout is not this helper's business: Train shows the
 * "in progress" card instead of the Today card while one runs.
 */
export type TodayStatus<W extends DoneWorkout = DoneWorkout> =
  | { kind: "open" }
  | {
      kind: "done";
      /** Today's finished workouts, newest first. */
      workouts: W[];
    }
  | {
      kind: "planDone";
      workouts: W[];
      /** Today's cell as Train shows it; null for nothing planned. */
      planned: PlannedDay | null;
      fit: TodayFit;
      /**
       * Off plan only: a planned day in the coming week that matches what was
       * done, so "Count today's workout as …" can move it to today (and today's
       * planned workout, if any, to its date). Null when none matches.
       */
      countAs: UpcomingDay | null;
      /**
       * Off plan only: the planned day "Move …" opens in the day sheet. Today
       * when it held another workout; else the next planned day, since a
       * workout on a rest day may call for an extra day before the next one.
       */
      moveDate: string | null;
    };

export type TodayFit = "match" | "other" | "rest" | "unplanned";

/** A finished workout as far as this helper needs it. */
export type DoneWorkout = {
  id: string;
  payload: Pick<
    Workout,
    "routineId" | "date" | "exercises" | "completedAt" | "startedAt"
  >;
};

export type UpcomingDay = { date: string; day: PlannedDay };

/** "Count as" looks this many days ahead, today's week and a little more. */
export const COUNT_AS_DAYS = 7;

/**
 * The share of a workout's done sets that must fall in a day type's or
 * group's categories for it to count as that day.
 */
export const CATEGORY_SHARE = 0.5;

/**
 * Whether a finished workout counts as a planned day: the match rule.
 *
 * - A routine day matches a workout started from that routine (its
 *   `routineId`). An empty workout with the same exercises does not: the
 *   plan named a routine, and only the routine says it was that routine.
 * - A day type (Push, Legs …) matches when at least half of the workout's
 *   done sets are in the type's categories. Each exercise counts with its main
 *   category only (the catalogue's, else the custom exercise's), so a Pull
 *   workout with two sets of curls is not a Push day just because both have
 *   Arms. Sets whose exercise has no known category, or "Other", are left
 *   out; a workout with none left matches, since nothing says it is wrong.
 * - A group matches a workout started from one of its routines, or else by
 *   the group's categories as a day type does (a group without categories
 *   only by its routines).
 * - A rest day matches nothing.
 */
export function matchesPlanned(
  workout: DoneWorkout["payload"],
  day: PlannedDay,
  categoriesOf: CategoriesOf,
): boolean {
  if (day.kind === "rest") return false;
  const fromRoutine =
    !!workout.routineId && day.routineIds.includes(workout.routineId);
  if (day.kind === "routine") return fromRoutine;
  if (fromRoutine) return true;
  if (!day.categories.length) return false;
  return categoryShare(workout, day.categories, categoriesOf) >= CATEGORY_SHARE;
}

/**
 * The share (0–1) of a workout's done sets whose exercise's main category is
 * one of `categories`; 1 when no done set has a known category.
 */
export function categoryShare(
  workout: Pick<Workout, "exercises">,
  categories: readonly string[],
  categoriesOf: CategoriesOf,
): number {
  let total = 0;
  let inside = 0;
  for (const exercise of workout.exercises) {
    const category = categoriesOf(exercise.exerciseId).category;
    if (!category || category === "Other") continue;
    const sets = doneSetCount({ exercises: [exercise] });
    total += sets;
    if (categories.includes(category)) inside += sets;
  }
  return total ? inside / total : 1;
}

const finishedAt = (w: DoneWorkout) =>
  w.payload.completedAt ?? w.payload.startedAt ?? 0;

/**
 * Today's card state from today's finished workouts and the running plan.
 *
 * `plan` is the plan running today (not paused, its period holds today), or
 * null. `planned` is today's cell resolved for Train (null for nothing or a
 * deleted routine). `upcoming` are the plan's next planned workout days after
 * today, in date order, resolved the same way.
 */
export function todayStatus<W extends DoneWorkout>({
  today,
  completed,
  plan,
  planned,
  upcoming,
  categoriesOf,
}: {
  today: string;
  /** Finished workouts; only today's count. */
  completed: readonly W[];
  plan: { id: string } | null;
  planned: PlannedDay | null;
  upcoming: readonly UpcomingDay[];
  categoriesOf: CategoriesOf;
}): TodayStatus<W> {
  const workouts = completed
    .filter((w) => w.payload.date === today)
    .sort((a, b) => finishedAt(b) - finishedAt(a) || b.id.localeCompare(a.id));
  if (!workouts.length) return { kind: "open" };
  if (!plan) return { kind: "done", workouts };

  const matches = (day: PlannedDay) =>
    workouts.some((w) => matchesPlanned(w.payload, day, categoriesOf));
  const fit: TodayFit = !planned
    ? "unplanned"
    : planned.kind === "rest"
      ? "rest"
      : matches(planned)
        ? "match"
        : "other";
  if (fit === "match")
    return {
      kind: "planDone",
      workouts,
      planned,
      fit,
      countAs: null,
      moveDate: null,
    };
  const last = shiftDate(today, COUNT_AS_DAYS);
  const ahead = upcoming.filter(
    (u) => u.date > today && u.date <= last && u.day.kind !== "rest",
  );
  return {
    kind: "planDone",
    workouts,
    planned,
    fit,
    countAs: ahead.find((u) => matches(u.day)) ?? null,
    moveDate:
      fit === "other"
        ? today
        : (upcoming.find((u) => u.date > today)?.date ?? null),
  };
}
