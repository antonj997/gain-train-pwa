import type { Plan } from "@/data/model";
import { REST, cellText } from "@/data/plans";
import { weekdayNames } from "@/lib/dates";
import { t } from "@/i18n";

type Names = Parameters<typeof cellText>[1];

/** The repeating week or weeks of a plan; tapping a day chooses what it holds. */
export default function PlanTemplateGrid({
  plan,
  names,
  onPick,
}: {
  plan: Plan;
  names: Names;
  onPick: (week: number, day: number) => void;
}) {
  const weekdayLetters = weekdayNames("narrow");
  const dayNames = weekdayNames();
  return (
    <section aria-labelledby="template-heading">
      <h3 className="group-title" id="template-heading">
        {plan.cycleWeeks > 1 ? t("plan.yourWeeks") : t("plan.yourWeek")}
      </h3>
      <div className="plan-grid">
        <div className="plan-grid-days" aria-hidden="true">
          {weekdayLetters.map((letter, i) => (
            <span key={i}>{letter}</span>
          ))}
        </div>
        {plan.template.map((row, week) => (
          <div key={week} className="plan-grid-week">
            {plan.cycleWeeks > 1 && (
              <span className="row-sub">
                {t("plan.weekN", { n: week + 1 })}
              </span>
            )}
            <div className="plan-grid-row">
              {row.map((cell, day) => {
                const text = cellText(cell, names);
                return (
                  <button
                    key={day}
                    type="button"
                    className={
                      "plan-cell" +
                      (cell === REST ? " is-rest" : cell ? " is-set" : "")
                    }
                    aria-label={t(
                      plan.cycleWeeks > 1
                        ? "plan.cellLabelWeek"
                        : "plan.cellLabel",
                      {
                        day: dayNames[day],
                        week: week + 1,
                        text: text || t("plan.empty"),
                      },
                    )}
                    onClick={() => onPick(week, day)}
                  >
                    <span>{text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="row-sub group-note">{t("plan.templateNote")}</p>
    </section>
  );
}
