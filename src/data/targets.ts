// A target for the next time a set is done ("Target 87.5 × 5"), by double
// progression. Pure, so it is tested (tests/targets.test.ts).
//
// The rule: when last time's set reached the top of the exercise's rep range
// (or, without a range, did at least last time's target), the next target adds
// the smallest load step: 2.5 kg, or 5 lb when the app shows pounds. Otherwise
// it asks for one more rep at the same weight. A hold counts seconds instead
// of reps and asks for five more. Plain bodyweight can only add reps; an
// assisted set steps the assistance down; a set with no load gets no target.
// A plan's deload week lightens the weight and adds nothing.
import {
  labelSet,
  validSet,
  type RecordDoc,
  type Workout,
  type WorkoutRecord,
  type WorkoutSet,
} from "./model";
import { isDrop } from "./drops";
import { DEFAULT_DELOAD, deloadOf } from "./phase";
import { previousResult, priorWorkouts } from "./workouts";
import { isCardioSet } from "../lib/cardio";
import { hasExtraWeight } from "../lib/set-load";
import { fromUnit, toUnit, type WeightUnit } from "../lib/units";
import { t } from "../i18n";

/**
 * What to aim for: the weight in kg (the added weight for bodyweight plus
 * weight, the assistance for an assisted set, null for plain bodyweight) and
 * the reps, or seconds for a hold.
 */
export type SetTarget = { weight: number | null; reps: number };

/** An exercise's rep range for double progression, such as 6–8. */
export type RepRange = { min: number; max: number };

export type TargetSettings = {
  /** The exercise's rep range, when it has one. */
  repRange?: RepRange | null;
  /**
   * The target this set had last time, when the caller kept it. Without it,
   * the target is worked out again from the sessions before last time.
   */
  lastTarget?: SetTarget | null;
  /** Set when this workout falls in a plan's deload week: the load cut, in percent. */
  deload?: { loadPct: number } | null;
};

/** The smallest load step in each unit: 2.5 kg, or 5 lb. */
export const LOAD_STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };
/** A hold's "one more rep": five more seconds. */
export const HOLD_STEP_SEC = 5;
/** How many earlier sessions a target looks back through, at most. */
export const TARGET_LOOKBACK = 12;

const EPSILON = 1e-6;
const round3 = (kg: number) => Math.round(kg * 1000) / 1000;

/** A set the target can build on: a checked, valid working set with a load. */
const usable = (set: WorkoutSet | undefined): set is WorkoutSet =>
  !!set &&
  set.done &&
  set.section === "working" &&
  !isDrop(set) &&
  !isCardioSet(set) &&
  set.load !== "none" &&
  validSet(set) &&
  (set.reps ?? 0) > 0;

/** True when the set's weight is something to step: a weight, added weight or assistance. */
const carriesLoad = (set: WorkoutSet) =>
  set.load === "weight" || set.load === "assisted" || hasExtraWeight(set);

/** `kg` moved by `steps` load steps in the unit, kept on that unit's grid. */
function stepWeight(kg: number, steps: number, unit: WeightUnit) {
  const step = LOAD_STEP[unit];
  return round3(fromUnit(Math.max(0, toUnit(kg, unit) + steps * step), unit));
}

/** `kg` rounded to the nearest load step in the unit. */
function roundWeight(kg: number, unit: WeightUnit) {
  const step = LOAD_STEP[unit];
  return round3(fromUnit(Math.round(toUnit(kg, unit) / step) * step, unit));
}

const validRange = (range: RepRange | null | undefined) =>
  range &&
  Number.isInteger(range.min) &&
  Number.isInteger(range.max) &&
  range.min >= 1 &&
  range.max >= range.min
    ? range
    : null;

/** True when `set` did at least the target: its reps, at its load or harder. */
function reached(set: WorkoutSet, target: SetTarget) {
  if ((set.reps ?? 0) < target.reps) return false;
  if (!carriesLoad(set) || target.weight === null) return true;
  return set.load === "assisted"
    ? (set.weight ?? 0) <= target.weight + EPSILON
    : (set.weight ?? 0) >= target.weight - EPSILON;
}

/**
 * The target for a set, from the same set in earlier sessions, newest first:
 * `previous[0]` is last time's (see targetHistory). Weights are in kg; `unit`
 * picks the step (2.5 kg or 5 lb) and keeps the weight on that unit's grid.
 * Null when there is nothing to build on: no checked working set last time,
 * a warm-up, cool-down, drop or cardio set, or a set with no load.
 */
