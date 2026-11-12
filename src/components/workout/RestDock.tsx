import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { useRestTimer } from "@/hooks/useRestTimer";
import { useT } from "@/i18n/useT";
import { EASE, MOTION, SPRING, play, playSpring, settled } from "@/lib/motion";
import {
  clock,
  dockPhase,
  pulses,
  restFill,
  restSecondsLeft,
  skipsRest,
  type DockPhase,
} from "@/lib/rest-dock";
import { playRestSound } from "@/lib/rest-sound";
import { motionMs } from "@/lib/slow-motion";

/** The next set to do, as the dock names it. */
export type DockNext = {
  setId: string;
  /** "set 3" */
  title: string;
  /** "set 3 · 87.5 kg × 5", with the exercise when it is another one. */
  label: string;
};

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The rest dock at the foot of a live workout (mockup v5, B1). It sits in
 * its own space under the page (WorkoutDock), so it never covers a set. While
 * resting its whole background is the time left, emptying to the left; a tap
 * on the time adds 15 s, a swipe down skips, and the last 3 s pulse. When the
 * rest runs out it turns green with two pulses and a short tone, then leaves
 * after 4 s. Once every set is checked it is a large Finish workout button.
 * In: 24 px up and a fade, 240 ms; out: 40 px down, 200 ms. Reduced motion:
 * fades, and the fill stays (it is information).
 */
