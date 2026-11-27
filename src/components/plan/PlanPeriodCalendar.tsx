import { type CSSProperties } from "react";
import { CompactMonths, CompactWeekdays } from "@/components/ActivityHeatmap";
import { dayCellClass, type DayCellState } from "@/components/items/day-cell";
import { heatmapMonthLabels, monthTone } from "@/lib/heatmap";
import { periodColumns, type PeriodLabel } from "@/lib/period-calendar";
import { t } from "@/i18n";
import "@/styles/history-calendar.css";

export type PeriodCell = DayCellState & {
  /** The day lies in a deload week: planned in the deload tone, else faint. */
  deload?: boolean;
};
export type PeriodLegend = "done" | "planned" | "today" | "deload";

/**
 * A plan's whole period in the compact calendar's squares (v6 §D12, F1, F2):
 * one Monday-first column per week, weekday letters on the left, month names
 * on top and labels such as "v. 1", "nu" and "deload" under it. Planned days
 * are neutral rings, done days filled, today a dot in the middle and the
 * deload week in the deload tone. Decorative squares with one spoken label.
 * `rowGap` 2 draws the tighter rows of the new plan (R8-14).
 */
export default function PlanPeriodCalendar({
  start,
  end,
  cell,
  labels = [],
  legend = [],
  rowGap = 3,
  label,
}: {
  start: string;
  end: string;
  cell: (date: string) => PeriodCell;
  labels?: readonly PeriodLabel[];
  legend?: readonly PeriodLegend[];
  rowGap?: 2 | 3;
  /** What the period shows, for screen readers. */
  label: string;
}) {
  const columns = periodColumns(start, end);
  const legendText: Record<PeriodLegend, string> = {
    done: t("plan.legendDone"),
    planned: t("plan.legendPlanned"),
    today: t("plan.legendToday"),
    deload: t("plan.legendDeload"),
  };
  return (
    <div className="period-calendar-wrap">
      <div
        className={
          "heatmap period-calendar" + (rowGap === 2 ? " is-tight" : "")
        }
      >
        <CompactWeekdays />
        <div className="heatmap-scroll">
          <div
            className="heatmap-inner"
            style={{ "--hm-cols": columns.length } as CSSProperties}
          >
            <CompactMonths labels={heatmapMonthLabels(columns)} />
            <div className="heatmap-grid" role="img" aria-label={label}>
              {columns.flatMap((column, c) =>
                column.days.map((date, r) => {
                  const { deload, ...state } = cell(date);
                  const outside = date < start || date > end;
                  const tone =
                    deload && (state.planned || state.missed)
                      ? " is-deload"
                      : deload && !state.trained
                        ? " is-deload-week"
                        : "";
                  return (
                    <span
                      key={date}
                      className={
                        "heatmap-day " +
                        dayCellClass({ ...state, todayDot: true }, "grid") +
                        ` tone-${monthTone(date)}` +
                        tone +
                        (outside ? " is-outside" : "")
                      }
                      data-date={date}
                      style={{ gridColumn: c + 1, gridRow: r + 1 }}
                      aria-hidden="true"
                    />
                  );
                }),
              )}
            </div>
            {labels.length > 0 && (
              <div className="heatmap-months period-labels" aria-hidden="true">
                {labels.map(({ column, text }) => (
                  <span key={column} style={{ gridColumn: column + 1 }}>
                    {text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {legend.length > 0 && (
        <ul className="calendar-legend period-legend" aria-hidden="true">
          {legend.map((key) => (
            <li key={key}>
              <span
                className={
                  "legend-mark " +
                  (key === "done"
                    ? "is-trained"
                    : key === "planned"
                      ? "is-planned"
                      : key === "today"
                        ? "is-today-dot"
                        : "is-deload")
                }
              />
              {legendText[key]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
