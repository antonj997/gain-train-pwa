import type {
  Exercise,
  Plan,
  ProgressionItem,
  WorkoutPlanMark,
  WorkoutSet,
} from "./model";
import { isDrop } from "./drops";
import { isCardioSet } from "../lib/cardio";
import { daysBetween, localizedDate, shiftDate, weekStart } from "../lib/dates";
import { t } from "../i18n";
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

/**
 * True when the phase's week `week` (1-based) is a deload week: one of the
 * plan's `deloadWeeks` when it has them (a length-based preset, v6 F1), else
 * a deload cycle week.
 */
export function isDeloadWeek(
  plan: Pick<Plan, "cycleWeeks" | "weekKinds" | "deloadWeeks">,
  week: number,
) {
  if (plan.deloadWeeks) return plan.deloadWeeks.includes(week);
  const kinds = weekKindsOf(plan);
  return (
    kinds[(((week - 1) % kinds.length) + kinds.length) % kinds.length] ===
    "deload"
  );
}

/** The phase's deload week numbers, 1-based. */
export function deloadWeeks(
  plan: Pick<
    Plan,
    "cycleWeeks" | "weekKinds" | "deloadWeeks" | "startDate" | "endDate"
  >,
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

export type PhaseSegment = {
  week: number;
  /** Past, this week or still to come, seen from `date`. */
  state: "done" | "now" | "next";
  deload: boolean;
};

/** One segment per week of the phase, for the phase bar. */
export function phaseSegments(plan: Plan, date: string): PhaseSegment[] {
  const current =
    phaseWeek(plan, date)?.week ?? (date < plan.startDate ? 0 : Infinity);
  return Array.from({ length: phaseWeeks(plan) }, (_, i): PhaseSegment => {
    const week = i + 1;
    return {
      week,
      state: week < current ? "done" : week === current ? "now" : "next",
      deload: isDeloadWeek(plan, week),
    };
  });
}

const emptyWeek = (): (string | null)[] => Array(7).fill(null);

/**
 * The deload presets (v6 F1): "none", or a deload after every k normal weeks,
 * "7+1" or "3+1x2" ("3 + 1 två gånger"). They mark the phase's weeks, not the
 * cycle's, so "7 + 1" fits an 8-week phase that repeats every week.
 */
export type CyclePreset = "none" | `${number}+1` | `${number}+1x2`;

/** The normal weeks before each deload in a preset, or null for "none". */
const presetStep = (preset: CyclePreset) => {
  const match = /^(\d+)\+1(x2)?$/.exec(preset);
  return match ? Number(match[1]) : null;
};

/** The phase weeks (1-based) a preset makes deload in a phase `weeks` long. */
export function presetDeloadWeeks(preset: CyclePreset, weeks: number) {
  const step = presetStep(preset);
  if (!step) return [];
  const out: number[] = [];
  for (let week = step + 1; week <= weeks; week += step + 1) out.push(week);
  return out;
}

/** The deload presets a phase of `weeks` offers: Ingen, "{n-1} + 1" and, for an even length, "{n/2-1} + 1 två gånger". */
export function deloadPresets(
  weeks: number,
): { id: CyclePreset; label: string }[] {
  const out: { id: CyclePreset; label: string }[] = [
    { id: "none", label: t("plan.deloadNone") },
  ];
  if (weeks >= 2)
    out.push({
      id: `${weeks - 1}+1`,
      label: t("plan.deloadOnce", { normal: weeks - 1 }),
    });
  if (weeks >= 4 && weeks % 2 === 0)
    out.push({
      id: `${weeks / 2 - 1}+1x2`,
      label: t("plan.deloadTwice", { normal: weeks / 2 - 1 }),
    });
  return out;
}

/**
 * The preset a new phase gets from its length (R-Coach 3, E-C6): none under
 * 6 weeks, one deload in the last week up to 9 (6 → 5 + 1, 8 → 7 + 1), and
 * two from 10 when the length splits in half (12 → 5 + 1 twice).
 */
export function defaultDeload(weeks: number): CyclePreset {
  if (weeks < 6) return "none";
  if (weeks >= 10 && weeks % 2 === 0) return `${weeks / 2 - 1}+1x2`;
  return `${weeks - 1}+1`;
}

/**
 * The plan with a deload preset: its phase weeks are marked (`deloadWeeks`)
 * and the cycle's own kinds are dropped; "none" drops both. The cycle and
 * the template stay as they are.
 */
export function withCyclePreset(plan: Plan, preset: CyclePreset): Plan {
  const next = { ...plan };
  delete next.weekKinds;
  delete next.deloadWeeks;
  if (preset === "none") return next;
  return { ...next, deloadWeeks: presetDeloadWeeks(preset, phaseWeeks(plan)) };
}

/** Which of its length's presets the plan's deload weeks match, if any. */
export function cyclePreset(
  plan: Pick<
    Plan,
    "cycleWeeks" | "weekKinds" | "deloadWeeks" | "startDate" | "endDate"
  >,
): CyclePreset | null {
  const weeks = phaseWeeks(plan);
  const marked = deloadWeeks(plan).join(",");
  if (!marked) return "none";
  return (
    deloadPresets(weeks).find(
      (p) => presetDeloadWeeks(p.id, weeks).join(",") === marked,
    )?.id ?? null
  );
}

/**
 * The plan with one cycle week marked normal or deload; all normal drops the
 * field. Marking by hand goes back to the cycle's kinds, so a preset's
 * phase weeks are dropped.
 */
export function withWeekKind(plan: Plan, week: number, kind: WeekKind): Plan {
  const kinds = weekKindsOf(plan).map((k, i) => (i === week ? kind : k));
  const next = { ...plan, weekKinds: kinds };
  delete (next as Partial<Plan>).deloadWeeks;
  if (!kinds.includes("deload")) delete (next as Partial<Plan>).weekKinds;
  return next;
}

/** "21 dec", without the full stop of a Swedish month abbreviation. */
const shortDay = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" }).replace(/\./g, "");

/** The new plan's period row (F1): "8 veckor · 21 dec – 14 feb". */
export function periodText(startDate: string, endDate: string) {
  return t("plan.periodRow", {
    weeks: t("count.week", {
      count: phaseWeeks({ startDate, endDate }),
    }),
    from: shortDay(startDate),
    to: shortDay(endDate),
  });
}

/**
 * The line under the whole period (F1): "21 dec – 14 feb · 21 pass och 3
 * lättare i deloadveckan", counting the planned workout days in normal
 * weeks and in deload weeks.
 */
export function periodSummary(
  plan: Plan,
  isWorkout: (cell: string | null | undefined) => boolean = (cell) =>
    !!cell && cell !== "rest",
) {
  let normal = 0;
  let light = 0;
  const deloads = new Set<number>();
  for (
    let date = plan.startDate;
    date <= plan.endDate;
    date = shiftDate(date, 1)
  ) {
    const weeks = Math.floor(
      daysBetween(weekStart(plan.startDate), weekStart(date)) / 7,
    );
    const row = plan.template[weeks % plan.cycleWeeks];
    const index = daysBetween(weekStart(date), date);
    const cell =
      date in plan.overrides ? plan.overrides[date] : (row?.[index] ?? null);
    if (!isWorkout(cell)) continue;
    if (isDeloadWeek(plan, weeks + 1)) {
      light++;
      deloads.add(weeks + 1);
    } else normal++;
  }
  const range = `${shortDay(plan.startDate)} – ${shortDay(plan.endDate)}`;
  const workouts = t("count.workout", { count: normal });
  if (!light) return t("plan.periodLine", { range, workouts });
  return t(
    deloads.size > 1 ? "plan.periodLineDeloads" : "plan.periodLineDeload",
    { range, workouts, light },
  );
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
