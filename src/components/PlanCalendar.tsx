import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  calendarCells,
  calendarRangeEdges,
  moveCalendarMonth,
} from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import "@/styles/history-calendar.css";

export type PlanDay = {
  kind: "planned" | "rest" | null;
  /** What the day's label reads aloud, such as the routine name. */
  label: string;
  /** A dated choice replaces the template on this day. */
  override: boolean;
};

/**
 * A month grid from `first` to `last` that borrows the History calendar's day
 * cells; days outside that span are read-only. With `describe` it is a plan's
 * Upcoming view (a marker under each date). With `range` it picks a period: the
 * chosen days get the History calendar's range band.
 */
export default function PlanCalendar({
  today,
  first,
  last,
  describe,
  range,
  label = "Upcoming plan",
  initialMonth = first.slice(0, 7),
  onPick,
}: {
  today: string;
  first: string;
  last: string;
  describe?: (date: string) => PlanDay;
  /** The period being picked; null when nothing is chosen yet. */
  range?: { start: string; end: string } | null;
  label?: string;
  initialMonth?: string;
  onPick: (date: string) => void;
}) {
  const firstMonth = first.slice(0, 7),
    lastMonth = last.slice(0, 7);
  const [chosen, setMonth] = useState(initialMonth);
  // The span can move under the calendar (a new start or end date); keep the
  // shown month inside it so the chevrons always lead somewhere.
  const month =
    chosen < firstMonth ? firstMonth : chosen > lastMonth ? lastMonth : chosen;
  const title = localizedDate(month + "-01", {
    month: "long",
    year: "numeric",
  });
  const picking = range !== undefined;
  const cells = calendarCells(month);
  return (
    <section className="card plan-calendar" aria-label={label}>
      <div className="calendar-header">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          disabled={month <= firstMonth}
          onClick={() => setMonth(moveCalendarMonth(month, -1))}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h3 className="plan-month" aria-live="polite">
          {title}
        </h3>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          disabled={month >= lastMonth}
          onClick={() => setMonth(moveCalendarMonth(month, 1))}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>
            {new Date(Date.UTC(2024, 0, i + 1)).toLocaleDateString(undefined, {
              weekday: "short",
              timeZone: "UTC",
            })}
          </span>
        ))}
      </div>
      <div className={"calendar-days" + (picking ? " calendar-range" : "")}>
        {cells.map((cell, index) => {
          const day = describe?.(cell.date);
          const edges = picking
            ? calendarRangeEdges(cells, index, range)
            : null;
          const isStart = !!edges && cell.date === range?.start;
          const isEnd = !!edges && cell.date === range?.end;
          const spoken = localizedDate(cell.date, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: picking ? "numeric" : undefined,
          });
          return (
            <button
              type="button"
              key={cell.date}
              className={
                "calendar-day" +
                (day ? " plan-day" : "") +
                (cell.date === today ? " is-today" : "") +
                (day?.override ? " is-override" : "") +
                (edges ? " is-selected" : "") +
                (isStart ? " is-range-start" : "") +
                (isEnd ? " is-range-end" : "") +
                (edges?.start ? " range-row-start" : "") +
                (edges?.end ? " range-row-end" : "") +
                (!cell.inMonth ? " outside-month" : "")
              }
              disabled={!cell.inMonth || cell.date < first || cell.date > last}
              aria-current={cell.date === today ? "date" : undefined}
              aria-pressed={picking ? !!edges : undefined}
              aria-label={
                day
                  ? `${spoken}, ${day.label}${day.override ? ", changed for this date" : ""}`
                  : spoken + (isStart ? ", start" : "") + (isEnd ? ", end" : "")
              }
              onClick={() => onPick(cell.date)}
            >
              <span>{cell.day}</span>
              {day && (
                <span
                  className={"plan-mark" + (day.kind ? " " + day.kind : "")}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      {describe && (
        <div className="calendar-footer plan-legend">
          <span>
            <span className="plan-mark planned" aria-hidden="true" /> Planned
          </span>
          <span>
            <span className="plan-mark rest" aria-hidden="true" /> Rest
          </span>
          <span>
            <span className="plan-swatch" aria-hidden="true" /> Changed
          </span>
        </div>
      )}
    </section>
  );
}
