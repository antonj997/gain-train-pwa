import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { shiftDate } from "@/data/summary";
import { localizedDate } from "@/lib/dates";
import {
  heatmapMonthLabels,
  heatmapWeeks,
  heatClass,
  monthTone,
  weekdayIndex,
} from "@/lib/heatmap";
import {
  type HistoryCalendarAction,
  type HistoryCalendarState,
} from "@/lib/history-calendar";
import { countLabel } from "@/lib/labels";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * A GitHub-style activity grid for the last year: columns are Monday-first
 * weeks, rows are weekdays, and a square's shade is that day's workout count
 * (days with two or more also print it). The squares are deliberately smaller
 * than 44px, so they are buttons in one tab stop with arrow-key movement. The
 * grid scrolls inside the card, starting at the latest week.
 */
export default function ActivityHeatmap({
  value,
  now,
  counts,
  instructionsId,
  headingId,
  change,
}: {
  value: HistoryCalendarState;
  now: string;
  counts: ReadonlyMap<string, number>;
  instructionsId: string;
  headingId: string;
  change: (action: HistoryCalendarAction) => void;
}) {
  const { selectedDate } = value;
  const { start, weeks } = heatmapWeeks(now);
  const monthLabels = heatmapMonthLabels(weeks);
  const [focused, setFocused] = useState(selectedDate ?? now);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const focusable = focused >= start && focused <= now ? focused : now;

  // Start on the most recent week.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, []);

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
    if (target < start || target > now) return;
    pendingFocus.current = target;
    setFocused(target);
  };

  return (
    <>
      <p className="sr-only" id={instructionsId}>
        Select a day to filter workouts. Use arrow keys to move between days,
        Home and End to move within a week.
      </p>
      <div className="heatmap">
        <div className="heatmap-weekdays" aria-hidden="true">
          {WEEKDAY_LETTERS.map((letter, row) => (
            <span key={row}>{letter}</span>
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
                      className={`heatmap-day ${heatClass(count)} tone-${monthTone(date)}${date === now ? " is-today" : ""}${selected ? " is-selected" : ""}`}
                      style={{ gridColumn: column + 1, gridRow: row + 1 }}
                      tabIndex={date === focusable ? 0 : -1}
                      aria-current={date === now ? "date" : undefined}
                      aria-pressed={selected}
                      aria-describedby={instructionsId}
                      aria-label={`${localizedDate(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, ${countLabel(count, "workout")}`}
                      onFocus={() => setFocused(date)}
                      onKeyDown={(event) => onKey(event, date)}
                      onClick={() => change({ type: "date", date })}
                    >
                      {count >= 2 && (
                        <span className="heatmap-count" aria-hidden="true">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
