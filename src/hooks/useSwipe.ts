import { useCallback, useEffect, useRef, useState } from "react";
import {
  decideAxis,
  displayOffset,
  isArmed,
  resistedOffset,
  settle,
  swipeProgress,
  type Settle,
  type SwipeConfig,
} from "@/lib/swipe";
import { capturePointer, releasePointer } from "@/lib/pointer-capture";
import { setTipBlocker, tipUsed } from "@/lib/tip-store";
import type { TipId } from "@/lib/tips";
import { motionMs } from "@/lib/slow-motion";
import { reducedMotion } from "@/hooks/useMessages";
import { EASE, MOTION } from "@/lib/motion";

/**
 * The one swipe for boxed items (routine cards, workouts in History's week
 * boxes, set rows), on pointer events. The item has `touch-action: pan-y`, so
 * the browser keeps vertical scrolling and nothing here calls preventDefault:
 * a drag that is not clearly sideways is left to the scroll, and a scroll
 * that starts cancels the pointer. Sideways, the front follows the finger
 * with resistance past its travel, snaps a little at the threshold, and on
 * release springs back, stays open on its buttons, or commits.
 *
 * Moves write the transform straight to the DOM; React renders only when a
 * side opens or closes. Settling uses Web Animations, so slow motion slows it
 * and reduced motion skips it. The maths is src/lib/swipe.ts.
 */

export type SwipeSideName = "left" | "right";

type Gesture = {
  id: number;
  x0: number;
  y0: number;
  base: number;
  axis: "pending" | "x" | "y";
  offset: number;
  armed: boolean;
  /** Recent positions, for the release speed. */
  samples: { x: number; t: number }[];
  config: SwipeConfig;
};

/** The speed (px/ms) over the last VELOCITY_WINDOW ms before `at`: 0 after a pause. */
const VELOCITY_WINDOW = 80;
function releaseVelocity(samples: { x: number; t: number }[], at: number) {
  const recent = samples.filter((s) => at - s.t <= VELOCITY_WINDOW);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  return (last.x - first.x) / Math.max(1, last.t - first.t);
}

export type SwipeOptions = {
  /** The sides for an item this wide; read when a drag starts. */
  config: (width: number) => SwipeConfig;
  disabled?: boolean;
  /** The tip this swipe answers; a swipe marks it used. */
  tip?: TipId;
  /** Every drawn frame of a drag: offset, progress 0–1 and armed. */
  onDrag?: (offset: number, progress: number, armed: boolean) => void;
  /** The side under the item armed or disarmed (the pop and ring). */
  onArm?: (armed: boolean, side: SwipeSideName) => void;
  /**
   * A release past a commit side's threshold. Return true when the caller
   * plays its own exit (the set's bubble); otherwise the item springs back.
   */
  onCommit?: (side: SwipeSideName) => boolean | void;
  /** Any release, before its animation: for visuals that follow it. */
  onSettle?: (result: Settle) => void;
};

// One item open at a time: opening another, or touching outside, closes it.
let openItem: { root: HTMLElement; close: () => void } | null = null;
function closeOpenItem(except?: HTMLElement) {
  if (openItem && openItem.root !== except) openItem.close();
}
if (typeof document !== "undefined")
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (openItem && !openItem.root.contains(event.target as Node))
        openItem.close();
    },
    true,
  );

const SPRING = EASE.swipe;
const SWALLOW_CLICK_MS = 400;

