import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Moon } from "lucide-react";
import type { WorkoutRecord } from "@/data/model";
import { plannedFor, REST, type PlannedDay } from "@/data/plans";
import { canEditDay, canMoveTo, isWorkoutCell } from "@/data/plan-moves";
import { isoWeek, localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { motionMs } from "@/lib/slow-motion";
import { springValues } from "@/lib/spring";
import { capturePointer, releasePointer } from "@/lib/pointer-capture";
import { goalStreak, weekStrip, weekTotals } from "@/lib/week-summary";
import { useT } from "@/i18n/useT";
import DayCell from "@/components/items/DayCell";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import { usePlanDaySheet } from "@/hooks/usePlanDaySheet";
import { reducedMotion, useUndoEntries } from "@/hooks/useMessages";
import { useTipTarget } from "@/hooks/useTipTarget";
import {
  EASE as EASE_CURVES,
  MOTION,
  SPRING,
  play,
  settled,
} from "@/lib/motion";
import {
  EDGE_HOLD_MS,
  EDGE_IDLE,
  LINGER_MS,
  allowedInWeek,
  dateInWeek,
  edgeHold,
  resistance,
  weekDates,
  weekOffsetOf,
  browseLimit,
  weekRange,
  type EdgeState,
} from "@/lib/week-nav";
import MotionList from "@/components/motion/MotionList";

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
/** The strip slides this share of its width to show another week. */
const WEEK_SLIDE_SHARE = 0.3;

const short = (date: string) =>
  localizedDate(date, { weekday: "short", day: "numeric" });

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
  /** Where the ring is drawn (at an end stop, with a little give past it). */
  x: number;
  /** Where the finger would put the ring without the end stops. */
  raw: number;
  target: string | null;
  /** The element holding the pointer: the day, then the strip once lifted. */
  captor: Element;
  edge: EdgeState;
  edgeTimer: number;
};

/** A ring's transform at a box, scaled about its centre. */
const ringAt = (box: Box, x = box.x, scale = 1) =>
  `translate(${x}px, ${box.y}px) scale(${scale})`;

/**
 * This week on Train: "Week 45 · 2 of 3 workouts", a day cell per day (done,
 * today, planned) and the totals. The head is a link to History (the card
 * around the strip too). A planned day is a button: tap opens the day sheet
 * (step it a day, do it today, skip it); press and hold until its ring lifts,
 * then drag it to another day. A busy day swaps with it. Every change is a
 * dated override on the plan. The strip follows a workout into another week
 * (a step in the sheet, or a drag held past its edge) and comes back to
 * today's week afterwards (src/lib/week-nav.ts).
 */