export function suggestTarget(
  previous: readonly WorkoutSet[],
  settings: TargetSettings,
  unit: WeightUnit,
): SetTarget | null {
  const last = previous[0];
  if (!usable(last)) return null;
  const reps = last.reps!;
  const more = last.measure === "seconds" ? HOLD_STEP_SEC : 1;
  const loaded = carriesLoad(last);
  const weight = loaded ? (last.weight ?? 0) : null;

  const pct = settings.deload?.loadPct;
  if (pct !== undefined && pct !== null && Number.isFinite(pct)) {
    // A deload week: lighter (more assistance), the same reps, no progression.
    if (weight === null) return { weight: null, reps };
    const share = Math.min(Math.max(pct, 0), 100) / 100;
    let lighter =
      last.load === "assisted"
        ? roundWeight(weight * (1 + share), unit)
        : roundWeight(weight * (1 - share), unit);
    // Added weight on bodyweight must stay above zero.
    if (hasExtraWeight(last) && lighter <= 0) lighter = stepWeight(0, 1, unit);
    return { weight: lighter, reps };
  }

  const range = validRange(settings.repRange);
  let hit: boolean;
  if (range) hit = reps >= range.max;
  else {
    const lastTarget =
      settings.lastTarget !== undefined
        ? settings.lastTarget
        : suggestTarget(
            previous.slice(1, TARGET_LOOKBACK),
            { repRange: null },
            unit,
          );
    hit = !!lastTarget && reached(last, lastTarget);
  }

  // An assisted set with no assistance left can only add reps.
  const canStep =
    weight !== null && (last.load !== "assisted" || weight > EPSILON);
  if (hit && canStep) {
    const next = stepWeight(weight, last.load === "assisted" ? -1 : 1, unit);
    return { weight: next, reps: range ? range.min : reps };
  }
  const nextReps = reps + more;
  return {
    weight,
    reps:
      // Only a load that can still step stops at the top of the range.
      range && canStep ? Math.min(nextReps, range.max) : nextReps,
  };
}

/**
 * The same set in earlier finished workouts, newest first, as suggestTarget
 * takes it: for the set at `setIndex` of the exercise at `exerciseIndex`, the
 * set each earlier session of that exercise matched (the Previous column's
 * rule, previousResult). Workouts done in a plan's deload week are skipped:
 * their lighter sets say nothing about progress.
 */
export function targetHistory(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  current: { id: string; payload: Workout },
  exerciseIndex: number,
  setIndex: number,
  limit = TARGET_LOOKBACK,
): WorkoutSet[] {
  const exercise = current.payload.exercises[exerciseIndex];
  if (!exercise?.sets[setIndex]) return [];
  const list = Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);
  const self: WorkoutRecord = {
    id: current.id,
    kind: "workout",
    revision: 0,
    deleted: false,
    localVersion: 0,
    dirty: false,
    payload: current.payload,
  };
  const found: WorkoutSet[] = [];
  for (const record of priorWorkouts([...list], self, current.payload.date)) {
    if (found.length >= limit) break;
    if (record.payload.plan?.deload) continue;
    const prior = record.payload.exercises
      .filter((ex) => ex.exerciseId === exercise.exerciseId)
      .flatMap((ex) => ex.sets);
    if (!prior.length) continue;
    const match = previousResult(prior, exercise.sets, setIndex);
    if (match) found.push(match);
  }
  return found;
}

/**
 * The deload a workout started in a plan's deload week gets: the plan's load
 * cut (or the default 10 %). Null outside a deload week.
 */
export function deloadFor(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  workout: Pick<Workout, "plan">,
): { loadPct: number } | null {
  if (!workout.plan?.deload) return null;
  const list = Array.isArray(records)
    ? (records as readonly RecordDoc[])
    : Object.values(records as Record<string, RecordDoc>);
  const plan = list.find(
    (record) =>
      record.id === workout.plan!.planId &&
      record.kind === "plan" &&
      !record.deleted,
  );
  return {
    loadPct:
      plan?.kind === "plan"
        ? deloadOf(plan.payload).loadPct
        : DEFAULT_DELOAD.loadPct,
  };
}

/**
 * "Target 87.5 kg × 5" ("Mål 87,5 kg × 5"): the target in the words of the
 * set it is for, which gives the load kind and measure.
 */
export function targetLabel(target: SetTarget, set: WorkoutSet) {
  const shown: WorkoutSet = {
    ...set,
    weight: target.weight,
    reps: target.reps,
  };
  return t("target.label", { value: labelSet(shown, false) });
}

/** A set's target in a running workout, with the set it builds on. */
export type WorkoutSetTarget = {
  target: SetTarget;
  /** Last time's set the target steps from: its load kind and measure. */
  last: WorkoutSet;
};

/**
 * Every set's target in a workout, by set id (sets without one are left
 * out): each set against the same set in earlier sessions (targetHistory),
 * in the plan's deload week lightened (deloadFor). For the workout screen,
 * which shows it under Previous and fills it in with one tap.
 */
export function workoutTargets(
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  current: { id: string; payload: Workout },
  unit: WeightUnit,
): Map<string, WorkoutSetTarget> {
  const deload = deloadFor(records, current.payload);
  const targets = new Map<string, WorkoutSetTarget>();
  current.payload.exercises.forEach((exercise, exerciseIndex) =>
    exercise.sets.forEach((set, setIndex) => {
      if (isDrop(set) || set.section !== "working" || isCardioSet(set)) return;
      const history = targetHistory(records, current, exerciseIndex, setIndex);
      const target = suggestTarget(history, { deload }, unit);
      if (target) targets.set(set.id, { target, last: history[0] });
    }),
  );
  return targets;
}
