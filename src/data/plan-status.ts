// The plan's status page (/library/plan/:id): where the phase is, how well the
// plan is followed, whether the lifts keep up with the planned progression and
// the weekly sets per muscle group. Pure, so it is tested
// (tests/plan-status.test.ts); the page only formats what these return.
import {
  labelSet,
  type Plan,
  type RecordDoc,
  type Workout,
  type WorkoutSet,
} from "./model";
import { REST, planDay } from "./plans";
import { isWorkoutCell } from "./plan-moves";
import { isDeloadWeek, phaseWeek, phaseWeeks, progressionWeeks } from "./phase";
import { exerciseSessions } from "./exercise-records";
import { exerciseOverview, signedLoad } from "./exercise-overview";
import {
  MUSCLE_GROUPS,
  MUSCLE_SCALE_MIN,
  WEEKLY_SET_GUIDE,
  guideStatus,
  hardSetsByMuscle,
  type CategoriesOf,
  type MuscleGroup,
  type MuscleSetRow,
} from "./muscle-sets";
import { completedWorkouts } from "./selectors";
import { loadIncrement } from "../lib/progression";
import { daysBetween, shiftDate, weekStart } from "../lib/dates";
import { formatWeightValue } from "../lib/units";

type PlanLike = Pick<
  Plan,
  "startDate" | "endDate" | "cycleWeeks" | "template" | "overrides"
> & { paused?: boolean };
type Records = Record<string, RecordDoc> | readonly RecordDoc[];
/** Whether a cell is a workout to train. The page passes one that also drops deleted routines and groups. */
export type IsWorkout = (cell: string | null | undefined) => boolean;

/** The first day of the phase's week `week` (1-based); week 1 can start before the plan. */
const weekFirstDay = (plan: Pick<Plan, "startDate">, week: number) =>
  shiftDate(weekStart(plan.startDate), (week - 1) * 7);

// ---------------------------------------------------------------- the phase

export type PhaseStatus =
  | { kind: "upcoming"; weeks: number; daysUntil: number }
  | {
      kind: "running";
      week: number;
      weeks: number;
      /** Days from today to the last day; 0 on the last day. */
      daysLeft: number;
      deloadNow: boolean;
      /** The next deload week after this one and the days until its first day in the plan. */
      nextDeload: { week: number; inDays: number } | null;
    }
  | { kind: "ended"; weeks: number };

/** Where `today` sits in the phase: not started, week n of N with the next deload, or ended. */
export function phaseStatus(plan: Plan, today: string): PhaseStatus {
  const weeks = phaseWeeks(plan);
  if (today < plan.startDate)
    return {
      kind: "upcoming",
      weeks,
      daysUntil: daysBetween(today, plan.startDate),
    };
  if (today > plan.endDate) return { kind: "ended", weeks };
  const at = phaseWeek(plan, today)!;
  let nextDeload: { week: number; inDays: number } | null = null;
  for (let week = at.week + 1; week <= weeks; week++)
    if (isDeloadWeek(plan, week)) {
      const first = weekFirstDay(plan, week);
      nextDeload = { week, inDays: daysBetween(today, first) };
      break;
    }
  return {
    kind: "running",
    week: at.week,
    weeks,
    daysLeft: daysBetween(today, plan.endDate),
    deloadNow: at.deload,
    nextDeload,
  };
}

/** The fewest and most planned workouts in a template week, for "3 workouts a week". Null when no week has any. */
export function workoutsPerWeek(
  plan: Pick<Plan, "template">,
  isWorkout: IsWorkout = isWorkoutCell,
): { min: number; max: number } | null {
  const counts = plan.template.map((row) => row.filter(isWorkout).length);
  const max = Math.max(0, ...counts);
  if (!max) return null;
  return { min: Math.min(...counts), max };
}

// ---------------------------------------------------------------- adherence

/**
 * One planned workout day as the week grid draws it: done, missed (a past day
 * with no finished workout), still to come this week (today counts here until
 * a workout is finished), in a later week, or after a paused plan stopped
 * counting.
 */
export type DayState = "done" | "missed" | "upcoming" | "future" | "paused";

export type WeekColumn = {
  week: number;
  /** The planned workout days of the week, in date order. */
  days: { date: string; state: DayState }[];
};

