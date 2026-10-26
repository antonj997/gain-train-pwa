import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Calendar,
  CalendarDays,
  Grid3X3,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { type RecordDoc } from "@/data/model";
import { shiftDate } from "@/data/summary";
import {
  calendarCells,
  calendarRangeEdges,
  changeHistoryCalendar,
  historyCalendarBounds,
  moveCalendarMonth,
  workoutDates,
  type HistoryCalendarAction,
  type HistoryCalendarState,
} from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import "@/styles/history-calendar.css";

function DateRangeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4m8-4v4M3 10h18" />
      <circle cx="7" cy="16" r="1.5" />
      <circle cx="17" cy="16" r="1.5" />
      <path d="M9 16h6m-2-2 2 2-2 2" />
    </svg>
  );
}

export default function HistoryCalendar({
  value,
  now,
  records,
  onChange,
}: {
  value: HistoryCalendarState;
  now: string;
  records: readonly RecordDoc[];
  onChange: (value: HistoryCalendarState) => void;
}) {
  const { month, mode, display, selectedDate, from, to, activeBound } = value;
  const cells = calendarCells(month, display);
  const counts = workoutDates(records);
  const bounds = historyCalendarBounds(value, now);
  const currentMonth = now.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const currentYear = Number(now.slice(0, 4));
  const canReset = mode === "range" || month !== currentMonth || !!selectedDate;
  const instructionsId = useId();
  const headingId = useId();
  const [focused, setFocused] = useState(selectedDate ?? now);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const focusable =
    focused.startsWith(month) && focused <= now
      ? focused
      : month === currentMonth
        ? now
        : month + "-01";
  const change = (action: HistoryCalendarAction) =>
    onChange(changeHistoryCalendar(value, action, now));
  const browse = (month: string) => change({ type: "browse", month });

  useEffect(() => {
    if (pendingFocus.current && buttons.current.has(pendingFocus.current)) {
      buttons.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  const onDateKey = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const weekday = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const target = shiftDate(date, offsets[event.key]);
    if (target > now || target < "1900-01-01") return;
    pendingFocus.current = target;
    setFocused(target);
    if (!target.startsWith(month)) browse(target.slice(0, 7));
  };

  return (
    <section
      className={`history-calendar calendar-${display}`}
      aria-label="Workout calendar"
    >
      <div
        className="calendar-toolbar"
        role="group"
        aria-label="Calendar controls"
      >
        <button
          type="button"
          className="calendar-icon-toggle"
          aria-label="Date range"
          aria-pressed={mode === "range"}
          title={
            mode === "month"
              ? "Choose a From and To date"
              : "Date range selected · show one month"
          }
          onClick={() =>
            change({ type: "mode", mode: mode === "month" ? "range" : "month" })
          }
        >
          {mode === "month" ? (
            <DateRangeIcon />
          ) : (
            <Calendar size={20} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="calendar-icon-toggle"
          aria-label="Simple view"
          aria-pressed={display === "simple"}
          title={
            display === "detailed"
              ? "Detailed calendar · switch to simple"
              : "Simple calendar · switch to detailed"
          }
          onClick={() =>
            change({
              type: "display",
              display: display === "detailed" ? "simple" : "detailed",
            })
          }
        >
          {display === "detailed" ? (
            <CalendarDays size={18} aria-hidden="true" />
          ) : (
            <Grid3X3 size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      {mode === "range" && (
        <div className="calendar-range-fields">
          {(["from", "to"] as const).map((bound) => (
            <button
              type="button"
              className="calendar-bound"
              key={bound}
              aria-label={`Choose ${bound === "from" ? "From" : "To"} date${value[bound] ? `, ${localizedDate(value[bound])}` : ""}`}
              aria-pressed={activeBound === bound}
              onClick={() => change({ type: "bound", bound })}
            >
              <span>{bound === "from" ? "From" : "To"}</span>
              {value[bound] ? (
                <time dateTime={value[bound]}>
                  {localizedDate(value[bound], {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })}
                </time>
              ) : (
                <strong>Choose date</strong>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="calendar-heading">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous month"
          disabled={month <= "1900-01"}
          onClick={() => browse(moveCalendarMonth(month, -1))}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="sr-only" id={headingId} aria-live="polite">
          {localizedDate(month + "-01", { month: "long", year: "numeric" })}
        </h2>
        <div className="calendar-month-selects">
          <select
            aria-label="Calendar month"
            value={month.slice(5)}
            onChange={(event) => browse(`${year}-${event.target.value}`)}
          >
            {Array.from({ length: 12 }, (_, index) => {
              const number = String(index + 1).padStart(2, "0");
              return (
                <option
                  key={number}
                  value={number}
                  disabled={`${year}-${number}` > currentMonth}
                >
                  {localizedDate(`2024-${number}-01`, { month: "short" })}
                </option>
              );
            })}
          </select>
          <select
            aria-label="Calendar year"
            value={year}
            onChange={(event) =>
              browse(`${event.target.value}-${month.slice(5)}`)
            }
          >
            {Array.from(
              { length: currentYear - 1899 },
              (_, index) => currentYear - index,
            ).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Next month"
          disabled={month >= currentMonth}
          onClick={() => browse(moveCalendarMonth(month, 1))}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <p
        className={`calendar-instructions${mode === "month" && !selectedDate ? " sr-only" : ""}`}
        id={instructionsId}
        aria-live="polite"
      >
        {mode === "range"
          ? `Choose ${activeBound === "from" ? "start" : "end"} date`
          : selectedDate
            ? localizedDate(selectedDate, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Select a day to filter workouts."}
        <span className="sr-only">
          {" "}
          Use arrow keys to move between days, Home and End to move within a
          week. Date ranges include both dates.
        </span>
      </p>
      {display === "detailed" && (
        <div className="calendar-weekdays" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>
              {new Date(Date.UTC(2024, 0, i + 1)).toLocaleDateString(
                undefined,
                { weekday: "short", timeZone: "UTC" },
              )}
            </span>
          ))}
        </div>
      )}
      <div
        className={`calendar-days${mode === "range" ? " calendar-range" : ""}`}
        aria-labelledby={headingId}
      >
        {cells.map((cell, index) => {
          const count = counts.get(cell.date) ?? 0;
          const selected =
            mode === "range"
              ? !!bounds && cell.date >= bounds.start && cell.date <= bounds.end
              : selectedDate === cell.date;
          const edges =
            mode === "range" ? calendarRangeEdges(cells, index, bounds) : null;
          return (
            <button
              type="button"
              key={cell.date}
              ref={(node) => {
                if (node) buttons.current.set(cell.date, node);
                else buttons.current.delete(cell.date);
              }}
              className={`calendar-day${cell.date === now ? " is-today" : ""}${selected ? " is-selected" : ""}${mode === "range" && from === cell.date ? " is-range-start" : ""}${mode === "range" && to === cell.date ? " is-range-end" : ""}${edges?.start ? " range-row-start" : ""}${edges?.end ? " range-row-end" : ""}${!cell.inMonth ? " outside-month" : ""}`}
              disabled={!cell.inMonth || cell.date > now}
              tabIndex={cell.date === focusable ? 0 : -1}
              aria-current={cell.date === now ? "date" : undefined}
              aria-pressed={selected}
              aria-describedby={instructionsId}
              aria-label={`${localizedDate(cell.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${countLabel(count, "workout")}`}
              onFocus={() => setFocused(cell.date)}
              onKeyDown={(event) => onDateKey(event, cell.date)}
              onClick={() => change({ type: "date", date: cell.date })}
            >
              {display === "simple" ? (
                <span
                  className={`calendar-square${count > 0 ? " is-filled" : ""}`}
                  aria-hidden="true"
                />
              ) : (
                <>
                  <span>{cell.day}</span>
                  {cell.inMonth && count > 0 && (
                    <span className="calendar-workout-dot" aria-hidden="true" />
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="calendar-footer">
        <span>
          <span
            className={
              display === "simple"
                ? "calendar-square is-filled"
                : "calendar-workout-dot"
            }
            aria-hidden="true"
          />{" "}
          Workout day
        </span>
        {canReset && (
          <button
            type="button"
            className="text-button calendar-reset"
            title={`Show all workouts in ${localizedDate(now, { month: "long", year: "numeric" })}`}
            onClick={() => change({ type: "reset" })}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Show current month
          </button>
        )}
      </div>
    </section>
  );
}