export default function RestDock({
  rest,
  allChecked,
  next,
  totalSets,
  minutes,
  finishDisabled,
  onFinish,
}: {
  rest: ReturnType<typeof useRestTimer>;
  allChecked: boolean;
  next: DockNext | null;
  totalSets: number;
  /** How long the workout has run: "31 min". */
  minutes: string;
  finishDisabled: boolean;
  onFinish: () => void;
}) {
  const { t } = useT();
  const phase = dockPhase({
    live: true,
    allChecked,
    restEnd: rest.end,
    doneAt: rest.doneAt,
    now: Date.now(),
    // useRestTimer clears doneAt when "Rest done" has had its time.
    doneMs: Infinity,
  });
  const [shown, setShown] = useState<DockPhase>(phase);
  if (phase !== "hidden" && shown !== phase) setShown(phase);
  const leaving = phase === "hidden" && shown !== "hidden";
  // What the dock says while it leaves, after the rest has gone.
  const [sec, setSec] = useState(() =>
    rest.end ? restSecondsLeft(rest.end, Date.now()) : 0,
  );
  const lastNext = useRef(next);
  if (next) lastNext.current = next;
  const nextShown = next ?? (leaving ? lastNext.current : null);

  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const value = useRef<HTMLSpanElement>(null);
  const drag = useRef<{
    y0: number;
    t0: number;
    dy: number;
    moving: boolean;
    id: number;
  } | null>(null);
  const dropFrom = useRef(0);
  const swallowClick = useRef(false);

  // In, swap and out.
  const before = useRef<DockPhase>("hidden");
  useLayoutEffect(() => {
    const was = before.current;
    before.current = leaving ? "hidden" : shown;
    const el = root.current;
    if (leaving) {
      const from = dropFrom.current;
      dropFrom.current = 0;
      if (el) el.style.transform = "";
      const out = play(
        el,
        [
          { transform: `translateY(${from}px)`, opacity: 1 },
          { transform: "translateY(40px)", opacity: 0 },
        ],
        { duration: MOTION.dockOut, easing: EASE.in, fill: "forwards" },
      );
      void settled(out).then(() =>
        setShown((s) => (s === shown ? "hidden" : s)),
      );
      return;
    }
    if (shown === "hidden" || was === shown || !el) return;
    if (was === "hidden") {
      play(
        el,
        [
          { transform: "translateY(24px)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: MOTION.dockIn, easing: EASE.out },
      );
      // The dock took its space under the page: make sure it did not take
      // the next set's place on screen.
      const timer = window.setTimeout(
        () => {
          const row = next
            ? document.querySelector(
                `[data-set-id="${CSS.escape(next.setId)}"]`,
              )
            : null;
          if (!row || !root.current) return;
          const bottom = row.getBoundingClientRect().bottom;
          const top = root.current.getBoundingClientRect().top;
          if (bottom > top - 8)
            window.scrollBy({
              top: bottom - top + 12,
              behavior: reduced() ? "auto" : "smooth",
            });
        },
        motionMs(MOTION.dockIn + 20),
      );
      return () => window.clearTimeout(timer);
    }
    if (shown === "done") {
      // Rest done: two pulses and, if wanted, a short tone.
      play(
        value.current,
        [
          { transform: "scale(1)" },
          { transform: "scale(1.06)" },
          { transform: "scale(1)" },
          { transform: "scale(1.06)" },
          { transform: "scale(1)" },
        ],
        { duration: MOTION.pulse * 2 },
      );
      if (
        rest.preferences.restSound &&
        rest.doneAt !== null &&
        Date.now() - rest.doneAt < 2000
      )
        playRestSound();
      return;
    }
    play(
      el.querySelector(".rest-dock-body"),
      [{ opacity: 0.2 }, { opacity: 1 }],
      {
        duration: MOTION.dockSwap,
      },
    );
    // Only phase changes animate; the rest values are read when they happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, leaving]);

  // The fill empties every frame; the seconds change once a second.
  const end = rest.end;
  const total = rest.total;
  useEffect(() => {
    if (shown !== "rest" || !end) return;
    let frame = 0;
    const tick = () => {
      const now = Date.now();
      if (fill.current)
        fill.current.style.transform = `scaleX(${restFill(end, total, now)})`;
      setSec(restSecondsLeft(end, now));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [shown, end, total]);
  // The last three seconds pulse, once each.
  useLayoutEffect(() => {
    if (shown === "rest" && pulses(sec))
      play(
        value.current,
        [
          { transform: "scale(1)" },
          { transform: "scale(1.04)" },
          { transform: "scale(1)" },
        ],
        { duration: MOTION.pulse },
      );
  }, [sec, shown]);

  if (shown === "hidden") return null;

  const extend = () => {
    rest.extend();
    play(
      value.current,
      [
        { transform: "scale(1)" },
        { transform: "scale(1.1)" },
        { transform: "scale(1)" },
      ],
      { duration: MOTION.pop },
    );
  };

  // A swipe down skips the rest; short of it the dock springs back.
  const resting = shown === "rest" || shown === "done";
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resting || leaving || !event.isPrimary) return;
    drag.current = {
      y0: event.clientY,
      t0: event.timeStamp,
      dy: 0,
      moving: false,
      id: event.pointerId,
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    d.dy = Math.max(0, event.clientY - d.y0);
    if (!d.moving && d.dy > 6) {
      d.moving = true;
      try {
        root.current?.setPointerCapture(event.pointerId);
      } catch {
        // The drag still follows without capture.
      }
    }
    if (d.moving && root.current)
      root.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (!d.moving) return;
    swallowClick.current = true;
    window.setTimeout(() => (swallowClick.current = false), 60);
    const velocity = d.dy / Math.max(1, event.timeStamp - d.t0);
    if (event.type === "pointerup" && skipsRest(d.dy, velocity)) {
      dropFrom.current = d.dy;
      rest.skip();
      return;
    }
    if (root.current) root.current.style.transform = "";
    playSpring(root.current, SPRING.settle, d.dy, 0, (y) => ({
      transform: `translateY(${y}px)`,
    }));
  };

  return (
    <div
      ref={root}
      className="rest-dock"
      data-phase={shown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {resting && (
        <span ref={fill} className="rest-dock-fill" aria-hidden="true" />
      )}
      <div className="rest-dock-body">
        {shown === "finish" ? (
          <>
            <button
              type="button"
              className="btn-primary rest-dock-finish"
              disabled={finishDisabled}
              onClick={onFinish}
            >
              {t("workout.finishWorkout")}
            </button>
            <p className="rest-dock-next is-centred">
              {t("workout.allDone", { n: totalSets, time: minutes })}
            </p>
          </>
        ) : (
          <>
            <div className="rest-dock-row">
              {shown === "rest" ? (
                <button
                  type="button"
                  className="rest-dock-time"
                  aria-label={t("workout.restAdd", { time: clock(sec) })}
                  onClick={extend}
                >
                  <span className="rest-dock-text">
                    <span className="rest-dock-label">{t("workout.rest")}</span>
                    <span ref={value} className="rest-dock-value">
                      {clock(sec)}
                    </span>
                  </span>
                  <span className="rest-dock-plus" aria-hidden="true">
                    {t("workout.plus15")}
                  </span>
                </button>
              ) : (
                <div className="rest-dock-time" role="status">
                  <span className="rest-dock-text">
                    {nextShown && (
                      <span className="rest-dock-label">
                        {t("workout.timeFor", { set: nextShown.title })}
                      </span>
                    )}
                    <span ref={value} className="rest-dock-value">
                      {t("workout.restDone")}
                    </span>
                  </span>
                </div>
              )}
              <button
                type="button"
                className="rest-dock-skip"
                onClick={rest.skip}
              >
                {shown === "rest" ? t("workout.skip") : t("workout.dismiss")}
              </button>
            </div>
            {nextShown && (
              <p className="rest-dock-next">
                {t("workout.restNext")} <b>{nextShown.label}</b>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
