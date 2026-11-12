import { useContext } from "react";
import { Copy, Layers, Moon, Plus, Sparkles } from "lucide-react";
import { DataContext } from "@/contexts/useData";
import MovementIcon from "@/components/icons/exercise/MovementIcon";
import type { Plan } from "@/data/model";
import { REST, cellText } from "@/data/plans";
import { exerciseCategory } from "@/data/selectors";
import { categoryTone, movementIcon } from "@/lib/movement-icon";
import { type WeekKind, weekKindsOf } from "@/data/phase";
import { weekdayNames } from "@/lib/dates";
import { t } from "@/i18n";
import DayCell from "@/components/items/DayCell";

type Names = Parameters<typeof cellText>[1];

/**
 * A template day's 26px icon: the routine's leading exercise in its category's
 * colour, the layers for a group, sparkles for a day type, a moon for rest and
 * a plus for an empty day.
 */
function CellIcon({ cell }: { cell: string | null }) {
  const data = useContext(DataContext);
  if (!cell) return <Plus size={24} aria-hidden="true" />;
  if (cell === REST) return <Moon size={26} aria-hidden="true" />;
  if (cell.startsWith("group:")) return <Layers size={26} aria-hidden="true" />;
  if (cell.startsWith("type:"))
    return <Sparkles size={26} aria-hidden="true" />;
  const record = data?.state.records[cell];
  const lead =
    record?.kind === "routine" && !record.deleted
      ? record.payload.exercises[0]
      : undefined;
  if (!lead) return <Layers size={26} aria-hidden="true" />;
  const category = exerciseCategory(data!.state.records, lead.exerciseId);
  return (
    <span className="plan-cell-icon" data-tone={categoryTone(category)}>
      <MovementIcon
        movement={movementIcon({ id: lead.exerciseId, category })}
        size={28}
      />
    </span>
  );
}

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
                  <DayCell
                    key={day}
                    as="button"
                    size="week"
                    planned={!!cell && cell !== REST}
                    className={
                      "plan-cell" +
                      (cell === REST
                        ? " is-rest"
                        : cell
                          ? " is-set"
                          : " is-empty")
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
                    <CellIcon cell={cell} />
                    {text && <span className="plan-cell-text">{text}</span>}
                  </DayCell>
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
