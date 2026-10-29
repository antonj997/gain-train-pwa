import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { type RecordDoc } from "@/data/model";
import { shiftDate } from "@/data/summary";
import { useDragSelect } from "@/hooks/useDragSelect";
import { monthDragRange } from "@/lib/drag-selection";
import ActivityGridIcon from "@/components/ActivityGridIcon";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import HistoryFooter from "@/components/HistoryFooter";
import MonthPicker from "@/components/MonthPicker";
import {
  calendarCells,
  changeHistoryCalendar,
  historyCalendarBounds,
  moveCalendarMonth,
  workoutDates,
  type HistoryCalendarAction,
  type HistoryCalendarState,
} from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import { heatClass } from "@/lib/heatmap";
import { historyCaption } from "@/lib/history-caption";
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
  const heat = display === "simple";
  const canReset = !!selectedDate || !!from || !!to || !!value.dates;
  const caption = historyCaption(value, counts, now);
  const [picking, setPicking] = useState(false);
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
  const grid = useRef<HTMLDivElement>(null);
  const anchor = useRef<string | null>(null);
  const { drag, handlers } = useDragSelect({
    containerRef: grid,
    onCommit: ({ start, current }) => {
      anchor.current = null;
      const range = monthDragRange(start, current);
      change({ type: "range", ...range });
    },
  });
  const preview = drag ? monthDragRange(drag.start, drag.current) : null;
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
    if (event.shiftKey) {
      // Shift+Arrow grows a range from the selected day.
      anchor.current ??= (mode === "range" ? from : selectedDate) ?? date;
      const a = anchor.current;
      change({
        type: "range",
        from: a <= target ? a : target,
        to: a <= target ? target : a,
      });
    } else anchor.current = null;
    pendingFocus.current = target;
    setFocused(target);
    if (!target.startsWith(month)) browse(target.slice(0, 7));
  };

  // The button shows the view it switches to.
  const toDetailed = heat;
  const viewToggle = (
    <button
      type="button"
      className="icon-btn"
      aria-label={toDetailed ? "Show month calendar" : "Show activity grid"}
      title={toDetailed ? "Show month calendar" : "Show activity grid"}
      onClick={() =>
        change({ type: "display", display: toDetailed ? "detailed" : "simple" })
      }
    >
      {toDetailed ? (
        <CalendarDays size={22} aria-hidden="true" />
      ) : (
        <ActivityGridIcon size={22} />
      )}
    </button>
  );

  const footer = (
    <HistoryFooter
      caption={caption}
      canReset={canReset}
      resetTitle={
        heat
          ? "Clear the selection and show the whole year"
          : `Clear the selection and show ${localizedDate(now, { month: "long", year: "numeric" })}`
      }
      onReset={() => change({ type: "reset" })}
    />
  );

  if (heat) {
    return (
      <section
        className="history-calendar calendar-heatmap"
        aria-label="Workout calendar"
      >
        <div className="history-bar">
          <h2 className="history-title" id={headingId}>
            Last year
          </h2>
          <div className="history-controls">{viewToggle}</div>
        </div>
        <ActivityHeatmap
          value={value}
          now={now}
          counts={counts}
          instructionsId={instructionsId}
          headingId={headingId}
          change={change}
        />
        {footer}
      </section>
    );
  }

  return (
    <section
      className="history-calendar calendar-month"
      aria-label="Workout calendar"
    >
      <div className="history-bar">
        <h2 className="history-title" id={headingId} aria-live="polite">
          <button
            type="button"
            className="month-title-button"
            aria-haspopup="dialog"
            aria-expanded={picking}
            aria-label={`${localizedDate(month + "-01", { month: "long", year: "numeric" })}, choose month and year`}
            onClick={() => setPicking(!picking)}
          >
            {localizedDate(month + "-01", { month: "long", year: "numeric" })}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </h2>
        <div className="history-controls">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous month"
            disabled={month <= "1900-01"}
            onClick={() => browse(moveCalendarMonth(month, -1))}
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next month"
            disabled={month >= currentMonth}
            onClick={() => browse(moveCalendarMonth(month, 1))}
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
          {viewToggle}
        </div>
        {picking && (
          <MonthPicker
            month={month}
            max={currentMonth}
            onClose={() => setPicking(false)}
            onPick={(next) => {
              setPicking(false);
              browse(next);
            }}
          />
        )}
      </div>
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
      <p className="sr-only" id={instructionsId}>
        Use arrow keys to move between days, Home and End to move within a week,
        and Shift with an arrow key to select a range. With a pointer, press and
        hold a day, then drag to select a range. Date ranges include both dates.
      </p>
      <div className="month-weekdays" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>
            {new Date(Date.UTC(2024, 0, i + 1)).toLocaleDateString(undefined, {
              weekday: "short",
              timeZone: "UTC",
            })}
          </span>
        ))}
      </div>
      <div
        className={`month-grid${drag ? " is-dragging" : ""}`}
        role="group"
        aria-labelledby={headingId}
        ref={grid}
        {...handlers}
      >
        {cells.map((cell) => {
          const count = cell.inMonth ? (counts.get(cell.date) ?? 0) : 0;
          const band = preview
            ? { start: preview.from, end: preview.to }
            : bounds;
          const inRange =
            (mode === "range" || !!preview) &&
            cell.inMonth &&
            !!band &&
            cell.date >= band.start &&
            cell.date <= band.end;
          const selected =
            mode === "range" || preview ? inRange : selectedDate === cell.date;
          const isEnd = preview
            ? preview.from === cell.date || preview.to === cell.date
            : mode === "range" && (from === cell.date || to === cell.date);
          return (
            <button
              type="button"
              key={cell.date}
              ref={(node) => {
                if (node) buttons.current.set(cell.date, node);
                else buttons.current.delete(cell.date);
              }}
              className={`month-day ${heatClass(count)}${cell.date === now ? " is-today" : ""}${selected ? " is-selected" : ""}${inRange ? " in-range" : ""}${isEnd ? " is-range-end" : ""}${drag?.start === cell.date ? " is-armed" : ""}${!cell.inMonth ? " outside-month" : ""}`}
              data-date={
                cell.inMonth && cell.date <= now ? cell.date : undefined
              }
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
              {cell.day}
            </button>
          );
        })}
      </div>
      {footer}
    </section>
  );
}
