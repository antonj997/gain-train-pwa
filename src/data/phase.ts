import type {
  Exercise,
  Plan,
  ProgressionItem,
  RoutineGroup,
  WorkoutPlanMark,
  WorkoutSet,
} from "./model";
import { isDrop } from "./drops";
import { isCardioSet } from "../lib/cardio";
import { daysBetween, shiftDate, weekStart } from "../lib/dates";
import { hasExtraWeight } from "../lib/set-load";
import { loadIncrement, plannedWeeks, roundToStep } from "../lib/progression";

/**
 * A plan is a training phase: its weeks count from the Monday of its first
 * day, like the template, so "week 3" and the template's row always agree.
 */

/** The longest phase the editor offers: 26 weeks, about six months. */
export const MAX_PHASE_WEEKS = 26;
export const PHASE_LENGTHS = Array.from({ length: 23 }, (_, i) => i + 4);

/** Weeks the plan's period touches, counted Monday to Sunday. */
export function phaseWeeks(plan: Pick<Plan, "startDate" | "endDate">) {
  return (
    Math.floor(
      daysBetween(weekStart(plan.startDate), weekStart(plan.endDate)) / 7,
    ) + 1
  );
}

/** The last day of a phase `weeks` long from `startDate`: the Sunday of its last week. */
export const phaseEnd = (startDate: string, weeks: number) =>
  shiftDate(weekStart(startDate), weeks * 7 - 1);

/** True when the period ends on the Sunday of a whole week, so a length names it. */
export const endsOnWeek = (plan: Pick<Plan, "startDate" | "endDate">) =>
  plan.endDate === phaseEnd(plan.startDate, phaseWeeks(plan));

export type WeekKind = "normal" | "deload";

/** One kind per cycle week. Unknown values and missing weeks are normal. */
export function weekKindsOf(plan: Pick<Plan, "cycleWeeks" | "weekKinds">) {
  return Array.from({ length: plan.cycleWeeks }, (_, i): WeekKind =>
    plan.weekKinds?.[i] === "deload" ? "deload" : "normal",
  );
}

/** The plan's deload rule, or the default: 10 % lighter, half the working sets. */
export const DEFAULT_DELOAD = { loadPct: 10, setsPct: 50 } as const;
export const deloadOf = (plan: Pick<Plan, "deload">) =>
  plan.deload ?? DEFAULT_DELOAD;

/** True when the phase's week `week` (1-based) falls on a deload cycle week. */
export function isDeloadWeek(
  plan: Pick<Plan, "cycleWeeks" | "weekKinds">,
  week: number,
) {
  const kinds = weekKindsOf(plan);
  return (
    kinds[(((week - 1) % kinds.length) + kinds.length) % kinds.length] ===
    "deload"
  );
}

/** The phase's deload week numbers, 1-based. */
export function deloadWeeks(
  plan: Pick<Plan, "cycleWeeks" | "weekKinds" | "startDate" | "endDate">,
) {
  return Array.from({ length: phaseWeeks(plan) }, (_, i) => i + 1).filter((w) =>
    isDeloadWeek(plan, w),
  );
}

/** Where a date sits in the phase: week n of N, and a deload week or not. Null outside it. */
export function phaseWeek(plan: Plan, date: string) {
  if (date < plan.startDate || date > plan.endDate) return null;
  const week =
    Math.floor(daysBetween(weekStart(plan.startDate), weekStart(date)) / 7) + 1;
  return { week, weeks: phaseWeeks(plan), deload: isDeloadWeek(plan, week) };
}

const emptyWeek = (): (string | null)[] => Array(7).fill(null);

/** The cycle presets: "3 + 1 deload", "5 + 1 deload", or every week normal. */
export type CyclePreset = "3+1" | "5+1" | "none";

/**
 * The plan with a preset cycle. New weeks copy week 1, since a deload week
 * trains the same routines lighter. "none" keeps the cycle's length.
 */
export function withCyclePreset(plan: Plan, preset: CyclePreset): Plan {
  if (preset === "none") {
    const next = { ...plan };
    delete next.weekKinds;
    return next;
  }
  const normal = preset === "3+1" ? 3 : 5;
  const weeks = normal + 1;
  const first = plan.template[0] ?? emptyWeek();
  return {
    ...plan,
    cycleWeeks: weeks,
    template: Array.from({ length: weeks }, (_, i) => [
      ...(plan.template[i] ?? first),
    ]),
    weekKinds: Array.from({ length: weeks }, (_, i) =>
      i === weeks - 1 ? "deload" : "normal",
    ),
  };
}

