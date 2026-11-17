// A routine's weights and reps (Library concept, step 13). A routine stores
// exercises and sets; its kg and reps fields start empty, with last time's
// result as a grey placeholder. A number typed there is a target ("Mål",
// the set's `target` flag) that a start fills in. Values a routine held
// before this rule (saved from a workout, for one) stay stored, but read as
// placeholders and fill a start only where there is no history, as they
// always did. Pure, so it is tested (tests/routine-targets.test.ts).
import type { WorkoutSet } from "../data/model";
import { isCardioSet } from "./cardio";
import { loadKeyOf } from "./load-keys";
import { getSetInputText } from "./set-input";
import { formatWeightValue, type WeightUnit } from "./units";

/** True when a routine's set has a weight or reps typed as a target. */
export const hasTarget = (set: WorkoutSet) =>
  !!set.target && (set.weight !== null || set.reps !== null);

/**
 * The set as the routine editor's fields show it: a target as it is; any
 * other set with its weight and reps empty. Cardio sets are left as they are.
 */
export function shownPlannedSet(set: WorkoutSet): WorkoutSet {
  if (set.target || isCardioSet(set)) return set;
  if (set.weight === null && set.reps === null) return set;
  return { ...set, weight: null, reps: null };
}

/**
 * A change from the routine editor to the set it shows (`shown`, see
 * shownPlannedSet). Typing a weight or reps makes the set a target, and the
 * older value of the other field is dropped, so what the fields show is what
 * is stored. Any other change (a hold, a load kind, the section) keeps the
 * stored weight and reps. A target cleared to empty is no target.
 */
export function plannedSetChange(
  stored: WorkoutSet,
  shown: WorkoutSet,
  next: WorkoutSet,
): WorkoutSet {
  if (isCardioSet(next)) return next;
  const text = (s: WorkoutSet, field: "weight" | "reps") =>
    getSetInputText(s, field) ?? null;
  const typed =
    next.weight !== shown.weight ||
    next.reps !== shown.reps ||
    text(next, "weight") !== text(shown, "weight") ||
    text(next, "reps") !== text(shown, "reps");
  if (!typed) {
    if (shown === stored) return next;
    return { ...next, weight: stored.weight, reps: stored.reps };
  }
  const result = { ...next };
  // Text still being typed ("8.") counts as a value.
  const typing = text(next, "weight") !== null || text(next, "reps") !== null;
  if (result.weight !== null || result.reps !== null || typing)
    result.target = true;
  else delete result.target;
  return result;
}

/**
 * The grey placeholders of a planned set's kg and reps fields: last time's
 * result for the set, else the set's own older values. Only a weight of the
 * same kind of load is offered; undefined leaves a field's own placeholder.
 */
export function plannedPlaceholders(
  set: WorkoutSet,
  previous: WorkoutSet | undefined,
  unit: WeightUnit,
): { weight?: string; reps?: string } {
  if (isCardioSet(set) || hasTarget(set)) return {};
  const source =
    previous && loadKeyOf(previous) === loadKeyOf(set)
      ? previous
      : set.weight !== null || set.reps !== null
        ? set
        : undefined;
  if (!source) return {};
  return {
    ...(source.weight !== null && source.load !== "none"
      ? { weight: formatWeightValue(source.weight, unit) }
      : {}),
    ...(source.reps !== null ? { reps: String(source.reps) } : {}),
  };
}

/**
 * A planned set as a start fills it: a target's typed values first, then
 * last time's result, then the routine's older values. `previous` is last
 * time's result for the set, if any.
 */
export function startValues(
  planned: WorkoutSet,
  previous: Pick<WorkoutSet, "weight" | "reps"> | undefined,
): Pick<WorkoutSet, "weight" | "reps"> {
  const base = previous
    ? { weight: previous.weight, reps: previous.reps }
    : { weight: planned.weight, reps: planned.reps };
  if (!planned.target) return base;
  return {
    weight: planned.weight ?? base.weight,
    reps: planned.reps ?? base.reps,
  };
}
