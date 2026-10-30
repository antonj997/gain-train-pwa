import { Check } from "lucide-react";
import ListRow from "@/components/ui/ListRow";
import { goalTitle, type activeGoals } from "@/data/goals";
import { localizedDate } from "@/lib/dates";
import { t } from "@/i18n";

/** The active goals, each toggled linked or not to the plan. */
export default function PlanGoalLinks({
  goals,
  linkedIds,
  onChange,
}: {
  goals: ReturnType<typeof activeGoals>;
  linkedIds: string[];
  onChange: (goalIds: string[]) => void;
}) {
  return (
    <section aria-labelledby="plan-goals-heading">
      <h3 className="group-title" id="plan-goals-heading">
        {t("plan.goalsHeading")}
      </h3>
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
      </div>
    </section>
  );
}
