import { Copy } from "lucide-react";
import type { Plan } from "@/data/model";
import { REST, cellText } from "@/data/plans";
import { type WeekKind, weekKindsOf } from "@/data/phase";
import { weekdayNames } from "@/lib/dates";
import { t } from "@/i18n";

type Names = Parameters<typeof cellText>[1];

/**
 * The repeating week or weeks of a plan; tapping a day chooses what it holds.
 * Each week of a longer cycle is Normal or Deload, and week 1 can be copied
 * into the others.
 */
export default function PlanTemplateGrid({
  plan,
  names,
  onPick,
  onWeekKind,
  onCopyWeekOne,
}: {
  plan: Plan;
  names: Names;
  onPick: (week: number, day: number) => void;
  onWeekKind: (week: number, kind: WeekKind) => void;
  onCopyWeekOne: () => void;
}) {
  const kinds = weekKindsOf(plan);
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
          <div
            key={week}
            className={
              "plan-grid-week" + (kinds[week] === "deload" ? " is-deload" : "")
            }
          >
            {plan.cycleWeeks > 1 && (
              <div className="plan-week-head">
                <span className="row-sub">
                  {t("plan.weekN", { n: week + 1 })}
                </span>
                <button
                  type="button"
                  className="week-kind"
                  aria-pressed={kinds[week] === "deload"}
                  aria-label={t("plan.deloadWeekToggle", { n: week + 1 })}
                  onClick={() =>
                    onWeekKind(
                      week,
                      kinds[week] === "deload" ? "normal" : "deload",
                    )
                  }
                >
                  {kinds[week] === "deload"
                    ? t("plan.deload")
                    : t("plan.normal")}
                </button>
              </div>
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
      {plan.cycleWeeks > 1 && (
        <button
          type="button"
          className="btn-quiet btn-sm plan-copy-week"
          onClick={onCopyWeekOne}
        >
          <Copy size={16} aria-hidden="true" />
          {t("plan.copyWeekOne")}
        </button>
      )}
      <p className="row-sub group-note">{t("plan.templateNote")}</p>
    </section>
  );
}
