import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  X,
} from "lucide-react";
import { type RecordDoc } from "@/data/model";
import { shiftDate } from "@/data/summary";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import { heatmapWindow, spanInfo } from "@/lib/heatmap";
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
  const cells = calendarCells(month);
  const counts = workoutDates(records);
  const bounds = historyCalendarBounds(value, now);
  const currentMonth = now.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const currentYear = Number(now.slice(0, 4));
  const heat = display === "simple";
  const canReset = heat
    ? value.heatEnd !== now || !!selectedDate
    : mode === "range" || month !== currentMonth || !!selectedDate;
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

  const viewToggle = (
    <button
      type="button"
      className="icon-btn calendar-view-toggle"
      aria-label="Detailed calendar"
      aria-pressed={display === "detailed"}
      title={
        display === "detailed"
          ? "Detailed calendar · switch to simple"
          : "Activity heatmap · switch to detailed"
      }
      onClick={() =>
        change({
          type: "display",
          display: display === "detailed" ? "simple" : "detailed",
        })
      }
    >
      {display === "detailed" ? (
        <CalendarDays size={22} aria-hidden="true" />
      ) : (
        <LayoutGrid size={22} aria-hidden="true" />
      )}
    </button>
  );

  if (heat) {
    const window = heatmapWindow(value.heatEnd, value.span);
    const spanName = spanInfo(value.span).phrase;
    return (
      <section
        className="history-calendar calendar-heatmap"
        aria-label="Workout calendar"
      >
        <div className="calendar-header">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Previous ${spanName}`}
            disabled={window.start <= "1901-01-01"}
            onClick={() => change({ type: "shift", direction: -1 })}
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h2 className="heatmap-title" id={headingId} aria-live="polite">
            {localizedDate(window.start, { month: "short", year: "numeric" })} –{" "}
            {localizedDate(window.end, { month: "short", year: "numeric" })}
          </h2>
          {viewToggle}
          <button
            type="button"
            className="icon-btn"
            aria-label={`Next ${spanName}`}
            disabled={value.heatEnd >= now}
            onClick={() => change({ type: "shift", direction: 1 })}
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
        <ActivityHeatmap
          value={value}
          now={now}
          counts={counts}
          canReset={canReset}
          instructionsId={instructionsId}
          headingId={headingId}
          change={change}
        />
      </section>
    );
  }

  return (
    <section
      className={`history-calendar calendar-${display}`}
      aria-label="Workout calendar"
    >
      <div className="calendar-header">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          disabled={month <= "1900-01"}
          onClick={() => browse(moveCalendarMonth(month, -1))}
        >
          <ChevronLeft size={22} aria-hidden="true" />
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
                  {localizedDate(`2024-${number}-01`, { month: "long" })}
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
        {viewToggle}
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          disabled={month >= currentMonth}
          onClick={() => browse(moveCalendarMonth(month, 1))}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
      {display === "detailed" && (
        <button
          type="button"
          className="calendar-range-toggle"
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
          <CalendarRange size={20} aria-hidden="true" />
          Date range
        </button>
      )}
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
      <p
        className="calendar-instructions"
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
              className={`calendar-day${cell.date === now ? " is-today" : ""}${selected ? " is-selected" : ""}${count > 0 ? " has-workout" : ""}${mode === "range" && from === cell.date ? " is-range-start" : ""}${mode === "range" && to === cell.date ? " is-range-end" : ""}${edges?.start ? " range-row-start" : ""}${edges?.end ? " range-row-end" : ""}${!cell.inMonth ? " outside-month" : ""}`}
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
              <span>{cell.day}</span>
              {cell.inMonth && count > 0 && (
                <span className="calendar-workout-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      <div className="calendar-footer">
        <span>
          <span className="calendar-workout-dot" aria-hidden="true" /> Workout
          day
        </span>
        {canReset && (
          <button
            type="button"
            className="text-button calendar-reset"
            title={`Clear the selection and show ${localizedDate(now, { month: "long", year: "numeric" })}`}
            onClick={() => change({ type: "reset" })}
          >
            <X size={16} aria-hidden="true" />
            Clear selection
          </button>
        )}
      </div>
    </section>
  );
}