/** Which preset the cycle matches, if any. */
export function cyclePreset(
  plan: Pick<Plan, "cycleWeeks" | "weekKinds">,
): CyclePreset | null {
  const kinds = weekKindsOf(plan);
  const deloads = kinds.filter((k) => k === "deload").length;
  if (!deloads) return "none";
  if (deloads === 1 && kinds[kinds.length - 1] === "deload")
    return plan.cycleWeeks === 4 ? "3+1" : plan.cycleWeeks === 6 ? "5+1" : null;
  return null;
}

/** The plan with one cycle week marked normal or deload; all normal drops the field. */
export function withWeekKind(plan: Plan, week: number, kind: WeekKind): Plan {
  const kinds = weekKindsOf(plan).map((k, i) => (i === week ? kind : k));
  const next = { ...plan, weekKinds: kinds };
  if (!kinds.includes("deload")) delete (next as Partial<Plan>).weekKinds;
  return next;
}

/** The plan with week 1's days copied into the other cycle weeks. */
export const withWeekOneCopied = (plan: Plan): Plan => ({
  ...plan,
  template: plan.template.map((row, i) =>
    i === 0 ? row : [...plan.template[0]],
  ),
});

/** Cycle kinds kept in step with a new cycle length: new weeks are normal. */
export function kindsForCycle(plan: Plan, weeks: number): Plan {
  if (!plan.weekKinds) return plan;
  const kinds = Array.from({ length: weeks }, (_, i): WeekKind =>
    plan.weekKinds?.[i] === "deload" ? "deload" : "normal",
  );
  const next = { ...plan, weekKinds: kinds };
  if (!kinds.includes("deload")) delete (next as Partial<Plan>).weekKinds;
  return next;
}

/** The planned week-by-week weights of one progression row in this plan. */
export function progressionWeeks(
  plan: Pick<
    Plan,
    "startDate" | "endDate" | "cycleWeeks" | "weekKinds" | "deload"
  >,
  item: Pick<ProgressionItem, "startKg" | "targetKg" | "overrides">,
  equipment?: string | null,
) {
  return plannedWeeks({
    startKg: item.startKg,
    targetKg: item.targetKg,
    weeks: phaseWeeks(plan),
    deloadWeeks: deloadWeeks(plan),
    increment: loadIncrement(equipment, item.startKg),
    deloadLoadPct: deloadOf(plan).loadPct,
    overrides: item.overrides,
  });
}

/** Overrides kept only for weeks the phase still has. */
export function trimProgression(plan: Plan): Plan["progression"] {
  if (!plan.progression) return undefined;
  const weeks = phaseWeeks(plan);
  return plan.progression.map((item) => {
    if (!item.overrides) return item;
    const overrides = Object.fromEntries(
      Object.entries(item.overrides).filter(([w]) => Number(w) <= weeks),
    );
    const next: ProgressionItem = { ...item, overrides };
    if (!Object.keys(overrides).length) delete next.overrides;
    return next;
  });
}

/** True when the plan holds the routine on some day, itself or through a group. */
export function planHoldsRoutine(
  plan: Pick<Plan, "template" | "overrides">,
  routineId: string,
  groups: readonly RoutineGroup[],
) {
  const cells = [
    ...plan.template.flat(),
    ...Object.values(plan.overrides),
  ].filter((c): c is string => !!c);
  return cells.some(
    (cell) =>
      cell === routineId ||
      (cell.startsWith("group:") &&
        !!groups
          .find((g) => g.id === cell.slice(6))
          ?.routineIds.includes(routineId)),
  );
}

/** What a workout started on `date` takes from a plan: its week and its planned loads. */
export type PlanStart = {
  mark: WorkoutPlanMark;
  deload: { loadPct: number; setsPct: number } | null;
  /** Planned working weight and reps by exercise id. */
  loads: Map<string, { kg: number; reps: number }>;
};

/**
 * The plan's say for a workout started on `date`: null outside the phase or
 * when paused. `equipmentOf` gives an exercise's equipment, for its increment.
 */
