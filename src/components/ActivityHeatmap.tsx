import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useDragSelect } from "@/hooks/useDragSelect";
import {
  heatmapDragSelection,
  selectionDates,
  selectionEdges,
  type DragSelection,
} from "@/lib/drag-selection";
import {
  localizedDate,
  shiftDate,
  weekdayIndex,
  weekdayNames,
} from "@/lib/dates";
import { heatmapMonthLabels, heatmapWeeks, monthTone } from "@/lib/heatmap";
import {
  type HistoryCalendarAction,
  type HistoryCalendarState,
} from "@/lib/history-calendar";
import { countLabel } from "@/lib/labels";
import { DayCount } from "@/components/items/DayCell";
import { dayCellClass } from "@/components/items/day-cell";
import { t } from "@/i18n";

/**
 * The weekday letters on the left and the month names on top of a compact
 * calendar (12 px squares, one Monday-first column per week). Shared by
 * Calendar's half-year grid and the plan's period calendar
 * (PlanPeriodCalendar).
 */
export function CompactWeekdays() {
  return (
    <div className="heatmap-weekdays" aria-hidden="true">
      {weekdayNames("narrow").map((letter, row) => (
        <span key={row}>{letter}</span>
      ))}
    </div>
  );
}

export function CompactMonths({
  labels,
}: {
  labels: readonly { column: number; month: string }[];
}) {
  return (
    <div className="heatmap-months" aria-hidden="true">
      {labels.map(({ column, month }) => (
        <span key={month} style={{ gridColumn: column + 1 }}>
          {localizedDate(month + "-01", { month: "short" }).replace(/\./g, "")}
        </span>
      ))}
    </div>
  );
}

/**
 * Calendar's compact grid of the last half year (v6 C1): columns are
 * Monday-first weeks, rows are weekdays, and a square is filled on a day with
 * a workout (two or more also print the count). Today is a dot in the middle.
 * A tap on a single square does nothing (they are too small to aim at): hold
 * one and drag to choose a week (one column), a weekday across weeks (one
 * row) or a period. With a keyboard the grid is one tab stop: arrows move a
 * cursor, Shift with an arrow chooses a period. The grid scrolls inside the
 * card, starting at the latest week.
 */
