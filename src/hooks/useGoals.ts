import { useEffect, useMemo, useRef } from "react";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import {
  type GoalInsight,
  type GoalItem,
  activeGoals,
  goalInsight,
} from "@/data/goals";
import { completedWorkouts } from "@/data/selectors";
import { weeklyGoalStats } from "@/lib/week-summary";

export type GoalCardData = { goal: GoalItem; insight: GoalInsight };

/**
 * The goals and the weekly goal as the Goals tab shows them: open goals by the
 * nearest date, reached goals most recent first, and the weekly figures (null
 * without a weekly goal). Saves the day a bodyweight goal is first seen reached.
 */
export function useGoals(weeklyGoal: number | null, today: string) {
  const { state, save } = useData();
  const { bodyWeightKg } = useProfile();
  const records = useMemo(() => Object.values(state.records), [state.records]);
  const completed = useMemo(() => completedWorkouts(records), [records]);
  const goals = useMemo(() => activeGoals(state.records), [state.records]);

  // Each goal reads the whole log; only redo it when the log or profile changes.
  const cards = useMemo<GoalCardData[]>(
    () =>
      goals.map((goal) => ({
        goal,
        insight: goalInsight(goal, completed, { bodyWeightKg }, today),
      })),
    [goals, completed, bodyWeightKg, today],
  );
  const open = useMemo(
    () => cards.filter((c) => !c.insight.progress.met),
    [cards],
  );
  const reached = useMemo(
    () =>
      cards
        .filter((c) => c.insight.progress.met)
        .sort((a, b) =>
          (b.insight.progress.reachedOn ?? "").localeCompare(
            a.insight.progress.reachedOn ?? "",
          ),
        ),
    [cards],
  );
  const weekly = useMemo(
    () =>
      weeklyGoal === null
        ? null
        : weeklyGoalStats(
            completed.map((r) => r.payload.date),
            weeklyGoal,
            today,
          ),
    [completed, weeklyGoal, today],
  );

  // A bodyweight goal has no history to read the day it was reached from, so
  // the day is saved on the goal the first time it shows as reached. Once per
  // goal: re-renders while that save is in flight must not send it again.
  const written = useRef(new Set<string>());
  useEffect(() => {
    for (const { goal, insight } of cards)
      if (
        goal.kind === "bodyweight" &&
        insight.progress.met &&
        !goal.reachedOn &&
        !written.current.has(goal.id)
      ) {
        written.current.add(goal.id);
        const { id, ...payload } = goal;
        void save(id, "goal", { ...payload, reachedOn: today }).catch(() =>
          written.current.delete(id),
        );
      }
  }, [cards, save, today]);

  return { open, reached, weekly };
}
