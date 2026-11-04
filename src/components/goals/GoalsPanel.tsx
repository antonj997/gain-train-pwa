import { useState } from "react";
import { ChevronDown, Plus, Target } from "lucide-react";
import GoalCard from "@/components/goals/GoalCard";
import WeeklyGoalCard from "@/components/goals/WeeklyGoalCard";
import { GoalSheet } from "@/components/settings/PreferenceSheets";
import ListRow from "@/components/ui/ListRow";
import { type GoalItem, goalTitle } from "@/data/goals";
import type { GoalCardData } from "@/hooks/useGoals";
import { localizedDate } from "@/lib/dates";
import type { TrainingPreferences } from "@/lib/preferences";
import type { WeeklyGoalStats } from "@/lib/week-summary";
import { useT } from "@/i18n/useT";

type Props = {
  open: GoalCardData[];
  reached: GoalCardData[];
  weekly: WeeklyGoalStats | null;
  preferences: TrainingPreferences;
  onPreferences: (patch: Partial<TrainingPreferences>) => void;
  onEdit: (goal: GoalItem | "new") => void;
};

/** Progress → Goals: the weekly goal, open goals by the nearest date, and reached goals folded away. */
export default function GoalsPanel({
  open,
  reached,
  weekly,
  preferences,
  onPreferences,
  onEdit,
}: Props) {
  const { t } = useT();
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  return (
    <div className="goals-panel">
      <WeeklyGoalCard stats={weekly} onEdit={() => setWeeklyOpen(true)} />
      {open.length > 0 && (
        <section aria-labelledby="active-goals-heading">
          <div className="section-head">
            <h2 id="active-goals-heading">{t("goals.active")}</h2>
          </div>
          <div className="goal-list">
            {open.map((card) => (
              <GoalCard
                key={card.goal.id}
                card={card}
                onOpen={() => onEdit(card.goal)}
              />
            ))}
          </div>
        </section>
      )}
      {open.length === 0 && reached.length === 0 && (
        <div className="empty-card goals-empty">
          <Target size={30} aria-hidden="true" />
          <h2>{t("goals.emptyTitle")}</h2>
          <p>{t("goals.empty")}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onEdit("new")}
          >
            <Plus size={18} aria-hidden="true" />
            {t("goals.add")}
          </button>
        </div>
      )}
      {reached.length > 0 && (
        <details className="goals-reached">
          <summary className="session-summary">
            <h2>{t("goals.reachedSection", { count: reached.length })}</h2>
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <div className="list">
            {reached.map(({ goal, insight }) => (
              <ListRow
                key={goal.id}
                title={goalTitle(goal)}
                sub={
                  insight.progress.reachedOn
                    ? t("goals.reachedOn", {
                        date: localizedDate(insight.progress.reachedOn),
                      })
                    : t("goals.reached")
                }
                chevron
                onClick={() => onEdit(goal)}
              />
            ))}
          </div>
        </details>
      )}
      <GoalSheet
        open={weeklyOpen}
        onClose={() => setWeeklyOpen(false)}
        preferences={preferences}
        onChange={onPreferences}
      />
    </div>
  );
}
