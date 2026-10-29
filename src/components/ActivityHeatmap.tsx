import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { X } from "lucide-react";
import Segmented from "@/components/ui/Segmented";
import { shiftDate } from "@/data/summary";
import { localizedDate } from "@/lib/dates";
import {
  HEATMAP_SPANS,
  countWorkoutsBetween,
  heatmapMonthLabels,
  heatmapWeeks,
  intensityLevel,
  spanInfo,
  weekdayIndex,
  type HeatmapSpan,
} from "@/lib/heatmap";
import {
  type HistoryCalendarAction,
  type HistoryCalendarState,
} from "@/lib/history-calendar";
import { countLabel } from "@/lib/labels";

const SPAN_OPTIONS = HEATMAP_SPANS.map(({ value, label }) => ({
  value,
  label,
}));

/**
 * A GitHub-style activity grid: columns are Monday-first weeks, rows are
 * weekdays, and a square's shade is that day's workout count. The squares are
 * deliberately smaller than 44px, so they are buttons in one tab stop with
 * arrow-key movement. Wide spans scroll inside the card.
 */
export default function ActivityHeatmap({
  value,
  now,
  counts,
  canReset,
  instructionsId,
  headingId,
  change,
}: {
  value: HistoryCalendarState;
  now: string;
  counts: ReadonlyMap<string, number>;
  canReset: boolean;
  instructionsId: string;
  headingId: string;
  change: (action: HistoryCalendarAction) => void;
}) {
  const { span, heatEnd, selectedDate } = value;
  const { start, end, weeks } = heatmapWeeks(heatEnd, span);
  const monthLabels = heatmapMonthLabels(weeks);
  const total = countWorkoutsBetween(counts, start, end);
  const [focused, setFocused] = useState(selectedDate ?? heatEnd);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inWindow = (date: string) => date >= start && date <= end;
  const focusable = inWindow(focused)
    ? focused
    : selectedDate && inWindow(selectedDate)
      ? selectedDate
      : end;

  // Start on the most recent week.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [span, heatEnd]);

  useEffect(() => {
    if (pendingFocus.current && buttons.current.has(pendingFocus.current)) {
      buttons.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  // Weeks run left to right and days top to bottom, so the arrows follow.
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const weekday = weekdayIndex(date);
    const offsets: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const target = shiftDate(date, offsets[event.key]);
    if (!inWindow(target)) return;
    pendingFocus.current = target;
    setFocused(target);
  };

  const summary =
    heatEnd === now
      ? `${countLabel(total, "workout")} in the last ${spanInfo(span).phrase}`
      : `${countLabel(total, "workout")} · ${localizedDate(start, { day: "numeric", month: "short" })} – ${localizedDate(end, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <Segmented
        label="Time span"
        value={span}
        options={SPAN_OPTIONS}
        onChange={(next: HeatmapSpan) => change({ type: "span", span: next })}
      />
      <p className="heatmap-summary" aria-live="polite">
        {summary}
      </p>
      <p
        className={selectedDate ? "calendar-instructions" : "sr-only"}
        id={instructionsId}
        aria-live="polite"
      >
        {selectedDate
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
          week.
        </span>
      </p>
      <div className="heatmap">
        <div className="heatmap-weekdays" aria-hidden="true">
          {["Mon", "Wed", "Fri"].map((name, index) => (
            <span key={name} style={{ gridRow: index * 2 + 1 }}>
              {name}
            </span>
          ))}
        </div>
        <div className="heatmap-scroll" ref={scroller}>
          <div
            className="heatmap-inner"
            style={{ "--hm-cols": weeks.length } as CSSProperties}
          >
            <div className="heatmap-months" aria-hidden="true">
              {monthLabels.map(({ column, month }) => (
                <span key={month} style={{ gridColumn: column + 1 }}>
                  {localizedDate(month + "-01", { month: "short" })}
                </span>
              ))}
            </div>
            <div
              className="heatmap-grid"
              role="group"
              aria-labelledby={headingId}
            >
              {weeks.flatMap((week, column) =>
                week.days.map((date, row) => {
                  if (!date) return null;
                  const count = counts.get(date) ?? 0;
                  const selected = selectedDate === date;
                  return (
                    <button
                      type="button"
                      key={date}
                      ref={(node) => {
                        if (node) buttons.current.set(date, node);
                        else buttons.current.delete(date);
                      }}
                      className={`heatmap-day level-${intensityLevel(count)}${date === now ? " is-today" : ""}${selected ? " is-selected" : ""}`}
                      style={{ gridColumn: column + 1, gridRow: row + 1 }}
                      tabIndex={date === focusable ? 0 : -1}
                      aria-current={date === now ? "date" : undefined}
                      aria-pressed={selected}
                      aria-describedby={instructionsId}
                      aria-label={`${localizedDate(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, ${countLabel(count, "workout")}`}
                      onFocus={() => setFocused(date)}
                      onKeyDown={(event) => onKey(event, date)}
                      onClick={() => change({ type: "date", date })}
                    />
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="calendar-footer heatmap-footer">
        {canReset && (
          <button
            type="button"
            className="text-button calendar-reset"
            title="Clear the selection and show the latest weeks"
            onClick={() => change({ type: "reset" })}
          >
            <X size={16} aria-hidden="true" />
            Clear selection
          </button>
        )}
        <span className="heatmap-legend" aria-hidden="true">
          Less
          {[0, 1, 2, 3].map((level) => (
            <i key={level} className={`heatmap-day level-${level}`} />
          ))}
          More
        </span>
      </div>
    </>
  );
}