export type AdherenceBand = "good" | "behind" | "off";

export type Adherence = {
  /** Planned workout days that have passed (today once it is done). */
  planned: number;
  done: number;
  missed: number;
  /** Done of planned in whole percent; null before any planned day has passed. */
  percent: number | null;
  band: AdherenceBand | null;
  /** Workouts that an override put on a date the template had for something else. */
  moved: number;
  /** Template workouts that an override made a rest day. */
  skipped: number;
  weeks: WeekColumn[];
};

/** ≥ 85 % follows the plan, 65–84 % is a little behind, under 65 % is not followed. */
export const ADHERENCE_BANDS = { good: 85, behind: 65 } as const;
export const adherenceBand = (percent: number): AdherenceBand =>
  percent >= ADHERENCE_BANDS.good
    ? "good"
    : percent >= ADHERENCE_BANDS.behind
      ? "behind"
      : "off";

/**
 * How well the plan is followed. A planned day is a date in the period whose
 * cell (overrides first, then the template) is a workout: a routine, group or
 * day type, not rest or empty. Days from the start up to yesterday count, and
 * today once a workout is finished on it. A planned day is done when any
 * finished workout falls on that date, so a moved workout counts on its new
 * date, and an extra workout on an unplanned day never lifts the share past
 * 100 %. A day skipped to rest is not planned, so it is not missed: it is
 * counted apart as skipped, as are moved workouts (overrides against the
 * template, up to today).
 *
 * `countUntil` stops counting after that date: a paused plan does not save
 * when it was paused, so the page passes the last workout inside the plan.
 */
export function planAdherence(
  plan: PlanLike,
  doneDates: ReadonlySet<string>,
  today: string,
  {
    isWorkout = isWorkoutCell,
    countUntil,
  }: { isWorkout?: IsWorkout; countUntil?: string } = {},
): Adherence {
  const weeks: WeekColumn[] = [];
  const thisWeek = weekStart(today);
  let planned = 0;
  let done = 0;
  const total = phaseWeeks(plan);
  for (let week = 1; week <= total; week++) {
    const first = weekFirstDay(plan, week);
    const days: WeekColumn["days"] = [];
    for (let i = 0; i < 7; i++) {
      const date = shiftDate(first, i);
      if (date < plan.startDate || date > plan.endDate) continue;
      if (!isWorkout(planDay(plan, date).cell)) continue;
      let state: DayState;
      if (countUntil !== undefined && date > countUntil && date <= today)
        state = "paused";
      else if (date < today) state = doneDates.has(date) ? "done" : "missed";
      else if (date === today)
        state = doneDates.has(date) ? "done" : "upcoming";
      else state = first === thisWeek ? "upcoming" : "future";
      if (state === "done" || state === "missed") planned++;
      if (state === "done") done++;
      days.push({ date, state });
    }
    weeks.push({ week, days });
  }
  let moved = 0;
  let skipped = 0;
  const last = [today, plan.endDate, countUntil ?? today].sort()[0];
  for (const [date, cell] of Object.entries(plan.overrides)) {
    if (date < plan.startDate || date > last) continue;
    const template = planDay({ ...plan, overrides: {} }, date).cell;
    if (cell === template) continue;
    if (isWorkout(cell)) moved++;
    else if (cell === REST && isWorkout(template)) skipped++;
  }
  const percent = planned ? Math.round((done / planned) * 100) : null;
  return {
    planned,
    done,
    missed: planned - done,
    percent,
    band: percent === null ? null : adherenceBand(percent),
    moved,
    skipped,
    weeks,
  };
}

/**
 * For a paused plan: the last day to count, which is the newest finished
 * workout inside the period up to today, or the day before the start when
 * there is none. Undefined for a plan that is not paused.
 */
export function pausedCountUntil(
  plan: PlanLike,
  doneDates: Iterable<string>,
  today: string,
): string | undefined {
  if (!plan.paused) return undefined;
  let last = shiftDate(plan.startDate, -1);
  for (const date of doneDates)
    if (
      date >= plan.startDate &&
      date <= plan.endDate &&
      date <= today &&
      date > last
    )
      last = date;
  return last;
}

/** Dates of finished workouts. */
export const doneDatesOf = (records: Records) =>
  new Set(completedWorkouts(records).map((r) => r.payload.date));

