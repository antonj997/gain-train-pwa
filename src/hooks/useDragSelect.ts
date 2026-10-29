import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { LONG_PRESS_MS, LONG_PRESS_SLOP } from "@/lib/drag-selection";
import { edgeScrollDelta } from "@/lib/set-editing";

export type DragRange = { start: string; current: string };

/** The date of the cell (an element with data-date) under a screen point. */
function dateAt(x: number, y: number) {
  const node = document.elementFromPoint(x, y);
  return node?.closest<HTMLElement>("[data-date]")?.dataset.date ?? null;
}

type Press = {
  /** Touch identifier, or the pointer id for mouse and pen. */
  id: number;
  x: number;
  y: number;
  start: string;
  timer: number;
};

const SWALLOW_CLICK_MS = 400;

/**
 * Press and hold a cell, then drag to select dates. Nothing happens until the
 * finger or pointer has stayed within a few px for LONG_PRESS_MS, so taps and
 * swipes behave as before. Once armed, scrolling is blocked until release;
 * release commits, Escape, touch cancel, blur or a hidden page aborts. Near
 * the left or right edge of `scroller` the grid scrolls so the drag can reach
 * further.
 *
 * Touch uses Touch Events (native, non-passive listeners on the container):
 * iOS Safari cancels pointer streams on a long press, so pointer events are
 * kept for mouse and pen only. The finger is followed with elementFromPoint,
 * never pointer capture. The click that trails an armed gesture is swallowed.
 */
