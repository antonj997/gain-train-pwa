// A lift goal's say in a running workout (approved plan, 16 November 2026):
// in a check-in week the first working set's target becomes the check-in
// ("Check-in 92.5 × max"), and once strength says the goal is within reach
// the top set's target is the goal's own lift ("Test 110 × 1"). Pure, so it
// is tested (tests/lift-goal.test.ts).
import type { Workout, WorkoutSet } from "./model";
import type { GoalInsight, GoalItem } from "./goals";
import { isDrop } from "./drops";
import { isCardioSet } from "../lib/cardio";
import { formatWeightValue, getWeightUnit } from "../lib/units";
import { t } from "../i18n";

export type GoalSetTarget = {
  kind: "checkin" | "test";
  goalId: string;
  /** In kg: the weight, or a bodyweight lift's added weight (0 for plain bodyweight). */
  weight: number;
  /** The reps to do; null for as many as possible. */
  reps: number | null;
  /** True for a bodyweight lift. */
  body: boolean;
};

/** A set a goal target can sit on: a working set with a load, counted in reps. */
const takesGoal = (set: WorkoutSet) =>
  set.section === "working" &&
  !isDrop(set) &&
  !isCardioSet(set) &&
  set.measure !== "seconds" &&
  set.load !== "none";

/**
 * The goal targets of a workout, by set id. `goals` are the open lift goals
 * with their insight on the workout's date; `plannedWeight` gives a set's
 * usual target weight, to find the top set (the heaviest; the first of
 * equals, or the first working set without any). One target per exercise:
 * the first goal with something to say wins.
 */
export function goalSetTargets(
  workout: Pick<Workout, "date" | "exercises">,
  goals: readonly { goal: GoalItem; insight: GoalInsight }[],
  plannedWeight: (set: WorkoutSet) => number | null | undefined = (set) =>
    set.weight,
): Map<string, GoalSetTarget> {
  const found = new Map<string, GoalSetTarget>();
  const taken = new Set<string>();
  for (const { goal, insight } of goals) {
    const strength = insight.strength;
    if (goal.kind !== "lift" || insight.progress.met || !strength) continue;
    if (taken.has(goal.exerciseId ?? "")) continue;
    const due = strength.checkin?.due;
    const checkin =
      due && workout.date >= due.week && workout.date <= due.end
        ? strength.checkin
        : null;
    if (!strength.ready && !checkin) continue;
    const exercise = workout.exercises.find(
      (ex) => ex.exerciseId === goal.exerciseId,
    );
    const sets = exercise?.sets.filter(takesGoal) ?? [];
    if (!sets.length) continue;
    taken.add(goal.exerciseId ?? "");
    if (strength.ready) {
      let top = sets[0];
      for (const set of sets)
        if (
          (plannedWeight(set) ?? -Infinity) > (plannedWeight(top) ?? -Infinity)
        )
          top = set;
      found.set(top.id, {
        kind: "test",
        goalId: goal.id,
        weight: strength.ready.weight,
        reps: strength.ready.reps,
        body: strength.body,
      });
    } else if (checkin)
      found.set(sets[0].id, {
        kind: "checkin",
        goalId: goal.id,
        weight: checkin.load,
        reps: null,
        body: strength.body,
      });
  }
  return found;
}

/** "92.5 × max", "+5 × max", "BW × max", "110 × 1": short, for the Previous column. */
export function goalTargetValue(
  target: Pick<GoalSetTarget, "weight" | "reps" | "body">,
) {
  const kg = formatWeightValue(target.weight);
  const load = !target.body ? kg : target.weight > 0 ? `+${kg}` : t("label.bw");
  const reps = target.reps === null ? t("goalTarget.max") : target.reps;
  return `${load} × ${reps}`;
}

/** "Check-in 92.5 × max" or "Test 110 × 1" ("Kontroll …", "Testa …"). */
export const goalTargetText = (target: GoalSetTarget) =>
  t(target.kind === "checkin" ? "goalTarget.checkin" : "goalTarget.test", {
    value: goalTargetValue(target),
  });

/** The target in the Set sheet's words: "92.5 kg × max", "BW + 5 kg × max". */
export function goalTargetLabel(target: GoalSetTarget) {
  const kg = formatWeightValue(target.weight);
  const unit = getWeightUnit();
  const n = target.reps === null ? t("goalTarget.max") : target.reps;
  if (!target.body) return t("label.weight", { kg, unit, n });
  return target.weight > 0
    ? `${t("label.bwPlus", { kg, unit })} × ${n}`
    : t("label.bwReps", { n });
}
