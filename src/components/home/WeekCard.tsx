import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Moon } from "lucide-react";
import { useData } from "@/contexts/useData";
import type { Plan, WorkoutRecord } from "@/data/model";
import {
  activePlans,
  groupsOf,
  plannedFor,
  resolveCell,
  REST,
  type PlannedDay,
  type PlanItem,
} from "@/data/plans";
import {
  canEditDay,
  canMoveTo,
  isWorkoutCell,
  moveDay,
  restoreDay,
  skipDay,
  snapshotDay,
} from "@/data/plan-moves";
import { phaseWeek } from "@/data/phase";
import { routines as routineRecords } from "@/data/selectors";
import { categoryLabel } from "@/lib/catalogue-labels";
import { isoWeek, localizedDate, shiftDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { notify, offerUndo } from "@/lib/message-store";
import { motionMs } from "@/lib/slow-motion";
import { routineAverageMinutes, routineMeta } from "@/lib/routine-preview";
import { springValues } from "@/lib/spring";
import { capturePointer, releasePointer } from "@/lib/pointer-capture";
import { goalStreak, weekStrip, weekTotals } from "@/lib/week-summary";
import { useT } from "@/i18n/useT";
import DayCell from "@/components/items/DayCell";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import DaySheet from "@/components/home/DaySheet";
import { reducedMotion, useUndoEntries } from "@/hooks/useMessages";
import { useTipTarget } from "@/hooks/useTipTarget";
import { EASE as EASE_CURVES, MOTION, SPRING } from "@/lib/motion";

type Props = {
  /** Finished workouts, newest first. */
  completed: WorkoutRecord[];
  goal: number | null;
  day: string;
  planned: (date: string) => PlannedDay | null;
};

/** The week card's Undo slot, under the strip, for a skipped day. */
export const WEEK_SCOPE = "week:plan";

/** Hold this long, within MOVE_SLOP px, before a planned day lifts. */
const LIFT_MS = 350;
const MOVE_SLOP = 8;
/** Lifted, the ring grows a little and settles like a spring. */
const LIFT_SCALE = 1.12;
const SLIDE_MS = MOTION.page;
const STATUS_MS = 4000;
const EASE = EASE_CURVES.out;

type Box = { x: number; y: number; w: number; h: number };
type Press = {
  date: string;
  pointer: number;
  x0: number;
  y0: number;
  timer: number;
  lifted: boolean;
  dead: boolean;
  box: Box;
  x: number;
  target: string | null;
};

const short = (date: string) =>
  localizedDate(date, { weekday: "short", day: "numeric" });

const planOf = ({ id: _id, ...plan }: PlanItem): Plan => plan;

/** A ring's transform at a box, scaled about its centre. */
const ringAt = (box: Box, x = box.x, scale = 1) =>
  `translate(${x}px, ${box.y}px) scale(${scale})`;

/**
 * This week on Train: "Week 45 · 2 of 3 workouts", a day cell per day (done,
 * today, planned) and the totals. The head is a link to History (the card
 * around the strip too). A planned day is a button: tap opens the day sheet
 * (step it a day, do it today, skip it); press and hold until its ring lifts,
 * then drag it to another day. A busy day swaps with it. Every change is a
 * dated override on the plan.
 */
export default function WeekCard({ completed, goal, day, planned }: Props) {
  const { state, save } = useData();
  const { t, language } = useT();
  const tipRef = useTipTarget<HTMLDivElement>("weekStrip", { tap: true });
  const plans = useMemo(() => activePlans(state.records), [state.records]);
  const routines = useMemo(
    () => routineRecords(state.records),
    [state.records],
  );
  const names = useMemo(
    () => ({ routines, groups: groupsOf(state.records) }),
    [routines, state.records],
  );
  const week = useMemo(() => {
    const dates = completed.map((r) => r.payload.date);
    const days = weekStrip(dates, day);
    return {
      // The plan is resolved once per day here, not on every render.
      days: days.map((d) => {
        const found = plannedFor(plans, d.date);
        return {
          ...d,
          entry: planned(d.date),
          skipped: !!found?.override && found.cell === REST,
        };
      }),
      totals: weekTotals(
        completed.map((r) => r.payload),
        day,
      ),
      streak: goalStreak(dates, goal, day),
    };
    // The weekday letters follow the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, goal, day, planned, plans, language]);
  const { totals } = week;
  const goalMet = goal !== null && totals.workouts >= goal;
  const summary = [
    t("home.weekLabel", { week: isoWeek(day) }),
    goal !== null
      ? t("home.goalProgress", { done: totals.workouts, goal })
      : countLabel(totals.workouts, "workout"),
  ].join(" · ");
  const totalsLine = totals.workouts
    ? [
        countLabel(totals.sets, "set"),
        totals.minutes > 0 && durationLabel(totals.minutes),
        week.streak >= 2 && t("home.streak", { count: week.streak }),
      ]
        .filter(Boolean)
        .join(" · ")
    : week.streak >= 2
      ? t("home.streak", { count: week.streak })
      : t("home.nothingThisWeek");

  // Changes are saved one after another; until a save lands, the next change
  // builds on what the last one made, so quick steps in the sheet add up.
  const pending = useRef(new Map<string, Plan>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const livePlans = useCallback(
    (): PlanItem[] =>
      plans.map((p) => {
        const next = pending.current.get(p.id);
        return next ? { ...next, id: p.id } : p;
      }),
    [plans],
  );
  const commit = (id: string, next: Plan) => {
    pending.current.set(id, next);
    const run = queue.current.then(() => save(id, "plan", next));
    queue.current = run.catch(() => {});
    return run
      .catch((cause) => {
        notify.error(t("week.changeFailed"));
        throw cause;
      })
      .finally(() => {
        if (pending.current.get(id) === next) pending.current.delete(id);
      });
  };

  // The line under the strip says what just changed, then the totals again.
  const [status, setStatus] = useState<{ id: number; text: string } | null>(
    null,
  );
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), motionMs(STATUS_MS));
    return () => window.clearTimeout(timer);
  }, [status]);
  const say = (text: string) =>
    setStatus((s) => ({ id: (s?.id ?? 0) + 1, text }));
  const undos = useUndoEntries(WEEK_SCOPE);

  // ---- The strip's rings: one that moves, one that makes room on a swap.
  const wrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const swapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [ghosted, setGhosted] = useState<readonly string[]>([]);
  const [drop, setDrop] = useState<{
    from: string;
    target: string | null;
  } | null>(null);
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(0);

  const boxOf = (date: string): Box | null => {
    const wrap = wrapRef.current;
    const cell = wrap?.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (!wrap || !cell) return null;
    const a = wrap.getBoundingClientRect();
    const b = cell.getBoundingClientRect();
    return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
  };
  const showRing = (el: HTMLElement | null, box: Box, scale = 1) => {
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.style.width = `${box.w}px`;
    el.style.height = `${box.h}px`;
    el.style.transform = ringAt(box, box.x, scale);
    el.dataset.on = "";
  };
  const hideRing = (el: HTMLElement | null) => {
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    delete el.dataset.on;
    el.classList.remove("is-lifted");
  };
  const finished = (animation: Animation | undefined): Promise<void> =>
    animation
      ? animation.finished.then(
          () => undefined,
          () => undefined,
        )
      : Promise.resolve();

  /** A ring slides from one day to another (reduced motion: it fades in there). */
  const slide = (el: HTMLElement | null, from: Box, to: Box) => {
    if (!el) return Promise.resolve();
    showRing(el, to);
    if (reducedMotion())
      return finished(
        el.animate([{ opacity: 0 }, { opacity: 1 }], MOTION.reduced),
      );
    return finished(
      el.animate([{ transform: ringAt(from) }, { transform: ringAt(to) }], {
        duration: SLIDE_MS,
        easing: EASE,
      }),
    );
  };

  /** Shows a move in the strip: the workout's ring slides, a swapped one slides back. */
  const animateMove = async (
    from: string,
    to: string,
    swapped: boolean,
    start?: { x: number },
  ) => {
    const a = boxOf(from);
    const b = boxOf(to);
    if (!a || !b) return;
    setGhosted([from, to]);
    const ring = ringRef.current;
    let main: Promise<void>;
    if (start && ring && !reducedMotion()) {
      // From the finger: spring into the day while the lift settles.
      ring.classList.remove("is-lifted");
      const spring = springValues(...SPRING.drop, start.x, b.x);
      const span = b.x - start.x || 1;
      main = finished(
        ring.animate(
          spring.values.map((x) => ({
            transform: ringAt(
              b,
              x,
              LIFT_SCALE - (LIFT_SCALE - 1) * ((x - start.x) / span),
            ),
          })),
          { duration: spring.duration, easing: "linear" },
        ),
      );
      ring.style.transform = ringAt(b);
    } else main = slide(ring, a, b);
    const other = swapped ? slide(swapRef.current, b, a) : Promise.resolve();
    await Promise.all([main, other]);
    hideRing(ringRef.current);
    hideRing(swapRef.current);
    setGhosted([]);
  };

  /** A skipped day's ring shrinks and fades; the moon fades in (CSS). */
  const animateSkip = async (date: string) => {
    const box = boxOf(date);
    const ring = ringRef.current;
    if (!box || !ring) return;
    setGhosted([date]);
    showRing(ring, box);
    await finished(
      ring.animate(
        reducedMotion()
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { transform: ringAt(box), opacity: 1 },
              { transform: ringAt(box, box.x, 0.6), opacity: 0 },
            ],
        {
          duration: reducedMotion() ? MOTION.reduced : MOTION.slot,
          easing: EASE_CURVES.out,
          fill: "forwards",
        },
      ),
    );
    hideRing(ring);
    setGhosted([]);
  };

  // ---- Changes.
  const titleOf = (cell: string | null | undefined) =>
    resolveCell(cell, names)?.title ?? "";
  const [sheet, setSheet] = useState<{ date: string; dir: -1 | 0 | 1 } | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const move = (from: string, to: string, start?: { x: number }) => {
    const live = livePlans();
    if (!canMoveTo(live, from, to, day)) return false;
    const source = plannedFor(live, from)!;
    const target = plannedFor(live, to)!;
    const swapped = isWorkoutCell(target.cell);
    const next = moveDay(planOf(source.plan), from, to);
    void commit(source.plan.id, next).catch(() => {});
    say(
      swapped
        ? t("week.swapped", {
            a: titleOf(source.cell),
            b: titleOf(target.cell),
          })
        : t("week.moved", { name: titleOf(source.cell), day: short(to) }),
    );
    void animateMove(from, to, swapped, start);
    setSheet((s) =>
      s && s.date === from ? { date: to, dir: to > from ? 1 : -1 } : s,
    );
    return true;
  };

  const skip = (date: string) => {
    const found = plannedFor(livePlans(), date);
    if (!found || !isWorkoutCell(found.cell)) return;
    const id = found.plan.id;
    const before = snapshotDay(planOf(found.plan), date);
    const name = titleOf(found.cell);
    void commit(id, skipDay(planOf(found.plan), date)).catch(() => {});
    offerUndo({
      scope: WEEK_SCOPE,
      index: 0,
      text: t("week.skipped", { name, day: short(date) }),
      undo: () => {
        const current = livePlans().find((p) => p.id === id);
        if (!current) return Promise.resolve();
        return commit(id, restoreDay(planOf(current), before));
      },
      failed: t("week.restoreFailed"),
    });
    setStatus(null);
    setSheetOpen(false);
    void animateSkip(date);
  };

  // ---- Hold and drag.
  const days = week.days;
  const dates = days.map((d) => d.date);
  const clearPress = () => {
    const p = press.current;
    if (p) window.clearTimeout(p.timer);
    press.current = null;
  };
  useEffect(
    () => () => {
      if (press.current) window.clearTimeout(press.current.timer);
    },
    [],
  );

  const placeBubble = (text: string, ringX: number, box: Box) => {
    const bubble = bubbleRef.current;
    const wrap = wrapRef.current;
    if (!bubble || !wrap) return;
    bubble.textContent = text;
    const width = bubble.offsetWidth;
    const max = wrap.clientWidth - width;
    const x = Math.min(max, Math.max(0, ringX + box.w / 2 - width / 2));
    bubble.style.transform = `translate(${x}px, ${box.y - 38}px)`;
    bubble.dataset.on = "";
  };
  const hideBubble = () => {
    if (bubbleRef.current) delete bubbleRef.current.dataset.on;
  };

  const lift = () => {
    const p = press.current;
    const ring = ringRef.current;
    if (!p || !ring) return;
    p.lifted = true;
    swallowClick.current = performance.now();
    showRing(ring, p.box);
    ring.classList.add("is-lifted");
    if (!reducedMotion()) {
      const spring = springValues(...SPRING.lift, 1, LIFT_SCALE);
      ring.animate(
        spring.values.map((s) => ({ transform: ringAt(p.box, p.box.x, s) })),
        { duration: spring.duration, easing: "linear" },
      );
    }
    ring.style.transform = ringAt(p.box, p.box.x, LIFT_SCALE);
    const entry = days.find((d) => d.date === p.date)?.entry;
    placeBubble(entry?.title ?? "", p.box.x, p.box);
    setGhosted([p.date]);
    setDrop({ from: p.date, target: null });
    navigator.vibrate?.(10);
  };

  const onDown = (date: string) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button > 0) return;
    const box = boxOf(date);
    if (!box) return;
    clearPress();
    capturePointer(event.currentTarget, event.pointerId);
    press.current = {
      date,
      pointer: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      timer: window.setTimeout(lift, LIFT_MS),
      lifted: false,
      dead: false,
      box,
      x: box.x,
      target: null,
    };
  };

  const onMove = (event: ReactPointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.pointer !== event.pointerId) return;
    const dx = event.clientX - p.x0;
    const dy = event.clientY - p.y0;
    if (!p.lifted) {
      if (Math.hypot(dx, dy) > MOVE_SLOP) {
        window.clearTimeout(p.timer);
        p.dead = true;
      }
      return;
    }
    const first = boxOf(dates[0]);
    const last = boxOf(dates[dates.length - 1]);
    if (!first || !last) return;
    p.x = Math.min(last.x, Math.max(first.x, p.box.x + dx));
    const ring = ringRef.current;
    if (ring) {
      ring.getAnimations().forEach((a) => a.cancel());
      ring.style.transform = ringAt(p.box, p.x, LIFT_SCALE);
    }
    // The nearest day under the ring's centre.
    const centre = p.x + p.box.w / 2;
    let target = dates[0];
    let best = Infinity;
    for (const date of dates) {
      const b = boxOf(date);
      if (!b) continue;
      const d = Math.abs(b.x + b.w / 2 - centre);
      if (d < best) {
        best = d;
        target = date;
      }
    }
    const live = livePlans();
    const valid = target !== p.date && canMoveTo(live, p.date, target, day);
    const nextTarget = valid ? target : null;
    if (nextTarget !== p.target) {
      p.target = nextTarget;
      setDrop({ from: p.date, target: nextTarget });
    }
    const name = days.find((d) => d.date === p.date)?.entry?.title ?? "";
    const there = plannedFor(live, target);
    const text =
      target === p.date
        ? name
        : target < day
          ? t("week.passed")
          : !valid
            ? t("week.outside")
            : isWorkoutCell(there?.cell)
              ? t("week.swapWith", { name: titleOf(there?.cell) })
              : t("week.dragTo", { name, day: short(target) });
    placeBubble(text, p.x, p.box);
  };

  const onUp = (cancel: boolean) => (event: ReactPointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.pointer !== event.pointerId) return;
    releasePointer(event.currentTarget, event.pointerId);
    clearPress();
    if (p.dead) swallowClick.current = performance.now();
    if (!p.lifted) return;
    hideBubble();
    setDrop(null);
    swallowClick.current = performance.now();
    if (!cancel && p.target && move(p.date, p.target, { x: p.x })) return;
    // Back to where it came from, like a spring.
    const ring = ringRef.current;
    if (!ring) return;
    ring.classList.remove("is-lifted");
    const back = () => {
      hideRing(ring);
      setGhosted([]);
    };
    if (reducedMotion()) return back();
    const spring = springValues(...SPRING.drop, p.x, p.box.x);
    const span = p.x - p.box.x || 1;
    void finished(
      ring.animate(
        spring.values.map((x) => ({
          transform: ringAt(
            p.box,
            x,
            1 + (LIFT_SCALE - 1) * ((x - p.box.x) / span),
          ),
        })),
        { duration: spring.duration, easing: "linear" },
      ),
    ).then(back);
    ring.style.transform = ringAt(p.box);
  };

  const onDayClick = (date: string) => (event: ReactMouseEvent) => {
    // The click after a hold, a drag or a swipe on the day is not a tap.
    if (performance.now() - swallowClick.current < 500) {
      event.preventDefault();
      return;
    }
    setSheet({ date, dir: 0 });
    setSheetOpen(true);
  };

  // ---- The day sheet.
  const sheetDate = sheet?.date ?? day;
  const sheetFound = plannedFor(plans, sheetDate);
  const sheetEntry = resolveCell(sheetFound?.cell, names);
  // A day that stops being a workout (another device, or it was skipped) closes the sheet.
  useEffect(() => {
    if (sheetOpen && !isWorkoutCell(plannedFor(livePlans(), sheetDate)?.cell))
      setSheetOpen(false);
  }, [sheetOpen, sheetDate, livePlans]);
  const sheetRoutine =
    sheetEntry?.kind === "routine"
      ? (routines.find((r) => r.id === sheetEntry.routineIds[0]) ?? null)
      : null;
  const sheetMeta = sheetRoutine
    ? routineMeta(
        sheetRoutine.payload.exercises.length,
        routineAverageMinutes(sheetRoutine.id, state.records),
      )
    : sheetEntry?.kind === "group"
      ? sheetEntry.routineIds
          .map((id) => routines.find((r) => r.id === id)?.payload.name)
          .filter(Boolean)
          .join(" · ")
      : sheetEntry
        ? t("home.typeText", {
            categories: sheetEntry.categories.map(categoryLabel).join(", "),
          })
        : "";
  const sheetPhase = sheetFound ? phaseWeek(sheetFound.plan, sheetDate) : null;
  const live = sheet ? livePlans() : plans;
  const canEarlier =
    !!sheet && canMoveTo(live, sheetDate, shiftDate(sheetDate, -1), day);
  const canLater =
    !!sheet && canMoveTo(live, sheetDate, shiftDate(sheetDate, 1), day);

  const hintId = "week-strip-hint";
  return (
    <div ref={tipRef} className="card col-12 week-card">
      <Link to="/history" className="week-card-link">
        <span className="week-card-head">
          <span className={"week-card-title" + (goalMet ? " is-met" : "")}>
            {summary}
          </span>
          <ChevronRight className="chev" size={18} aria-hidden="true" />
        </span>
        {/* Read as one link: the summary, each day, the totals, then where it goes. */}
        <span className="sr-only">
          {days
            .map(
              ({ entry, ...d }) =>
                localizedDate(d.date, { weekday: "long", day: "numeric" }) +
                (d.done ? t("home.dayDone") : "") +
                (d.today ? t("home.dayToday") : "") +
                (entry ? t("home.dayPlanned", { title: entry.title }) : ""),
            )
            .join("; ")}
          . {totalsLine}. {t("home.weekOpen")}
        </span>
      </Link>
      <div className="week-days-wrap" ref={wrapRef}>
        <span className="week" aria-hidden="true">
          {days.map((d) => (
            <span key={d.date} className="day">
              {d.label}
            </span>
          ))}
        </span>
        <span className="week week-days">
          {days.map(({ entry, skipped, ...d }) => {
            const isPlanned = entry !== null && entry.kind !== "rest";
            const movable =
              isPlanned && !d.done && canEditDay(plans, d.date, day);
            const classes = [
              ghosted.includes(d.date) && "is-ghosted",
              drop?.target === d.date && "is-drop-target",
              drop && d.date < day && "is-drop-bad",
              sheetOpen && sheet?.date === d.date && "is-selected-day",
            ]
              .filter(Boolean)
              .join(" ");
            const content = (
              <>
                {d.day}
                {skipped && (
                  <Moon className="week-moon" size={11} strokeWidth={2.4} />
                )}
              </>
            );
            if (!movable)
              return (
                <span
                  key={d.date}
                  className="day"
                  data-date={d.date}
                  aria-hidden="true"
                >
                  <DayCell
                    size="week"
                    trained={d.done}
                    today={d.today}
                    planned={isPlanned}
                    count={d.count}
                    className={classes || undefined}
                  >
                    {content}
                  </DayCell>
                </span>
              );
            return (
              <span key={d.date} className="day" data-date={d.date}>
                <DayCell
                  as="button"
                  size="week"
                  today={d.today}
                  planned
                  count={d.count}
                  className={"week-move" + (classes ? " " + classes : "")}
                  aria-label={t("week.dayLabel", {
                    day: localizedDate(d.date, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }),
                    title: entry!.title,
                  })}
                  aria-describedby={hintId}
                  aria-haspopup="dialog"
                  onPointerDown={onDown(d.date)}
                  onPointerMove={onMove}
                  onPointerUp={onUp(false)}
                  onPointerCancel={onUp(true)}
                  onLostPointerCapture={onUp(true)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={onDayClick(d.date)}
                >
                  {content}
                </DayCell>
              </span>
            );
          })}
        </span>
        <span ref={ringRef} className="week-ring" aria-hidden="true" />
        <span ref={swapRef} className="week-ring" aria-hidden="true" />
        <span ref={bubbleRef} className="week-bubble" aria-hidden="true" />
      </div>
      <p className="sr-only" id={hintId}>
        {t("week.dayHint")}
      </p>
      {undos.length ? (
        undos.map((entry) => (
          <UndoPlaceholder
            key={`u${entry.id}`}
            entry={entry}
            className="week-undo"
          />
        ))
      ) : (
        <p
          key={status ? `s${status.id}` : "totals"}
          className={"row-sub week-status" + (status ? " is-change" : "")}
          role="status"
        >
          {status?.text ?? totalsLine}
        </p>
      )}
      {sheet && (
        <DaySheet
          open={sheetOpen && !!sheetEntry}
          date={sheetDate}
          today={day}
          entry={sheetEntry}
          routine={sheetRoutine}
          phase={
            sheetPhase
              ? t("plan.weekOf", {
                  week: sheetPhase.week,
                  weeks: sheetPhase.weeks,
                })
              : null
          }
          meta={sheetMeta}
          direction={sheet.dir}
          canEarlier={canEarlier}
          canLater={canLater}
          busy={false}
          onStep={(dir) => move(sheetDate, shiftDate(sheetDate, dir))}
          onDoToday={() => move(sheetDate, day)}
          onSkip={() => skip(sheetDate)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