export function useSwipe(options: SwipeOptions) {
  const root = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const opts = useRef(options);
  opts.current = options;
  const [open, setOpen] = useState<SwipeSideName | null>(null);
  const drawn = useRef(0);
  const animation = useRef<Animation | null>(null);
  const swallowUntil = useRef(0);
  const openRef = useRef<SwipeSideName | null>(null);

  const draw = useCallback((x: number) => {
    drawn.current = x;
    const el = front.current;
    if (el) el.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
    const box = root.current;
    if (box) box.dataset.side = x < 0 ? "left" : x > 0 ? "right" : "";
  }, []);

  /** Moves the front to `x` on a spring (or at once with reduced motion). */
  const animateTo = useCallback(
    (x: number, duration: number = MOTION.settle, easing: string = SPRING) => {
      const el = front.current;
      const from = drawn.current;
      animation.current?.cancel();
      animation.current = null;
      if (
        !el ||
        from === x ||
        reducedMotion() ||
        typeof el.animate !== "function"
      ) {
        draw(x);
        if (!x && root.current) root.current.dataset.side = "";
        return Promise.resolve();
      }
      draw(x);
      // The side stays shown while the front travels back over it.
      if (!x && root.current)
        root.current.dataset.side = from < 0 ? "left" : "right";
      const run = el.animate(
        [
          { transform: `translate3d(${from}px, 0, 0)` },
          {
            transform: x ? `translate3d(${x}px, 0, 0)` : "translate3d(0, 0, 0)",
          },
        ],
        { duration, easing },
      );
      animation.current = run;
      return run.finished.then(
        () => {
          if (animation.current === run) animation.current = null;
          if (!drawn.current && root.current) root.current.dataset.side = "";
        },
        () => {},
      );
    },
    [draw],
  );

  const setOpenSide = useCallback((side: SwipeSideName | null) => {
    openRef.current = side;
    setOpen(side);
    const box = root.current;
    if (side && box) {
      closeOpenItem(box);
      openItem = { root: box, close: () => close() };
    } else if (openItem?.root === box) openItem = null;
    // `close` is defined below and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (openRef.current) setOpenSide(null);
    void animateTo(0);
  }, [animateTo, setOpenSide]);

  useEffect(() => {
    const box = root.current;
    if (!box) return;
    let g: Gesture | null = null;

    const end = () => {
      const current = g;
      // Cleared first: releasing the capture fires lostpointercapture.
      g = null;
      if (current?.axis === "x") {
        setTipBlocker("drag", false);
        box.classList.remove("is-swiping");
        releasePointer(box, current.id);
      }
    };

    const finish = (result: Settle) => {
      const o = opts.current;
      o.onSettle?.(result);
      if (result.action === "commit") {
        if (o.tip) tipUsed(o.tip);
        setOpenSide(null);
        const custom = o.onCommit?.(result.side) === true;
        if (!custom) void animateTo(0);
      } else if (result.action === "open") {
        if (o.tip) tipUsed(o.tip);
        setOpenSide(result.side);
        void animateTo(result.offset, MOTION.open, EASE.swipeOpen);
      } else {
        setOpenSide(null);
        void animateTo(0);
      }
    };

    const down = (event: PointerEvent) => {
      if (opts.current.disabled || !event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      closeOpenItem(box);
      g = {
        id: event.pointerId,
        x0: event.clientX,
        y0: event.clientY,
        base: openRef.current ? drawn.current : 0,
        axis: "pending",
        offset: drawn.current,
        armed: false,
        samples: [{ x: event.clientX, t: event.timeStamp }],
        config: opts.current.config(box.getBoundingClientRect().width),
      };
    };

    const move = (event: PointerEvent) => {
      if (!g || event.pointerId !== g.id) return;
      const dx = event.clientX - g.x0;
      const dy = event.clientY - g.y0;
      if (g.axis === "pending") {
        g.axis = decideAxis(dx, dy);
        if (g.axis === "y") {
          // A scroll: the browser has it.
          g = null;
          return;
        }
        if (g.axis !== "x") return;
        animation.current?.cancel();
        animation.current = null;
        capturePointer(box, g.id);
        box.classList.add("is-swiping");
        setTipBlocker("drag", true);
      }
      g.samples.push({ x: event.clientX, t: event.timeStamp });
      if (g.samples.length > 12) g.samples.shift();
      g.offset = resistedOffset(g.base + dx, g.config);
      const armed = isArmed(g.offset, g.config, g.armed);
      if (armed !== g.armed) {
        g.armed = armed;
        opts.current.onArm?.(armed, g.offset < 0 ? "left" : "right");
      }
      const x = displayOffset(g.offset, g.config, armed);
      draw(x);
      opts.current.onDrag?.(x, swipeProgress(g.offset, g.config), armed);
    };

    const up = (event: PointerEvent) => {
      if (!g || event.pointerId !== g.id) return;
      const gesture = g;
      end();
      if (gesture.axis !== "x") return;
      swallowUntil.current = performance.now() + SWALLOW_CLICK_MS;
      finish(
        settle(
          gesture.offset,
          releaseVelocity(gesture.samples, event.timeStamp),
          gesture.config,
        ),
      );
    };

    const cancel = (event: PointerEvent) => {
      if (!g || event.pointerId !== g.id) return;
      // Taking the capture from the touched child fires its own
      // lostpointercapture, which bubbles here: only the box's counts.
      if (event.type === "lostpointercapture" && event.target !== box) return;
      const swiping = g.axis === "x";
      end();
      if (swiping) finish({ action: "close" });
    };

    // The click after a swipe is not a tap; a tap on an open item closes it.
    const click = (event: MouseEvent) => {
      const swallow = performance.now() < swallowUntil.current;
      const onFront = front.current?.contains(event.target as Node);
      if (swallow || (openRef.current && onFront)) {
        event.preventDefault();
        event.stopPropagation();
        if (!swallow) close();
      }
    };

    box.addEventListener("pointerdown", down);
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", cancel);
    box.addEventListener("lostpointercapture", cancel);
    box.addEventListener("click", click, true);
    return () => {
      box.removeEventListener("pointerdown", down);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", cancel);
      box.removeEventListener("lostpointercapture", cancel);
      box.removeEventListener("click", click, true);
      if (g?.axis === "x") setTipBlocker("drag", false);
      if (openItem?.root === box) openItem = null;
    };
  }, [animateTo, close, draw, setOpenSide]);

  return {
    rootRef: root,
    frontRef: front,
    /** The side whose buttons show, or null. */
    open,
    close,
    animateTo,
    /** The front's drawn offset now. */
    offset: () => drawn.current,
  };
}

/** A timer for something visual, stretched by slow motion. */
export const visualDelay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, motionMs(ms)));
