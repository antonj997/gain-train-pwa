import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { type RecordDoc } from "@/data/model";
import { useDragSelect } from "@/hooks/useDragSelect";
import { monthDragRange } from "@/lib/drag-selection";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import HistoryFooter from "@/components/HistoryFooter";
import MonthPicker from "@/components/MonthPicker";
import {
  changeHistoryCalendar,
  historyCalendarBounds,
  moveCalendarMonth,
  sixWeekCells,
  workoutDates,
  type HistoryCalendarAction,
  type HistoryCalendarState,
} from "@/lib/history-calendar";
import {
  localizedDate,
  shiftDate,
  weekdayIndex,
  weekdayNames,
} from "@/lib/dates";
import { DayCount } from "@/components/items/DayCell";
import { dayCellClass } from "@/components/items/day-cell";
import { historyCaption } from "@/lib/history-caption";
import { countLabel } from "@/lib/labels";
import { EASE, MOTION, play } from "@/lib/motion";
import {
  ZOOM_PARTS,
  flipTransform,
  rowDelay,
  zoomPlan,
  type Rect,
} from "@/lib/calendar-zoom";
import "@/styles/history-calendar.css";
import { t } from "@/i18n";

/** A planned day ahead that can be moved or skipped from the month view. */
export type PlannedDayEdit = {
  /** Whether `date` holds a planned workout that can still be moved. */
  can: (date: string) => boolean;
  /** Its routine or day type, for the cell's label. */
  title: (date: string) => string;
  /** Opens the day sheet for it. */
  open: (date: string) => void;
  /** The day the sheet is open on, if any. */
  openDate: string | null;
};

const box = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/**
 * The Calendar tab's calendar card. Two views share one header (the title
 * left, the controls right) and the footer: the compact year grid
 * (ActivityHeatmap, the default) and the month calendar, always six weeks
 * tall so the card keeps its height between months. The expand button in the
 * head zooms from one to the other: each day of the month flies from its
 * square in the compact grid to its month cell and grows, while the rest of
 * the grid zooms past and fades (src/lib/calendar-zoom.ts); collapse plays it
 * in reverse. Both views stay rendered, the one not shown hidden, so the zoom
 * can measure both and the grid keeps its scroll.
 */
