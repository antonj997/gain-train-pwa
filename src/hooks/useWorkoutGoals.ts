import { useMemo, useRef } from "react";
import {
  type GoalInsight,
  type GoalItem,
  activeGoals,
  goalInsight,
  goalLiftText,
  goalTitle,
} from "@/data/goals";
import {
  goalFillSource,
  goalSetTargets,
  goalTargetLabel,
  goalTargetText,
} from "@/data/goal-targets";
import type { RecordDoc, Workout } from "@/data/model";
import { activePlans } from "@/data/plans";
import { equipmentLookup } from "@/data/progression";
import { completedWorkouts } from "@/data/selectors";
import type { FillSource } from "@/lib/set-target";
import type { WeightUnit } from "@/lib/units";
import { t } from "@/i18n";

/** A set's target as the workout screen shows it; `label` is the Set sheet's words. */
export type ShownTarget = { text: string; source: FillSource; label?: string };

/** The goal mark by an exercise's name: "110 × 1", and its spoken name. */
export type GoalMark = { text: string; label: string };

const NO_MARKS = new Map<string, GoalMark>();
const NO_CARDS: { goal: GoalItem; insight: GoalInsight }[] = [];

/**
 * The live workout's lift goals: a small mark for each exercise with an open
 * lift goal, and the set targets a goal sets (a check-in this week, or the
 * goal's own lift once strength says it is within reach), merged over the
 * usual targets. Worked out again only when the finished workouts
 * (`historyKey`), the goals or plans, the workout's exercises, the date, the
 * unit or the bodyweight change: not on every typed value.
 */
export function useWorkoutGoals({
  records,
  workout,
  historyKey,
  shape,
  unit,
  bodyWeightKg,
  targets,
}: {
  records: Record<string, RecordDoc>;
  workout: Workout;
  historyKey: string;
  /** The workout's exercises and sets, as a key (ActiveWorkout's `shape`). */
  shape: string;
  unit: WeightUnit;
  bodyWeightKg: number | null;
  targets: ReadonlyMap<string, ShownTarget>;
}) {
  const latestRecords = useRef(records);
  latestRecords.current = records;
  const latestWorkout = useRef(workout);
  latestWorkout.current = workout;
  // The goals and the plans' deload weeks, as a key: these records are few.
  const goalsKey = useMemo(
    () =>
      JSON.stringify([
        activeGoals(records).filter((g) => g.kind === "lift"),
        activePlans(records).map((p) => [
          p.startDate,
          p.endDate,
          p.cycleWeeks,
          p.weekKinds,
          p.paused,
        ]),
      ]),
    [records],
  );
  const date = workout.date;

  const { cards, marks } = useMemo(
    () => {
      const all = Object.values(latestRecords.current);
      const ids = new Set(
        latestWorkout.current.exercises.map((ex) => ex.exerciseId),
      );
      const goals = activeGoals(all).filter(
        (g) => g.kind === "lift" && g.exerciseId && ids.has(g.exerciseId),
      );
      if (!goals.length) return { cards: NO_CARDS, marks: NO_MARKS };
      const completed = completedWorkouts(all);
      const plans = activePlans(all);
      const equipmentOf = equipmentLookup(all);
      const cards = goals
        .map((goal) => ({
          goal,
          insight: goalInsight(goal, completed, { bodyWeightKg }, date, {
            plans,
            equipmentOf,
            unit,
          }),
        }))
        .filter((c) => !c.insight.progress.met);
      const marks = new Map<string, GoalMark>();
      for (const { goal, insight } of cards)
        if (goal.exerciseId && !marks.has(goal.exerciseId))
          marks.set(goal.exerciseId, {
            text: goalLiftText(goal, !!insight.strength?.body),
            label: t("workout.goalMark", { title: goalTitle(goal) }),
          });
      return { cards, marks };
    },
    // goalsKey, historyKey and shape stand in for the records they summarise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goalsKey, historyKey, shape, date, unit, bodyWeightKg],
  );

  const shown = useMemo(() => {
    if (!cards.length) return targets;
    const current = latestWorkout.current;
    const found = goalSetTargets(
      current,
      cards,
      (set) => targets.get(set.id)?.source.weight ?? set.weight,
    );
    if (!found.size) return targets;
    const sets = new Map(
      current.exercises.flatMap((ex) => ex.sets.map((s) => [s.id, s])),
    );
    const merged = new Map(targets);
    for (const [setId, target] of found) {
      const set = sets.get(setId);
      if (!set) continue;
      merged.set(setId, {
        text: goalTargetText(target),
        source: goalFillSource(target, set),
        label: goalTargetLabel(target),
      });
    }
    return merged;
  }, [cards, targets]);

  return { marks, targets: shown };
}
