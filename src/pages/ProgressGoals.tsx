import { Plus } from "lucide-react";
import GoalsPanel from "@/components/goals/GoalsPanel";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/ui/BackButton";
import { today } from "@/data/model";
import { useGoalEditor } from "@/hooks/useGoalEditor";
import { useGoals } from "@/hooks/useGoals";
import { usePageBack } from "@/hooks/usePageTransitions";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import { useT } from "@/i18n/useT";

/**
 * Progress → Goals, a subscreen: the weekly goal card, active goals with
 * their pace, reached goals folded away, and Add goal.
 */
export default function ProgressGoals() {
  const { t } = useT();
  const [preferences, updatePreferences] = useTrainingPreferences();
  const goals = useGoals(preferences.weeklyGoal, today());
  const goalEditor = useGoalEditor();
  const back = usePageBack("/progress");
  return (
    <div className="page progress-page goals-page">
      <PageHeader
        eyebrow={
          goals.open.length
            ? t("goals.eyebrow", { count: goals.open.length })
            : t("progress.title")
        }
        title={t("goals.title")}
        leading={<BackButton onClick={back} />}
        action={
          <button
            type="button"
            className="text-link"
            onClick={() => goalEditor.edit("new")}
          >
            <Plus size={18} aria-hidden="true" />
            {t("goals.add")}
          </button>
        }
      />
      <GoalsPanel
        {...goals}
        preferences={preferences}
        onPreferences={updatePreferences}
        onEdit={goalEditor.edit}
      />
      {goalEditor.editor}
    </div>
  );
}