// ---------------------------------------------------------------- next workout

/**
 * The next `count` planned workout days from today to the plan's end, in date
 * order. Today is left out once a workout is finished on it. A paused plan
 * plans nothing.
 */
export function nextPlannedDays(
  plan: PlanLike,
  today: string,
  doneToday: boolean,
  count: number,
  isWorkout: IsWorkout = isWorkoutCell,
): string[] {
  const days: string[] = [];
  if (plan.paused || count <= 0) return days;
  let date = plan.startDate > today ? plan.startDate : today;
  if (date === today && doneToday) date = shiftDate(date, 1);
  for (; date <= plan.endDate && days.length < count; date = shiftDate(date, 1))
    if (isWorkout(planDay(plan, date).cell)) days.push(date);
  return days;
}

/**
 * The next planned workout day from today to the plan's end, or null. Today is
 * left out once a workout is finished on it. A paused plan plans nothing.
 */
export function nextPlannedDay(
  plan: PlanLike,
  today: string,
  doneToday: boolean,
  isWorkout: IsWorkout = isWorkoutCell,
): string | null {
  return nextPlannedDays(plan, today, doneToday, 1, isWorkout)[0] ?? null;
}

// ---------------------------------------------------------------- progression

export type LiftStatus = "ahead" | "on" | "behind";

/**
 * A lift against its planned load: within half a load step is on plan, more
 * above is ahead and more below is behind.
 */
export function liftStatus(
  actualKg: number,
  plannedKg: number,
  step: number,
): LiftStatus {
  const half = step / 2 + 1e-6;
  const diff = actualKg - plannedKg;
  return diff > half ? "ahead" : diff < -half ? "behind" : "on";
}

/** The last day whose lifts count: today, or the plan's end once it is over. */
const lastCounted = (plan: Pick<Plan, "endDate">, today: string) =>
  today < plan.endDate ? today : plan.endDate;

/** The phase week to read the plan for: this week, week 1 before the start, the last after the end. */
export function currentPlanWeek(plan: Plan, today: string) {
  const day =
    today < plan.startDate
      ? plan.startDate
      : today > plan.endDate
        ? plan.endDate
        : today;
  return phaseWeek(plan, day)!.week;
}

/** An exercise's first and latest top set inside the plan's dates, with how many sessions there were. */
function topSets(
  plan: Pick<Plan, "startDate" | "endDate">,
  records: Records,
  exerciseId: string,
  today: string,
  bodyWeightKg: number | null,
) {
  const end = lastCounted(plan, today);
  const sessions = exerciseSessions(records, exerciseId).filter(
    (s) => s.date >= plan.startDate && s.date <= end,
  );
  const overview = exerciseOverview(sessions, bodyWeightKg);
  if (!overview?.sessions.length) return null;
  const first = overview.sessions[0];
  const latest = overview.sessions.at(-1)!;
  return {
    start: first.top,
    now: latest.top,
    nowDate: latest.date,
    sessions: overview.sessions.length,
  };
}

export type PlanLift = {
  exerciseId: string;
  name: string;
  /** The reps the plan's weights are for. */
  reps: number;
  /** The first top set inside the plan; null before the first session. */
  start: WorkoutSet | null;
  /** The progression's start weight, shown when there is no session yet. */
  startKg: number;
  /** The latest session's top set inside the plan, or null. */
  now: WorkoutSet | null;
  /** The planned working weight for the current plan week. */
  plannedKg: number;
  /** The latest top set against the plan for the week it was lifted in; null before a session. */
  status: LiftStatus | null;
};

/**
 * One row per progression lift: its first and latest top set inside the plan
 * and the planned weight this week. The status compares the latest top set's
 * load (added weight for bodyweight lifts) with the plan's weight for the week
 * of that session, so a lift done last week is not behind just because this
 * week's heavier session has not happened yet.
 */