export function planStartFor(
  plan: Plan & { id: string },
  date: string,
  equipmentOf: (exerciseId: string) => string | undefined,
): PlanStart | null {
  if (plan.paused) return null;
  const at = phaseWeek(plan, date);
  if (!at) return null;
  const loads = new Map<string, { kg: number; reps: number }>();
  for (const item of plan.progression ?? []) {
    const week = progressionWeeks(plan, item, equipmentOf(item.exerciseId))[
      at.week - 1
    ];
    if (week) loads.set(item.exerciseId, { kg: week.kg, reps: item.reps });
  }
  return {
    mark: {
      planId: plan.id,
      week: at.week,
      weeks: at.weeks,
      ...(at.deload ? { deload: true } : {}),
    },
    deload: at.deload ? deloadOf(plan) : null,
    loads,
  };
}

/** A set that carries a working weight the plan can set: a weighted or weighted-bodyweight working set. */
const loadable = (set: WorkoutSet) =>
  set.section === "working" &&
  !isCardioSet(set) &&
  set.measure !== "seconds" &&
  (set.load === "weight" || hasExtraWeight(set));

/**
 * A deload week keeps this share of the working sets (rounded, at least one),
 * dropping the last ones with their drops. Warm-ups and cool-downs stay.
 */
export function keepWorkingSets(sets: WorkoutSet[], setsPct: number) {
  const working = sets.filter((s) => s.section === "working" && !isDrop(s));
  const keep = Math.max(1, Math.round((working.length * setsPct) / 100));
  if (keep >= working.length) return sets;
  let seen = 0;
  let dropping = false;
  return sets.filter((s) => {
    if (s.section === "working" && !isDrop(s)) {
      seen++;
      dropping = seen > keep;
      return !dropping;
    }
    if (isDrop(s)) return !dropping;
    dropping = false;
    return true;
  });
}

/**
 * A routine's prefilled exercises with the plan applied: a progressed lift's
 * working sets take the week's planned weight and reps; in a deload week every
 * other weighted working set (and drop) is `loadPct` lighter, on the
 * exercise's increment, and only `setsPct` of the working sets are kept.
 * Returns the exercises and the mark to save on the workout.
 */
export function applyPlanStart(
  exercises: Exercise[],
  start: PlanStart,
  equipmentOf: (exerciseId: string) => string | undefined,
): { exercises: Exercise[]; mark: WorkoutPlanMark } {
  const loads: Record<string, number> = {};
  const next = exercises.map((ex) => {
    if (ex.sets.some(isCardioSet)) return ex;
    const planned = start.loads.get(ex.exerciseId);
    let sets = ex.sets;
    if (start.deload) sets = keepWorkingSets(sets, start.deload.setsPct);
    if (planned && sets.some((s) => loadable(s) && !isDrop(s))) {
      loads[ex.exerciseId] = planned.kg;
      sets = sets.map((s) =>
        loadable(s) && !isDrop(s)
          ? { ...s, weight: planned.kg, reps: planned.reps }
          : s,
      );
      // Drops follow the working weight down as before, lighter in a deload.
      if (start.deload) sets = lighterDrops(sets, ex, start, equipmentOf);
    } else if (start.deload) {
      const pct = start.deload.loadPct;
      sets = sets.map((s) =>
        loadable(s) && s.weight
          ? {
              ...s,
              weight: roundToStep(
                s.weight * (1 - pct / 100),
                loadIncrement(equipmentOf(ex.exerciseId), s.weight),
              ),
            }
          : s,
      );
    }
    return sets === ex.sets ? ex : { ...ex, sets };
  });
  return {
    exercises: next,
    mark: {
      ...start.mark,
      ...(Object.keys(loads).length ? { loads } : {}),
    },
  };
}

function lighterDrops(
  sets: WorkoutSet[],
  ex: Exercise,
  start: PlanStart,
  equipmentOf: (exerciseId: string) => string | undefined,
) {
  const pct = start.deload?.loadPct ?? 0;
  return sets.map((s) =>
    isDrop(s) && loadable(s) && s.weight
      ? {
          ...s,
          weight: roundToStep(
            s.weight * (1 - pct / 100),
            loadIncrement(equipmentOf(ex.exerciseId), s.weight),
          ),
        }
      : s,
  );
}
