import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type RecordDoc } from "@/data/model";
import { shiftDate } from "@/data/summary";
import {
  calendarCells,
  moveCalendarMonth,
  workoutDates,
} from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import "@/styles/history-calendar.css";

export default function HistoryCalendar({
  month,
  now,
  records,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: {
  month: string;
  now: string;
  records: readonly RecordDoc[];
  selectedDate: string | null;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
}) {
  const cells = calendarCells(month);
  const counts = workoutDates(records);
  const currentMonth = now.slice(0, 7);
  const [focused, setFocused] = useState(selectedDate ?? now);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const focusable = focused.startsWith(month)
    ? focused
    : month === currentMonth
      ? now
      : month + "-01";
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
    if (!target.startsWith(month)) onMonthChange(target.slice(0, 7));
  };
  return (
    <section className="history-calendar" aria-label="Workout calendar">
      <div className="calendar-heading">
        <button
          className="icon-button"
          aria-label="Previous month"
          disabled={month <= "1900-01"}
          onClick={() => onMonthChange(moveCalendarMonth(month, -1))}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 aria-live="polite">
          {localizedDate(month + "-01", { month: "long", year: "numeric" })}
        </h2>
        <button
          className="icon-button"
          aria-label="Next month"
          disabled={month >= currentMonth}
          onClick={() => onMonthChange(moveCalendarMonth(month, 1))}
        >
          <ChevronRight size={20} />
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
        {cells.map((cell) => {
          const count = counts.get(cell.date) ?? 0;
          const selected = selectedDate === cell.date;
          return (
            <button
              key={cell.date}
              ref={(node) => {
                if (node) buttons.current.set(cell.date, node);
                else buttons.current.delete(cell.date);
              }}
              className={`calendar-day${cell.date === now ? " is-today" : ""}${selected ? " is-selected" : ""}${!cell.inMonth ? " outside-month" : ""}`}
              disabled={!cell.inMonth || cell.date > now}
              tabIndex={cell.date === focusable ? 0 : -1}
              aria-current={cell.date === now ? "date" : undefined}
              aria-pressed={selected}
              aria-label={`${localizedDate(cell.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${countLabel(count, "workout")}`}
              onFocus={() => setFocused(cell.date)}
              onKeyDown={(event) => onDateKey(event, cell.date)}
              onClick={() => onSelectDate(cell.date)}
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
          logged
        </span>
        <button
          className="text-button"
          onClick={() => onMonthChange(currentMonth)}
        >
          {month === currentMonth ? "Show whole month" : "This month"}
        </button>
      </div>
    </section>
  );
}