export function planLifts(
  plan: Plan,
  records: Records,
  today: string,
  equipmentOf: (exerciseId: string) => string | undefined,
  bodyWeightKg: number | null = null,
): PlanLift[] {
  const week = currentPlanWeek(plan, today);
  return (plan.progression ?? []).map((item) => {
    const equipment = equipmentOf(item.exerciseId);
    const planned = progressionWeeks(plan, item, equipment);
    const plannedKg = planned[week - 1]?.kg ?? item.startKg;
    const tops = topSets(plan, records, item.exerciseId, today, bodyWeightKg);
    let status: LiftStatus | null = null;
    if (tops) {
      const sessionWeek = phaseWeek(plan, tops.nowDate)?.week ?? week;
      const target = planned[sessionWeek - 1]?.kg ?? plannedKg;
      status = liftStatus(
        signedLoad(tops.now),
        target,
        loadIncrement(equipment, target),
      );
    }
    return {
      exerciseId: item.exerciseId,
      name: item.name,
      reps: item.reps,
      start: tops?.start ?? null,
      startKg: item.startKg,
      now: tops?.now ?? null,
      plannedKg,
      status,
    };
  });
}

export type OtherLift = {
  exerciseId: string;
  name: string;
  sessions: number;
  start: WorkoutSet;
  now: WorkoutSet;
};

/**
 * The plan's most trained exercises without a progression: the ones with the
 * most sessions in finished workouts inside the plan's dates (the latest
 * session breaks a tie), up to `limit`. Cardio is left out.
 */
export function otherLifts(
  plan: Plan,
  records: Records,
  today: string,
  limit = 4,
  bodyWeightKg: number | null = null,
): OtherLift[] {
  const end = lastCounted(plan, today);
  const skip = new Set((plan.progression ?? []).map((p) => p.exerciseId));
  const seen = new Map<string, { name: string; count: number; last: string }>();
  for (const { payload } of completedWorkouts(records)) {
    if (payload.date < plan.startDate || payload.date > end) continue;
    const ids = new Set<string>();
    for (const ex of payload.exercises) {
      if (skip.has(ex.exerciseId) || ids.has(ex.exerciseId)) continue;
      if (!ex.sets.some((s) => s.done)) continue;
      ids.add(ex.exerciseId);
      const entry = seen.get(ex.exerciseId);
      if (!entry)
        seen.set(ex.exerciseId, {
          name: ex.name,
          count: 1,
          last: payload.date,
        });
      else {
        entry.count++;
        if (payload.date > entry.last) {
          entry.last = payload.date;
          entry.name = ex.name;
        }
      }
    }
  }
  const ranked = [...seen.entries()].sort(
    ([a, x], [b, y]) =>
      y.count - x.count || y.last.localeCompare(x.last) || a.localeCompare(b),
  );
  const result: OtherLift[] = [];
  for (const [exerciseId, entry] of ranked) {
    if (result.length >= limit) break;
    const tops = topSets(plan, records, exerciseId, today, bodyWeightKg);
    if (!tops) continue;
    result.push({
      exerciseId,
      name: entry.name,
      sessions: tops.sessions,
      start: tops.start,
      now: tops.now,
    });
  }
  return result;
}

// ---------------------------------------------------------------- volume

export type PlanMuscleRow = {
  group: MuscleGroup;
  /** Hard sets a week over the plan's finished weeks, to the half set; null before one has finished. */
  average: number | null;
  /** Hard sets so far in the plan week that holds today. */
  thisWeek: number;
  /** The average against the 10–20 guide; this week's sets before a week has finished. */
  status: MuscleSetRow["status"];
};

export type PlanMuscleSets = {
  /** Finished plan weeks the average is taken over; 0 in the first week. */
  weeks: number;
  /** The plan week that holds today (the last one after the end). */
  week: number;
  /** Whether the plan has ended, so there is no "this week" any more. */
  ended: boolean;
  /** Groups trained at all in the plan, in MUSCLE_GROUPS order. */
  rows: PlanMuscleRow[];
  scale: number;
  /** Groups whose average is under the guide's minimum. */
  under: MuscleGroup[];
  /** Groups still short of the guide's minimum this week, with the sets left. */
  short: { group: MuscleGroup; left: number }[];
};

export type PlanVolumeWeeks = {
  /** The plan week that holds today (the last one after the end). */
  week: number;
  /** Finished plan weeks an average is taken over; 0 in the first week. */
  weeks: number;
  ended: boolean;
  /** Finished workouts of the finished weeks. */
  finished: Workout[];
  /** Finished workouts so far in the week that holds today; none after the end. */
  current: Workout[];
};