export function useDragSelect({
  containerRef,
  scrollerRef,
  onCommit,
}: {
  containerRef: RefObject<HTMLElement>;
  scrollerRef?: RefObject<HTMLElement>;
  onCommit: (drag: DragRange) => void;
}) {
  const [drag, setDrag] = useState<DragRange | null>(null);
  const pending = useRef<Press | null>(null);
  const live = useRef<(DragRange & { id: number; touch: boolean }) | null>(
    null,
  );
  const point = useRef({ x: 0, y: 0 });
  const swallowClick = useRef(false);
  const swallowTimer = useRef(0);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });

  const clearPending = useCallback(() => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
  }, []);

  /** Ends any gesture; `save` commits the live range. Safe to call anytime. */
  const finish = useCallback(
    (save: boolean) => {
      clearPending();
      const current = live.current;
      live.current = null;
      setDrag(null);
      if (!current) return;
      if (!current.touch) {
        try {
          containerRef.current?.releasePointerCapture(current.id);
        } catch {
          // The pointer is already gone.
        }
      }
      swallowClick.current = true;
      window.clearTimeout(swallowTimer.current);
      swallowTimer.current = window.setTimeout(() => {
        swallowClick.current = false;
      }, SWALLOW_CLICK_MS);
      if (save)
        commit.current({ start: current.start, current: current.current });
    },
    [clearPending, containerRef],
  );

  const moveTo = (x: number, y: number) => {
    point.current = { x, y };
    const current = live.current;
    if (!current) return;
    const date = dateAt(x, y);
    if (date && date !== current.current) {
      current.current = date;
      setDrag({ start: current.start, current: date });
    }
  };

  const arm = (press: Press, touch: boolean, target?: HTMLElement) => {
    pending.current = null;
    live.current = {
      id: press.id,
      start: press.start,
      current: press.start,
      touch,
    };
    if (!touch) {
      try {
        target?.setPointerCapture(press.id);
      } catch {
        // Capture is a nicety for the mouse only.
      }
    }
    navigator.vibrate?.(10);
    setDrag({ start: press.start, current: press.start });
  };

  // Touch Events, as native non-passive listeners on the grid container. The
  // container may mount after this hook (the month grid does), so re-attach
  // on any render that finds a new node. The handlers read refs only.
  const touchHandlers = useRef({
    start: (event: TouchEvent) => {
      clearPending();
      swallowClick.current = false;
      if (live.current) return;
      if (event.touches.length !== 1) return;
      const touch = event.changedTouches[0];
      const start = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-date]",
      )?.dataset.date;
      if (!start) return;
      point.current = { x: touch.clientX, y: touch.clientY };
      const press: Press = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        start,
        timer: 0,
      };
      press.timer = window.setTimeout(() => arm(press, true), LONG_PRESS_MS);
      pending.current = press;
    },
    move: (event: TouchEvent) => {
      const p = pending.current;
      const live_ = live.current;
      const touch = Array.from(event.changedTouches).find(
        (t) => t.identifier === (live_?.id ?? p?.id),
      );
      if (!touch) return;
      if (live_) {
        // Armed: the page and grid must not scroll.
        if (event.cancelable) event.preventDefault();
        moveTo(touch.clientX, touch.clientY);
      } else if (
        p &&
        Math.hypot(touch.clientX - p.x, touch.clientY - p.y) > LONG_PRESS_SLOP
      )
        clearPending();
    },
    end: (event: TouchEvent) => {
      const live_ = live.current;
      if (!live_) {
        clearPending();
        return;
      }
      const touch = Array.from(event.changedTouches).find(
        (t) => t.identifier === live_.id,
      );
      if (!touch) return;
      // Stop the synthetic click; the swallow flag is the backup.
      if (event.cancelable) event.preventDefault();
      moveTo(touch.clientX, touch.clientY);
      finish(true);
    },
    cancel: () => finish(false),
  });
  const attached = useRef<HTMLElement | null>(null);
  const detach = useRef(() => {});
  useEffect(() => {
    const node = containerRef.current;
    if (node === attached.current) return;
    detach.current();
    attached.current = node;
    if (!node) {
      detach.current = () => {};
      return;
    }
    const h = touchHandlers.current;
    const options = { passive: false } as const;
    node.addEventListener("touchstart", h.start, options);
    node.addEventListener("touchmove", h.move, options);
    node.addEventListener("touchend", h.end, options);
    node.addEventListener("touchcancel", h.cancel, options);
    detach.current = () => {
      node.removeEventListener("touchstart", h.start);
      node.removeEventListener("touchmove", h.move);
      node.removeEventListener("touchend", h.end);
      node.removeEventListener("touchcancel", h.cancel);
    };
  });

  // Never leave a preview stuck: losing the page or unmounting ends it.
  useEffect(() => {
    const abort = () => finish(false);
    const hidden = () => {
      if (document.visibilityState === "hidden") finish(false);
    };
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", hidden);
      clearPending();
      live.current = null;
      window.clearTimeout(swallowTimer.current);
      detach.current();
      detach.current = () => {};
      attached.current = null;
    };
  }, [finish, clearPending]);

  // Escape aborts.
  useEffect(() => {
    if (!drag) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag, finish]);

  // Edge auto-scroll while armed.
  const armed = !!drag;
  useEffect(() => {
    const scroller = scrollerRef?.current;
    if (!armed || !scroller) return;
    let frame = 0;
    let last = performance.now();
    const tick = (time: number) => {
      const box = scroller.getBoundingClientRect();
      const delta = edgeScrollDelta(
        point.current.x,
        box.left,
        box.right,
        scroller.scrollLeft,
        scroller.scrollWidth - scroller.clientWidth,
        time - last,
      );
      last = time;
      if (delta && live.current) {
        scroller.scrollLeft += delta;
        moveTo(point.current.x, point.current.y);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [armed, scrollerRef]);

  // Mouse and pen. Touch has its own handlers above.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    clearPending();
    swallowClick.current = false;
    if (event.button !== 0) return;
    const start = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-date]",
    )?.dataset.date;
    if (!start || live.current) return;
    const { pointerId, clientX: x, clientY: y } = event;
    point.current = { x, y };
    const target = event.currentTarget;
    const press: Press = { id: pointerId, x, y, start, timer: 0 };
    press.timer = window.setTimeout(
      () => arm(press, false, target),
      LONG_PRESS_MS,
    );
    pending.current = press;
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    point.current = { x: event.clientX, y: event.clientY };
    const p = pending.current;
    if (p && event.pointerId === p.id) {
      if (
        Math.hypot(event.clientX - p.x, event.clientY - p.y) > LONG_PRESS_SLOP
      )
        clearPending();
      return;
    }
    if (live.current && event.pointerId === live.current.id)
      moveTo(event.clientX, event.clientY);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    if (pending.current?.id === event.pointerId) clearPending();
    if (live.current?.id === event.pointerId) finish(true);
  };
  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    if (pending.current?.id === event.pointerId) clearPending();
    if (live.current?.id === event.pointerId) finish(false);
  };

  return {
    drag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      // A long press must not open the context menu or select text.
      onContextMenu: (event: MouseEvent) => {
        if (pending.current || live.current) event.preventDefault();
      },
      // The click that follows an armed gesture is not a tap.
      onClickCapture: (event: MouseEvent) => {
        if (swallowClick.current) {
          swallowClick.current = false;
          event.stopPropagation();
          event.preventDefault();
        }
      },
    },
  };
}