export default function ActivityHeatmap({
  value,
  now,
  counts,
  instructionsId,
  headingId,
  planned,
  change,
}: {
  value: HistoryCalendarState;
  now: string;
  counts: ReadonlyMap<string, number>;
  instructionsId: string;
  headingId: string;
  /** Whether a plan holds a workout on a date to come. */
  planned?: (date: string) => boolean;
  change: (action: HistoryCalendarAction) => void;
}) {
  const { selectedDate, mode, from, to, dates } = value;
  // The grid and its labels depend on the date only; a drag re-renders often.
  const { start, weeks, monthLabels, dayLabels } = useMemo(() => {
    const grid = heatmapWeeks(now);
    const dayLabels = new Map<string, string>();
    for (const week of grid.weeks)
      for (const date of week.days)
        if (date)
          dayLabels.set(
            date,
            localizedDate(date, {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          );
    return {
      ...grid,
      monthLabels: heatmapMonthLabels(grid.weeks),
      dayLabels,
    };
  }, [now]);
  // The keyboard's cursor, shown while the grid has the focus.
  const [cursor, setCursor] = useState(selectedDate ?? now);
  const [focused, setFocused] = useState(false);
  const [heard, setHeard] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const anchor = useRef<string | null>(null);
  const at = cursor >= start && cursor <= now ? cursor : now;

  const apply = (selection: DragSelection) => {
    anchor.current = null;
    if (selection.kind === "day") change({ type: "day", date: selection.date });
    else if (selection.kind === "range")
      change({ type: "range", from: selection.from, to: selection.to });
    else
      change({ type: "dates", dates: selection.dates, label: selection.label });
  };
  const { drag, handlers } = useDragSelect({
    containerRef: container,
    scrollerRef: scroller,
    onCommit: ({ start: a, current: b }) =>
      apply(heatmapDragSelection(a, b, start)),
  });
  const previewSelection = drag
    ? heatmapDragSelection(drag.start, drag.current, start)
    : null;
  const preview = previewSelection
    ? new Set(selectionDates(previewSelection))
    : null;
  const chosen = dates ? new Set(dates.dates) : null;
  // The first and last day of what is shown, for the stronger ring.
  const edges: string[] = previewSelection
    ? selectionEdges(previewSelection)
    : chosen
      ? [dates!.dates[0], dates!.dates[dates!.dates.length - 1]]
      : mode === "range"
        ? from && to
          ? [from, to]
          : []
        : selectedDate
          ? [selectedDate]
          : [];
  const hasSelection =
    !!preview || edges.some((date) => date >= start && date <= now);

  // Start on the most recent week.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, []);

  const say = (date: string) =>
    setHeard(
      `${dayLabels.get(date)}, ${countLabel(counts.get(date) ?? 0, "workout")}`,
    );
  // Weeks run left to right and days top to bottom, so the arrows follow.
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const date = at;
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
    if (event.shiftKey) {
      // Shift+Arrow grows a range from where the cursor was.
      anchor.current ??=
        selectedDate ?? (mode === "range" ? from : null) ?? date;
      const a = anchor.current;
      change({
        type: "range",
        from: a <= target ? a : target,
        to: a <= target ? target : a,
      });
    } else anchor.current = null;
    setCursor(target);
    say(target);
    // Keep the cursor in view.
    container.current
      ?.querySelector(`[data-date="${target}"]`)
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  return (
    <>
      <p className="sr-only" id={instructionsId}>
        {t("history.heatmapInstructions")}
      </p>
      <div
        className={`heatmap${drag ? " is-dragging" : ""}${hasSelection ? " has-selection" : ""}`}
        ref={container}
        {...handlers}
      >
        <CompactWeekdays />
        <div className="heatmap-scroll" ref={scroller}>
          <div
            className="heatmap-inner"
            style={{ "--hm-cols": weeks.length } as CSSProperties}
          >
            <CompactMonths labels={monthLabels} />
            <div
              className="heatmap-grid"
              role="group"
              aria-labelledby={headingId}
              aria-describedby={instructionsId}
              tabIndex={0}
              onKeyDown={onKey}
              onFocus={() => {
                setFocused(true);
                say(at);
              }}
              onBlur={() => setFocused(false)}
            >
              {weeks.flatMap((week, column) =>
                week.days.map((date, row) => {
                  if (!date) {
                    // The rest of this week: only a planned day shows.
                    const later = shiftDate(week.days[0]!, row);
                    return planned?.(later) ? (
                      <span
                        key={later}
                        className={dayCellClass({ planned: true }, "grid")}
                        style={{ gridColumn: column + 1, gridRow: row + 1 }}
                        aria-hidden="true"
                      />
                    ) : null;
                  }
                  const count = counts.get(date) ?? 0;
                  const inPreview = !!preview?.has(date);
                  const selected =
                    !preview &&
                    (mode === "range"
                      ? !!from && !!to && date >= from && date <= to
                      : chosen
                        ? chosen.has(date)
                        : selectedDate === date);
                  return (
                    <span
                      key={date}
                      className={`heatmap-day ${dayCellClass(
                        {
                          trained: count > 0,
                          today: date === now,
                          todayDot: true,
                        },
                        "grid",
                      )} tone-${monthTone(date)}${selected ? " is-selected" : ""}${inPreview ? " is-preview" : ""}${(selected || inPreview) && edges.includes(date) ? " is-edge" : ""}${focused && date === at ? " is-cursor" : ""}`}
                      data-date={date}
                      style={{ gridColumn: column + 1, gridRow: row + 1 }}
                      aria-hidden="true"
                    >
                      <DayCount count={count} />
                    </span>
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {heard}
      </p>
    </>
  );
}