export default function WeekCard({ completed, goal, day, planned }: Props) {
  const { t, language } = useT();
  const tipRef = useTipTarget<HTMLDivElement>("weekStrip", { tap: true });
  // Moving and skipping, and the day sheet: shared with the Calendar tab.
  const {
    plans,
    livePlans,
    titleOf,
    move,
    skip,
    open: openSheet,
    openDate,
    sheetOpen,
    sheetNode,
  } = usePlanDaySheet({
    day,
    undoScope: WEEK_SCOPE,
    onMoved: ({ from, to, swapped, text, start }) => {
      say(text);
      // A step into another week: the strip goes there, the day keeps its ring.
      const there = weekOffsetOf(to, day);
      if (there !== shownRef.current) showWeek(there);
      else void animateMove(from, to, swapped, start);
    },
    onSkipped: (date) => {
      setStatus(null);
      void animateSkip(date);
    },
  });
  // The week the strip shows, in weeks from today's (0 most of the time).
  const [shown, setShown] = useState(0);
  // Weeks ahead opened with the head's arrows: the strip stays on them (no
  // return to today's week) until the user steps back.
  const [browsing, setBrowsing] = useState(false);
  const shownRef = useRef(0);
  const week = useMemo(() => {
    const dates = completed.map((r) => r.payload.date);
    const days = weekStrip(dates, day, shown);
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
  }, [completed, goal, day, planned, plans, language, shown]);
  const { totals } = week;
  // Another week's head counts what is planned there; this week's, the goal.
  const goalMet = shown === 0 && goal !== null && totals.workouts >= goal;
  const summary = [
    t("home.weekLabel", { week: isoWeek(dateInWeek(day, shown, 0)) }),
    shown > 0
      ? t("week.planned", {
          count: week.days.filter(
            (d) => !d.done && d.entry && d.entry.kind !== "rest",
          ).length,
        })
      : goal !== null
        ? t("home.goalProgress", { done: totals.workouts, goal })
        : countLabel(totals.workouts, "workout"),
  ].join(" · ");
  // Another week has no totals yet: its line under the strip is its dates.
  const rangeLine = (() => {
    const start = dateInWeek(day, shown, 0);
    const end = dateInWeek(day, shown, 6);
    return start.slice(0, 7) === end.slice(0, 7)
      ? `${localizedDate(start, { day: "numeric" })}–${localizedDate(end, { day: "numeric", month: "long" })}`
      : `${localizedDate(start, { day: "numeric", month: "long" })} – ${localizedDate(end, { day: "numeric", month: "long" })}`;
  })();
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
  const labelsRef = useRef<HTMLSpanElement>(null);
  const daysRef = useRef<HTMLSpanElement>(null);
  const edgeRefs = useRef<Record<-1 | 1, HTMLSpanElement | null>>({
    [-1]: null,
    1: null,
  });
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

  /**
   * A weekday's place in the strip (0 = Monday). Read from the weekday
   * letters, which never slide, so a drag keeps its geometry while the days
   * slide to another week.
   */
  const slotBox = (index: number): Box | null => {
    const wrap = wrapRef.current;
    const label = labelsRef.current?.children[index];
    const row = daysRef.current;
    const cell = row?.querySelector<HTMLElement>(".day-cell");
    if (!wrap || !label || !row || !cell) return null;
    const a = wrap.getBoundingClientRect();
    const b = label.getBoundingClientRect();
    return {
      x: b.left - a.left,
      y: row.offsetTop,
      w: b.width,
      h: cell.offsetHeight,
    };
  };
  /** A day's box in the strip, or null when the strip shows another week. */
  const boxOf = (date: string): Box | null => {
    const index = weekDates(day, shownRef.current).indexOf(date);
    return index < 0 ? null : slotBox(index);
  };

  // ---- Another week: the days slide over, the head and a live region follow.
  const [heard, setHeard] = useState("");
  const outgoing = useRef<{ node: HTMLElement; dir: 1 | -1 } | null>(null);
  const leaving = useRef<HTMLElement | null>(null);
  /** Shows the week `next` weeks from today's: the days there slide in from its side. */
  const showWeek = useCallback(
    (next: number) => {
      const from = shownRef.current;
      if (next === from) return;
      const row = daysRef.current;
      if (row) {
        // A copy of the days leaving, played out on top of the new ones.
        const node = row.cloneNode(true) as HTMLElement;
        node.querySelectorAll("[data-date]").forEach((el) => {
          el.removeAttribute("data-date");
        });
        outgoing.current = { node, dir: next > from ? 1 : -1 };
      }
      shownRef.current = next;
      setShown(next);
      setHeard(t("week.showing", { week: isoWeek(dateInWeek(day, next, 0)) }));
    },
    [day, t],
  );
  useLayoutEffect(() => {
    const out = outgoing.current;
    const row = daysRef.current;
    const wrap = wrapRef.current;
    outgoing.current = null;
    if (!out || !row || !wrap) return;
    leaving.current?.remove();
    const { node, dir } = out;
    node.classList.add("week-days-out");
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("inert", "");
    node.style.top = `${row.offsetTop}px`;
    row.after(node);
    leaving.current = node;
    const dx = Math.round(row.offsetWidth * WEEK_SLIDE_SHARE);
    const timing = { duration: MOTION.weekSlide, easing: EASE };
    row.getAnimations().forEach((a) => a.cancel());
    play(
      row,
      [
        { transform: `translateX(${dir * dx}px)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      timing,
    );
    void settled(
      play(
        node,
        [
          { transform: "none", opacity: 1 },
          { transform: `translateX(${-dir * dx}px)`, opacity: 0 },
        ],
        { ...timing, fill: "forwards" },
      ),
    ).then(() => {
      node.remove();
      if (leaving.current === node) leaving.current = null;
    });
  }, [shown]);
  useEffect(() => () => leaving.current?.remove(), []);
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

  /**
   * A ring slides from one day to another (reduced motion, or from a day of
   * another week: it fades in there).
   */
  const slide = (el: HTMLElement | null, from: Box | null, to: Box) => {
    if (!el) return Promise.resolve();
    showRing(el, to);
    if (!from || reducedMotion())
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
    if (!b) return;
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
    // A swapped workout goes back to a day of another week: its ring fades there.
    const other = !swapped
      ? Promise.resolve()
      : a
        ? slide(swapRef.current, b, a)
        : fadeOut(swapRef.current, b);
    await Promise.all([main, other]);
    hideRing(ringRef.current);
    hideRing(swapRef.current);
    setGhosted([]);
  };

  /** A ring fades out where it is. */
  const fadeOut = (el: HTMLElement | null, box: Box) => {
    if (!el) return Promise.resolve();
    showRing(el, box);
    return finished(
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: reducedMotion() ? MOTION.reduced : SLIDE_MS,
        easing: EASE,
        fill: "forwards",
      }),
    );
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

  // ---- Hold and drag.
  const days = week.days;
  const clearPress = () => {
    const p = press.current;
    if (p) {
      window.clearTimeout(p.timer);
      window.clearTimeout(p.edgeTimer);
    }
    press.current = null;
  };
  useEffect(
    () => () => {
      const p = press.current;
      if (p) {
        window.clearTimeout(p.timer);
        window.clearTimeout(p.edgeTimer);
      }
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

  /** The edge the finger holds glows, and fills over the hold (from `since`). */
  const showEdge = (next: EdgeState, prev: EdgeState) => {
    for (const side of [-1, 1] as const) {
      const el = edgeRefs.current[side];
      if (!el) continue;
      const fill = el.firstElementChild;
      if (next.side !== side) {
        if (el.dataset.on === undefined) continue;
        delete el.dataset.on;
        fill?.getAnimations().forEach((a) => a.cancel());
        continue;
      }
      if (prev.side === side && prev.since === next.since) continue;
      el.dataset.on = "";
      fill?.getAnimations().forEach((a) => a.cancel());
      // Progress, not decoration: it fills under reduced motion too.
      play(fill, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
        duration: EDGE_HOLD_MS,
        easing: "linear",
        fill: "forwards",
        keep: true,
      });
    }
  };

  const lift = () => {
    const p = press.current;
    const ring = ringRef.current;
    if (!p || !ring) return;
    p.lifted = true;
    swallowClick.current = performance.now();
    // The strip holds the pointer from here, so the drag lives on while the
    // days slide to another week (the day it started on may leave).
    const wrap = wrapRef.current;
    if (wrap) {
      p.captor = wrap;
      capturePointer(wrap, p.pointer);
    }
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
      raw: box.x,
      target: null,
      captor: event.currentTarget,
      edge: EDGE_IDLE,
      edgeTimer: 0,
    };
  };

  /**
   * The lifted ring follows the finger between the first and last day (a
   * little give past them); pushed past an edge and held, the strip steps a
   * week. The drop target is the day under the ring in the week shown.
   */
  const track = (p: Press) => {
    const first = slotBox(0);
    const last = slotBox(6);
    if (!first || !last) return;
    const side = p.raw > last.x ? 1 : p.raw < first.x ? -1 : 0;
    const over = side > 0 ? p.raw - last.x : side < 0 ? first.x - p.raw : 0;
    p.x =
      side > 0
        ? last.x + resistance(over)
        : side < 0
          ? first.x - resistance(over)
          : p.raw;
    const ring = ringRef.current;
    if (ring) {
      ring.getAnimations().forEach((a) => a.cancel());
      ring.style.transform = ringAt(p.box, p.x, LIFT_SCALE);
    }
    const live = livePlans();
    const range = weekRange(live, p.date, day);
    const offset = shownRef.current;
    const holdMs = motionMs(EDGE_HOLD_MS);
    const edge = edgeHold(
      p.edge,
      {
        side,
        over,
        zone: p.box.w / 2,
        canStep:
          !!range && offset + side >= range.min && offset + side <= range.max,
        now: performance.now(),
      },
      holdMs,
    );
    showEdge(edge.state, p.edge);
    p.edge = edge.state;
    window.clearTimeout(p.edgeTimer);
    if (edge.wait !== null)
      p.edgeTimer = window.setTimeout(() => {
        if (press.current === p) track(p);
      }, edge.wait + 4);
    if (edge.step) {
      showWeek(offset + edge.step);
      navigator.vibrate?.(8);
    }
    // The nearest day under the ring's centre, in the week shown now.
    const dates = weekDates(day, shownRef.current);
    const centre = p.x + p.box.w / 2;
    let index = 0;
    let best = Infinity;
    for (let i = 0; i < dates.length; i++) {
      const b = slotBox(i);
      if (!b) continue;
      const d = Math.abs(b.x + b.w / 2 - centre);
      if (d < best) {
        best = d;
        index = i;
      }
    }
    const target = dates[index];
    const valid = target !== p.date && canMoveTo(live, p.date, target, day);
    const nextTarget = valid ? target : null;
    if (nextTarget !== p.target || edge.step) {
      p.target = nextTarget;
      setDrop({ from: p.date, target: nextTarget });
    }
    const name = titleOf(plannedFor(live, p.date)?.cell);
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
    p.raw = p.box.x + dx;
    track(p);
  };

  const onUp = (cancel: boolean) => (event: ReactPointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.pointer !== event.pointerId) return;
    // Handing the pointer from the day to the strip is not the end.
    if (event.type === "lostpointercapture" && event.target !== p.captor)
      return;
    releasePointer(p.captor, event.pointerId);
    clearPress();
    if (p.dead) swallowClick.current = performance.now();
    if (!p.lifted) return;
    hideBubble();
    showEdge(EDGE_IDLE, p.edge);
    setDrop(null);
    swallowClick.current = performance.now();
    if (!cancel && p.target && move(p.date, p.target, { x: p.x })) return;
    // Back to where it came from, like a spring (and its week with it).
    const home = weekOffsetOf(p.date, day);
    if (home !== shownRef.current) showWeek(home);
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

  // Shown another week, the strip stays a moment once the sheet has closed or
  // the day is dropped, so the move can be seen, then goes back to today's.
  useEffect(() => {
    if (shown === 0 || sheetOpen || drop || browsing) return;
    let timer = 0;
    const wait = () => {
      timer = window.setTimeout(
        () => (press.current ? wait() : showWeek(0)),
        motionMs(LINGER_MS),
      );
    };
    wait();
    return () => window.clearTimeout(timer);
  }, [shown, sheetOpen, drop, browsing, showWeek]);

  // Back on today's week by any path, the strip follows moves again.
  useEffect(() => {
    if (shown === 0 && browsing) setBrowsing(false);
  }, [shown, browsing]);
  // The head's arrows: the next week, as far as a plan reaches, and back.
  const lastWeek = browseLimit(plans, day);
  const browse = (step: 1 | -1) => {
    const next = Math.max(0, Math.min(lastWeek, shownRef.current + step));
    setBrowsing(next > 0);
    showWeek(next);
  };

  const onDayClick = (date: string) => (event: ReactMouseEvent) => {
    // The click after a hold, a drag or a swipe on the day is not a tap.
    if (performance.now() - swallowClick.current < 500) {
      event.preventDefault();
      return;
    }
    openSheet(date);
  };

  // While a day is lifted, the days it cannot go to are dimmed.
  const allowed = drop ? allowedInWeek(livePlans(), drop.from, day, shown) : [];

  const hintId = "week-strip-hint";
  return (
    <div ref={tipRef} className="card col-12 week-card">
      <div className="week-card-head">
        <Link to="/history" className="week-card-link">
          <span className={"week-card-title" + (goalMet ? " is-met" : "")}>
            {summary}
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
            . {shown === 0 ? totalsLine : rangeLine}. {t("home.weekOpen")}
          </span>
        </Link>
        {/* Above the card's link: they browse the weeks here, not History. */}
        <span className="week-nav">
          {shown > 0 && (
            <button
              type="button"
              className="week-nav-btn"
              aria-label={t("week.previous")}
              onClick={() => browse(-1)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          )}
          {lastWeek > 0 && (
            <button
              type="button"
              className="week-nav-btn"
              aria-label={t("week.next")}
              disabled={shown >= lastWeek}
              onClick={() => browse(1)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      {/* The strip holds a lifted day's pointer, so its moves, drop and cancel
          are heard here, also while the days slide to another week. */}
      <div
        className="week-days-wrap"
        ref={wrapRef}
        onPointerMove={onMove}
        onPointerUp={onUp(false)}
        onPointerCancel={onUp(true)}
        onLostPointerCapture={onUp(true)}
      >
        <span className="week" aria-hidden="true" ref={labelsRef}>
          {days.map((d) => (
            <span key={d.date} className="day">
              {d.label}
            </span>
          ))}
        </span>
        <span className="week week-days" ref={daysRef}>
          {days.map(({ entry, skipped, ...d }) => {
            const isPlanned = entry !== null && entry.kind !== "rest";
            const movable =
              isPlanned && !d.done && canEditDay(plans, d.date, day);
            const classes = [
              ghosted.includes(d.date) && "is-ghosted",
              drop?.target === d.date && "is-drop-target",
              drop &&
                d.date !== drop.from &&
                !allowed.includes(d.date) &&
                "is-drop-bad",
              openDate === d.date && "is-selected-day",
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
        {([-1, 1] as const).map((side) => (
          <span
            key={side}
            ref={(el) => {
              edgeRefs.current[side] = el;
            }}
            className="week-edge"
            data-side={side < 0 ? "start" : "end"}
            aria-hidden="true"
          >
            <span className="week-edge-fill" />
            {side < 0 ? (
              <ChevronLeft size={14} strokeWidth={2.6} />
            ) : (
              <ChevronRight size={14} strokeWidth={2.6} />
            )}
          </span>
        ))}
      </div>
      <p className="sr-only" id={hintId}>
        {t("week.dayHint")}
      </p>
      <p className="sr-only" aria-live="polite">
        {heard}
      </p>
      {/* The line under the strip and the Undo slot that takes its place
          share the banner motion: one grows or shrinks into the other. */}
      <MotionList className="week-foot" kind="banner">
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
            {status?.text ?? (shown === 0 ? totalsLine : rangeLine)}
          </p>
        )}
      </MotionList>
      {sheetNode}
    </div>
  );
}
