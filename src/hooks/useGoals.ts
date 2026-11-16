import { useCallback, useEffect, useMemo, useRef } from "react";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import {
  type GoalInsight,
  type GoalItem,
  activeGoals,
  goalInsight,
} from "@/data/goals";
import { activePlans } from "@/data/plans";
import { equipmentLookup } from "@/data/progression";
import { completedWorkouts } from "@/data/selectors";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import { notify } from "@/lib/message-store";
import { errorMessage } from "@/lib/errors";
import { weeklyGoalStats } from "@/lib/week-summary";
import { t } from "@/i18n";

export type GoalCardData = { goal: GoalItem; insight: GoalInsight };

/**
 * The goals and the weekly goal as the Goals tab shows them: open goals by the
 * nearest date, reached goals most recent first, and the weekly figures (null
 * without a weekly goal). Saves the day a bodyweight goal is first seen reached.
 * `skipCheckin` skips a lift goal's check-in week (stored on the goal).
 */
export function useGoals(weeklyGoal: number | null, today: string) {
  const { state, save } = useData();
  const { bodyWeightKg } = useProfile();
  const records = useMemo(() => Object.values(state.records), [state.records]);
  const completed = useMemo(() => completedWorkouts(records), [records]);
  const goals = useMemo(() => activeGoals(state.records), [state.records]);
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const [{ weightUnit }] = useTrainingPreferences();

  // Each goal reads the whole log; only redo it when the log or profile changes.
  const cards = useMemo<GoalCardData[]>(() => {
    const equipmentOf = equipmentLookup(records);
    return goals.map((goal) => ({
      goal,
      insight: goalInsight(goal, completed, { bodyWeightKg }, today, {
        plans,
        equipmentOf,
        unit: weightUnit,
      }),
    }));
  }, [goals, completed, records, plans, bodyWeightKg, today, weightUnit]);
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

  // A skipped week is kept on the goal, so other devices skip it too.
  const skipCheckin = useCallback(
    async (goal: GoalItem, week: string) => {
      const { id, ...payload } = goal;
      const skips = [...(payload.checkinSkips ?? []), week];
      try {
        await save(id, "goal", {
          ...payload,
          checkinSkips: [...new Set(skips)].sort().slice(-100),
        });
        notify.success(t("goals.checkinSkipped"));
      } catch (cause) {
        notify.error(errorMessage(cause, t("goals.checkinSkipFailed")));
      }
    },
    [save],
  );

  return { open, reached, weekly, skipCheckin };
}