export default function HistoryCalendar({
  value,
  now,
  records,
  planned,
  edit,
  maxMonth,
  onChange,
  picking,
  onPicking,
  periodShown = false,
}: {
  value: HistoryCalendarState;
  now: string;
  records: readonly RecordDoc[];
  /** Whether a plan holds a workout on a date to come: a green outline. */
  planned?: (date: string) => boolean;
  /** Planned days ahead open the day sheet. */
  edit?: PlannedDayEdit;
  /** The last month ‹ › and the picker go to (as far as a plan reaches). */
  maxMonth: string;
  onChange: (value: HistoryCalendarState) => void;
  /** The month picker is open (from the month title or the page's ⋯). */
  picking: boolean;
  onPicking: (open: boolean) => void;
  /**
   * The page shows the chosen period under its own heading, with Clear: the
   * footer then leaves out its caption and Clear.
   */
  periodShown?: boolean;
}) {
  const { month, mode, display, selectedDate, from, to, activeBound } = value;
  const cells = sixWeekCells(month);
  const counts = workoutDates(records);
  const bounds = historyCalendarBounds(value, now);
  const currentMonth = now.slice(0, 7);
  const lastMonth = maxMonth > currentMonth ? maxMonth : currentMonth;
  const heat = display === "simple";
  const canReset = !!selectedDate || !!from || !!to || !!value.dates;
  const caption = historyCaption(value, counts, now);
  const heatInstructionsId = useId();
  const monthInstructionsId = useId();
  const headingId = useId();
  const [focused, setFocused] = useState(selectedDate ?? now);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const editable = (date: string) =>
    date > now && date <= lastMonth + "-31" && !!edit?.can(date);
  const inView = (date: string) =>
    date.startsWith(month) && (date <= now || editable(date));
  const firstEditable = cells.find((c) => c.inMonth && editable(c.date))?.date;
  const focusable = inView(focused)
    ? focused
    : month === currentMonth
      ? now
      : month < currentMonth
        ? month + "-01"
        : (firstEditable ?? null);
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
  const cellStates = cells.map((cell) => {
    const count = cell.inMonth ? (counts.get(cell.date) ?? 0) : 0;
    const band = preview ? { start: preview.from, end: preview.to } : bounds;
    const inRange =
      (mode === "range" || !!preview) &&
      cell.inMonth &&
      !!band &&
      cell.date >= band.start &&
      cell.date <= band.end;
    const selected =
      mode === "range" || preview ? inRange : selectedDate === cell.date;
    const isEnd =
      selected &&
      (preview
        ? preview.from === cell.date || preview.to === cell.date
        : mode === "range"
          ? from === cell.date || to === cell.date
          : selectedDate === cell.date);
    return { cell, count, selected, isEnd };
  });
  const hasSelection = cellStates.some((state) => state.selected);

  // ---- The zoom. A tap while it runs is ignored.
  const stage = useRef<HTMLDivElement>(null);
  const heatLayer = useRef<HTMLDivElement>(null);
  const monthLayer = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const zooming = useRef<{ expanding: boolean; h0: number } | null>(null);
  const busy = useRef(false);
  const [announce, setAnnounce] = useState("");
  const monthTitle = localizedDate(month + "-01", {
    month: "long",
    year: "numeric",
  });

  const browse = (next: string) => {
    if (busy.current) return;
    change({ type: "browse", month: next, max: lastMonth });
  };

  const zoom = () => {
    if (busy.current || !stage.current) return;
    busy.current = true;
    zooming.current = {
      expanding: heat,
      h0: stage.current.getBoundingClientRect().height,
    };
    onPicking(false);
    const next = changeHistoryCalendar(
      value,
      { type: "display", display: heat ? "detailed" : "simple" },
      now,
    );
    setAnnounce(
      heat
        ? t("history.viewMonth", {
            month: localizedDate(next.month + "-01", {
              month: "long",
              year: "numeric",
            }),
          })
        : t("history.viewYear"),
    );
    onChange(next);
  };

  // Runs once React has swapped the views: both are laid out, the new one in
  // the flow and the old one on top of it, so each day can be measured in both.
  useLayoutEffect(() => {
    const run = zooming.current;
    const area = stage.current;
    const heatEl = heatLayer.current;
    const monthEl = monthLayer.current;
    if (!run || !area || !heatEl || !monthEl) return;
    zooming.current = null;
    const { expanding, h0 } = run;
    area.dataset.zooming = expanding ? "in" : "out";
    const D = MOTION.zoom;
    const h1 = area.getBoundingClientRect().height;
    const animations: (Animation | null)[] = [];
    const hidden: HTMLElement[] = [];
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ordered = <T,>(frames: T[]) =>
      expanding ? frames : [...frames].reverse();

    if (reduced) {
      // A short crossfade, and the card takes its new height at once.
      animations.push(
        play(expanding ? heatEl : monthEl, [{ opacity: 1 }, { opacity: 0 }], {
          fill: "forwards",
        }),
        play(expanding ? monthEl : heatEl, [{ opacity: 0 }, { opacity: 1 }]),
      );
    } else {
      const scroller = heatEl.querySelector(".heatmap-scroll");
      const squares = new Map<string, Rect>();
      const squareEls = new Map<string, HTMLElement>();
      heatEl
        .querySelectorAll<HTMLElement>(".heatmap-day[data-date]")
        .forEach((el) => {
          squares.set(el.dataset.date!, box(el));
          squareEls.set(el.dataset.date!, el);
        });
      const dayEls = [
        ...monthEl.querySelectorAll<HTMLElement>(".month-day[data-day]"),
      ];
      const plan = zoomPlan(
        dayEls.map((el) => ({ date: el.dataset.day!, box: box(el) })),
        squares,
        scroller ? box(scroller) : box(heatEl),
        box(heatEl),
      );
      const weeks = Math.ceil(dayEls.length / 7);
      const byDate = new Map(dayEls.map((el) => [el.dataset.day!, el]));
      for (const flight of plan.flights) {
        const el = byDate.get(flight.date)!;
        const week = Number(el.dataset.week);
        const square = squareEls.get(flight.date);
        if (square) {
          square.style.visibility = "hidden";
          hidden.push(square);
        }
        animations.push(
          play(
            el,
            ordered([
              { transform: flipTransform(flight.from, flight.to) },
              { transform: "none" },
            ]),
            {
              duration: D * ZOOM_PARTS.flight,
              delay: rowDelay(week, weeks, expanding, MOTION.zoomStep),
              easing: EASE.zoom,
              fill: "both",
            },
          ),
        );
        const number = el.querySelector(".month-day-n");
        animations.push(
          play(
            number,
            expanding
              ? [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }]
              : [{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }],
            { duration: D * ZOOM_PARTS.number, fill: "both" },
          ),
        );
      }
      for (const date of plan.fades) {
        const el = byDate.get(date)!;
        const shown = getComputedStyle(el).opacity;
        animations.push(
          play(el, ordered([{ opacity: 0 }, { opacity: shown }]), {
            duration: D * ZOOM_PARTS.fade,
            delay: expanding ? D * ZOOM_PARTS.fadeDelay : 0,
            fill: "both",
          }),
        );
      }
      if (plan.origin)
        heatEl.style.transformOrigin = `${plan.origin.x}px ${plan.origin.y}px`;
      animations.push(
        play(
          heatEl,
          ordered(
            plan.origin
              ? [
                  { opacity: 1, transform: "scale(1)" },
                  {
                    opacity: 0,
                    transform: `scale(${ZOOM_PARTS.layerScale})`,
                  },
                ]
              : [{ opacity: 1 }, { opacity: 0 }],
          ),
          {
            duration: D * ZOOM_PARTS.layer,
            delay: expanding ? 0 : D * ZOOM_PARTS.layerDelayBack,
            easing: EASE.collapse,
            fill: "both",
          },
        ),
      );
      // The weekday heads and the From–To fields come and go with the month.
      monthEl
        .querySelectorAll(".month-weekdays, .calendar-range-fields")
        .forEach((el) =>
          animations.push(
            play(el, ordered([{ opacity: 0 }, { opacity: 1 }]), {
              duration: D * ZOOM_PARTS.fadeDelay,
              delay: expanding ? D * ZOOM_PARTS.fadeDelay : 0,
              fill: "both",
            }),
          ),
        );
      animations.push(
        play(area, [{ height: `${h0}px` }, { height: `${h1}px` }], {
          duration: D * ZOOM_PARTS.height,
          easing: EASE.zoom,
        }),
        play(titleRef.current, [{ opacity: 0 }, { opacity: 1 }], {
          duration: D * ZOOM_PARTS.fade,
        }),
      );
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      delete area.dataset.zooming;
      for (const animation of animations) animation?.cancel();
      for (const el of hidden) el.style.visibility = "";
      heatEl.style.transformOrigin = "";
      busy.current = false;
    };
    void Promise.all(
      animations.map((a) => (a ? a.finished.catch(() => {}) : null)),
    ).then(finish);
    // Leaving the page mid-zoom: nothing is left hidden.
    return () => {
      if (!done) finish();
    };
  }, [heat]);

  useEffect(() => {
    if (pendingFocus.current && buttons.current.has(pendingFocus.current)) {
      buttons.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  const onDateKey = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const weekday = weekdayIndex(date);
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
    if (target < "1900-01-01") return;
    // Ahead of today, the keys only stop on planned days that can be moved.
    if (target > now && !editable(target)) return;
    if (event.shiftKey && target <= now) {
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

  const footer = (
    <HistoryFooter
      caption={periodShown || !caption ? null : caption}
      canReset={canReset && !periodShown}
      resetTitle={
        heat
          ? t("history.clearToYear")
          : t("history.clearToMonth", {
              month: localizedDate(now, { month: "long", year: "numeric" }),
            })
      }
      onReset={() => change({ type: "reset" })}
    />
  );

  return (
    <section
      className={`history-calendar ${heat ? "is-compact" : "is-month"}`}
      aria-label={t("history.calendar")}
    >
      <div className="history-bar">
        <h2
          className="history-title"
          id={headingId}
          ref={titleRef}
          aria-live={heat ? undefined : "polite"}
        >
          {heat ? (
            t("history.lastYear")
          ) : (
            <button
              type="button"
              className="month-title-button"
              aria-haspopup="dialog"
              aria-expanded={picking}
              aria-label={t("history.monthChoose", { month: monthTitle })}
              onClick={() => onPicking(!picking)}
            >
              {monthTitle}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
        </h2>
        <div className="history-controls">
          {!heat && (
            <>
              <button
                type="button"
                className="icon-btn"
                aria-label={t("history.previousMonth")}
                disabled={month <= "1900-01"}
                onClick={() => browse(moveCalendarMonth(month, -1))}
              >
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t("history.nextMonth")}
                disabled={month >= lastMonth}
                onClick={() => browse(moveCalendarMonth(month, 1))}
              >
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </>
          )}
          {/* The same button both ways; the label says what it does. */}
          <button
            type="button"
            className="icon-btn calendar-zoom"
            aria-label={heat ? t("history.zoomIn") : t("history.zoomOut")}
            title={heat ? t("history.zoomIn") : t("history.zoomOut")}
            onClick={zoom}
          >
            {heat ? (
              <Maximize2 size={20} aria-hidden="true" />
            ) : (
              <Minimize2 size={20} aria-hidden="true" />
            )}
          </button>
        </div>
        {picking && !heat && (
          <MonthPicker
            month={month}
            max={lastMonth}
            onClose={() => onPicking(false)}
            onPick={(next) => {
              onPicking(false);
              browse(next);
            }}
          />
        )}
      </div>
      <div className="calendar-stage" ref={stage}>
        <div
          className="calendar-layer calendar-heatmap"
          data-active={heat || undefined}
          aria-hidden={heat ? undefined : true}
          ref={heatLayer}
        >
          <ActivityHeatmap
            value={value}
            now={now}
            counts={counts}
            instructionsId={heatInstructionsId}
            headingId={headingId}
            planned={planned}
            change={change}
          />
        </div>
        <div
          className="calendar-layer calendar-month"
          data-active={heat ? undefined : true}
          aria-hidden={heat ? true : undefined}
          ref={monthLayer}
        >
          {mode === "range" && (
            <div className="calendar-range-fields">
              {(["from", "to"] as const).map((bound) => (
                <button
                  type="button"
                  className="calendar-bound"
                  key={bound}
                  aria-label={
                    value[bound]
                      ? t("history.chooseBoundValue", {
                          bound: t(
                            bound === "from" ? "history.from" : "history.to",
                          ),
                          date: localizedDate(value[bound]),
                        })
                      : t("history.chooseBound", {
                          bound: t(
                            bound === "from" ? "history.from" : "history.to",
                          ),
                        })
                  }
                  aria-pressed={activeBound === bound}
                  onClick={() => change({ type: "bound", bound })}
                >
                  <span>
                    {t(bound === "from" ? "history.from" : "history.to")}
                  </span>
                  {value[bound] ? (
                    <time dateTime={value[bound]}>
                      {localizedDate(value[bound], {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </time>
                  ) : (
                    <strong>{t("history.chooseDate")}</strong>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="sr-only" id={monthInstructionsId}>
            {t("history.monthInstructions")}
          </p>
          <div className="month-weekdays" aria-hidden="true">
            {weekdayNames("short").map((name, i) => (
              <span key={i}>{name}</span>
            ))}
          </div>
          <div
            className={`month-grid${drag ? " is-dragging" : ""}${hasSelection ? " has-selection" : ""}`}
            role="group"
            aria-labelledby={headingId}
            ref={grid}
            {...handlers}
          >
            {cellStates.map(({ cell, count, selected, isEnd }) => {
              const ahead = cell.inMonth && cell.date > now;
              const movable = ahead && editable(cell.date);
              const dateText = localizedDate(cell.date, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              return (
                <button
                  type="button"
                  key={cell.date}
                  ref={(node) => {
                    if (node) buttons.current.set(cell.date, node);
                    else buttons.current.delete(cell.date);
                  }}
                  className={`month-day ${dayCellClass(
                    {
                      trained: count > 0,
                      today: cell.date === now,
                      planned: ahead && !!planned?.(cell.date),
                    },
                    "month",
                  )}${selected ? " is-selected" : ""}${isEnd ? " is-edge" : ""}${!cell.inMonth ? " outside-month" : ""}${movable ? " is-movable" : ""}${movable && edit?.openDate === cell.date ? " is-selected-day" : ""}`}
                  data-date={
                    cell.inMonth && cell.date <= now ? cell.date : undefined
                  }
                  data-day={cell.date}
                  data-week={cell.week}
                  disabled={!cell.inMonth || (cell.date > now && !movable)}
                  tabIndex={cell.date === focusable ? 0 : -1}
                  aria-current={cell.date === now ? "date" : undefined}
                  aria-pressed={movable ? undefined : selected}
                  aria-haspopup={movable ? "dialog" : undefined}
                  aria-describedby={movable ? undefined : monthInstructionsId}
                  aria-label={
                    movable
                      ? t("history.plannedDay", {
                          date: dateText,
                          title: edit!.title(cell.date),
                        })
                      : `${dateText}, ${countLabel(count, "workout")}`
                  }
                  onFocus={() => setFocused(cell.date)}
                  onKeyDown={(event) => onDateKey(event, cell.date)}
                  onClick={() =>
                    movable
                      ? edit!.open(cell.date)
                      : change({ type: "date", date: cell.date })
                  }
                >
                  <span className="month-day-n">
                    {cell.day}
                    <DayCount count={count} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {footer}
    </section>
  );
}
