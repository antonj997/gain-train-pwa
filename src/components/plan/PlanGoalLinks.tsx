import { Check, Plus } from "lucide-react";
import ListRow from "@/components/ui/ListRow";
import { goalTitle, type activeGoals } from "@/data/goals";
import { localizedDate } from "@/lib/dates";
import { t } from "@/i18n";

/**
 * The active goals, each toggled linked or not to the plan, and "+ New goal"
 * in the heading and last in the list: it opens the goal editor and the new
 * goal comes back linked.
 */
export default function PlanGoalLinks({
  goals,
  linkedIds,
  onChange,
  onNew,
}: {
  goals: ReturnType<typeof activeGoals>;
  linkedIds: string[];
  onChange: (goalIds: string[]) => void;
  onNew: () => void;
}) {
  return (
    <section aria-labelledby="plan-goals-heading">
      <div className="plan-goals-head">
        <h3 className="group-title" id="plan-goals-heading">
          {t("plan.goalsHeading")}
        </h3>
        <button
          type="button"
          className="text-link plan-new-goal"
          aria-label={t("plan.newGoalLabel")}
          onClick={onNew}
        >
          <Plus size={16} aria-hidden="true" />
          {t("plan.newGoal")}
        </button>
      </div>
      <div className="list">
        {goals.map((g) => {
          const linked = linkedIds.includes(g.id);
          return (
            <ListRow
              key={g.id}
              title={goalTitle(g)}
              sub={t("plan.by", {
                date: localizedDate(g.byDate, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              })}
              onClick={() =>
                onChange(
                  linked
                    ? linkedIds.filter((id) => id !== g.id)
                    : [...linkedIds, g.id],
                )
              }
              trailing={
                linked ? (
                  <Check
                    size={20}
                    className="plan-check"
                    aria-label={t("plan.linked")}
                  />
                ) : undefined
              }
            />
          );
        })}
        <ListRow
          title={t("plan.newGoal")}
          leading={<Plus size={20} aria-hidden="true" />}
          className="plan-new-goal-row"
          onClick={onNew}
        />
      </div>
    </section>
  );
}
