import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarCells, moveCalendarMonth } from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import "@/styles/history-calendar.css";

export type PlanDay = {
  kind: "routine" | "rest" | null;
  /** What the day's label reads aloud, such as the routine name. */
  label: string;
  /** A dated choice replaces the weekly plan on this day. */
  override: boolean;
};

/**
 * A month grid for the plan's Upcoming view, from today to `last`. It borrows
 * the History calendar's day cells; days before today are read-only.
 */
export default function PlanCalendar({
  today,
  last,
  describe,
  onPick,
}: {
  today: string;
  last: string;
  describe: (date: string) => PlanDay;
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const title = localizedDate(month + "-01", {
    month: "long",
    year: "numeric",
  });
  return (
    <section className="card plan-calendar" aria-label="Upcoming plan">
      <div className="calendar-header">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          disabled={month <= today.slice(0, 7)}
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
          disabled={month >= last.slice(0, 7)}
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
      <div className="calendar-days">
        {calendarCells(month).map((cell) => {
          const day = describe(cell.date);
          return (
            <button
              type="button"
              key={cell.date}
              className={
                "calendar-day plan-day" +
                (cell.date === today ? " is-today" : "") +
                (day.override ? " is-override" : "") +
                (!cell.inMonth ? " outside-month" : "")
              }
              disabled={!cell.inMonth || cell.date < today || cell.date > last}
              aria-current={cell.date === today ? "date" : undefined}
              aria-label={`${localizedDate(cell.date, { weekday: "long", day: "numeric", month: "long" })}, ${day.label}${day.override ? ", changed for this date" : ""}`}
              onClick={() => onPick(cell.date)}
            >
              <span>{cell.day}</span>
              <span
                className={"plan-mark" + (day.kind ? " " + day.kind : "")}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <div className="calendar-footer plan-legend">
        <span>
          <span className="plan-mark routine" aria-hidden="true" /> Routine
        </span>
        <span>
          <span className="plan-mark rest" aria-hidden="true" /> Rest
        </span>
        <span>
          <span className="plan-swatch" aria-hidden="true" /> Changed
        </span>
      </div>
    </section>
  );
}