/**
 * The plan's finished workouts split for its volume: the weeks that have
 * finished, which an average is taken over, and the week that holds today.
 * The sets per group and the muscle map share it, so they always agree on
 * the weeks. Null before the plan starts.
 */
export function planVolumeWeeks(
  plan: Plan,
  records: Records,
  today: string,
): PlanVolumeWeeks | null {
  if (today < plan.startDate) return null;
  const ended = today > plan.endDate;
  const end = lastCounted(plan, today);
  const week = phaseWeek(plan, end)!.week;
  // The plan week that holds today starts here; weeks before it are finished.
  const weekFrom = weekFirstDay(plan, week);
  const inPlan = completedWorkouts(records)
    .map((r) => r.payload)
    .filter((w) => w.date >= plan.startDate && w.date <= end);
  return {
    week,
    weeks: ended ? week : week - 1,
    ended,
    finished: ended ? inPlan : inPlan.filter((w) => w.date < weekFrom),
    current: ended ? [] : inPlan.filter((w) => w.date >= weekFrom),
  };
}

/** Sets to the half set, as the volume shows them. */
export const toHalfSet = (sets: number) => Math.round(sets * 2) / 2;

/**
 * Hard sets per muscle group a week over the plan. The average only counts
 * plan weeks that have finished, so a new week never pulls it down before it
 * is trained; the week that holds today is shown on its own, as it stands, so
 * the user can see what is left to do. Null before the plan starts or when
 * nothing has been trained in it.
 */
export function planMuscleSets(
  plan: Plan,
  records: Records,
  today: string,
  categoriesOf: CategoriesOf,
): PlanMuscleSets | null {
  const volume = planVolumeWeeks(plan, records, today);
  if (!volume) return null;
  const { week, weeks, ended } = volume;
  const finished = hardSetsByMuscle(volume.finished, categoriesOf);
  const current = hardSetsByMuscle(volume.current, categoriesOf);
  const rows = MUSCLE_GROUPS.filter(
    (g) => (finished.get(g) ?? 0) > 0 || (current.get(g) ?? 0) > 0,
  ).map((group): PlanMuscleRow => {
    const average =
      weeks > 0 ? toHalfSet((finished.get(group) ?? 0) / weeks) : null;
    const thisWeek = toHalfSet(current.get(group) ?? 0);
    return {
      group,
      average,
      thisWeek,
      status: guideStatus(average ?? thisWeek),
    };
  });
  if (!rows.length) return null;
  const most = Math.max(
    ...rows.map((r) => Math.max(r.average ?? 0, r.thisWeek)),
  );
  return {
    weeks,
    week,
    ended,
    rows,
    scale: Math.max(MUSCLE_SCALE_MIN, Math.ceil(most)),
    under: rows
      .filter((r) => r.average !== null && r.average < WEEKLY_SET_GUIDE.min)
      .map((r) => r.group),
    short: ended
      ? []
      : rows
          .filter((r) => r.thisWeek < WEEKLY_SET_GUIDE.min)
          .map((r) => ({
            group: r.group,
            left: toHalfSet(WEEKLY_SET_GUIDE.min - r.thisWeek),
          })),
  };
}

// ---------------------------------------------------------------- labels

/**
 * A lift's start and now as the row reads them: "80 → 85 kg × 5" when both
 * are weighted sets of the same reps, else both in full, "BW × 8 → BW + 10 kg
 * × 6". `start` may be text already (the progression's start weight before
 * the first session); `nowMissing` stands in for a missing latest set. Each
 * set keeps its spaces unbreakable, so the line wraps between them.
 */
export function startNowText(
  start: string | WorkoutSet,
  now: WorkoutSet | null,
  nowMissing: string,
) {
  const keep = (text: string) => text.replace(/ /g, "\u00a0");
  const nowText = now ? keep(labelSet(now, false)) : nowMissing;
  if (typeof start === "string") return `${start} → ${nowText}`;
  if (
    now &&
    start.load === "weight" &&
    now.load === "weight" &&
    start.measure !== "seconds" &&
    now.measure !== "seconds" &&
    start.reps === now.reps &&
    start.weight !== null
  )
    return `${formatWeightValue(start.weight)} → ${nowText}`;
  return `${keep(labelSet(start, false))} → ${nowText}`;
}
