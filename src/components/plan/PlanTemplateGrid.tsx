import type { Plan } from "@/data/model";
import { REST, cellText } from "@/data/plans";
import { weekdayNames } from "@/lib/dates";

type Names = Parameters<typeof cellText>[1];

const weekdayLetters = ["M", "T", "W", "T", "F", "S", "S"];
const dayNames = weekdayNames();

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
  return (
    <section aria-labelledby="template-heading">
      <h3 className="group-title" id="template-heading">
        {plan.cycleWeeks > 1 ? "Your weeks" : "Your week"}
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
              <span className="row-sub">Week {week + 1}</span>
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
                    aria-label={`${dayNames[day]}${plan.cycleWeeks > 1 ? `, week ${week + 1}` : ""}: ${text || "empty"}`}
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
      <p className="row-sub group-note">
        Tap a day to choose a routine, a group, a day type or rest. The weeks
        repeat from the first week of the period.
      </p>
    </section>
  );
}
