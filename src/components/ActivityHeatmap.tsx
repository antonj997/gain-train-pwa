import {
  useEffect,
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
import {
  heatmapMonthLabels,
  heatmapWeeks,
  heatClass,
  monthTone,
} from "@/lib/heatmap";
import {
  type HistoryCalendarAction,
  type HistoryCalendarState,
} from "@/lib/history-calendar";
import { countLabel } from "@/lib/labels";
import { t } from "@/i18n";

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
  const [focused, setFocused] = useState(selectedDate ?? now);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const focusable = focused >= start && focused <= now ? focused : now;
  const container = useRef<HTMLDivElement>(null);
  const anchor = useRef<string | null>(null);

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
    if (event.shiftKey) {
      // Shift+Arrow grows a range from the selected day.
      anchor.current ??=
        selectedDate ?? (mode === "range" ? from : null) ?? date;
      const a = anchor.current;
      change({
        type: "range",
        from: a <= target ? a : target,
        to: a <= target ? target : a,
      });
    } else anchor.current = null;
    pendingFocus.current = target;
    setFocused(target);
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
        <div className="heatmap-weekdays" aria-hidden="true">
          {weekdayNames("narrow").map((letter, row) => (
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
                  const inPreview = !!preview?.has(date);
                  const selected =
                    !preview &&
                    (mode === "range"
                      ? !!from && !!to && date >= from && date <= to
                      : chosen
                        ? chosen.has(date)
                        : selectedDate === date);
                  return (
                    <button
                      type="button"
                      key={date}
                      ref={(node) => {
                        if (node) buttons.current.set(date, node);
                        else buttons.current.delete(date);
                      }}
                      className={`heatmap-day ${heatClass(count)} tone-${monthTone(date)}${date === now ? " is-today" : ""}${selected ? " is-selected" : ""}${inPreview ? " is-preview" : ""}${(selected || inPreview) && edges.includes(date) ? " is-edge" : ""}`}
                      data-date={date}
                      style={{ gridColumn: column + 1, gridRow: row + 1 }}
                      tabIndex={date === focusable ? 0 : -1}
                      aria-current={date === now ? "date" : undefined}
                      aria-pressed={selected || inPreview}
                      aria-describedby={instructionsId}
                      aria-label={`${dayLabels.get(date)}, ${countLabel(count, "workout")}`}
                      onFocus={() => setFocused(date)}
                      onKeyDown={(event) => onKey(event, date)}
                      onClick={() => {
                        anchor.current = null;
                        change({ type: "day", date, toggle: true });
                      }}
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
