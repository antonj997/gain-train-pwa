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

/**
 * Press and hold a cell, then drag to select dates. Pointer events serve
 * touch and mouse alike. Nothing happens until the pointer has stayed within
 * a few px for LONG_PRESS_MS, so taps and swipes behave as before. Once
 * armed, scrolling is blocked until release; release commits, Escape or a
 * pointer cancel aborts. Near the left or right edge of `scroller` the grid
 * scrolls so the drag can reach further.
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
  const pending = useRef<{
    id: number;
    x: number;
    y: number;
    start: string;
    timer: number;
  } | null>(null);
  const live = useRef<(DragRange & { id: number }) | null>(null);
  const point = useRef({ x: 0, y: 0 });
  const swallowClick = useRef(false);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });

  const clearPending = () => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
  };
  const finish = useCallback(
    (save: boolean) => {
      const current = live.current;
      live.current = null;
      setDrag(null);
      if (!current) return;
      try {
        containerRef.current?.releasePointerCapture(current.id);
      } catch {
        // The pointer is already gone.
      }
      swallowClick.current = true;
      window.setTimeout(() => (swallowClick.current = false), 400);
      if (save)
        commit.current({ start: current.start, current: current.current });
    },
    [containerRef],
  );

  // Block scrolling while armed. It must be a non-passive native listener,
  // and the container may mount after this hook (the month grid does), so
  // attach on every render that finds a new node.
  const blocked = useRef<HTMLElement | null>(null);
  const block = useRef((event: TouchEvent) => {
    if (live.current && event.cancelable) event.preventDefault();
  });
  useEffect(() => {
    const node = containerRef.current;
    if (node === blocked.current) return;
    blocked.current?.removeEventListener("touchmove", block.current);
    node?.addEventListener("touchmove", block.current, { passive: false });
    blocked.current = node;
  });
  useEffect(
    () => () =>
      blocked.current?.removeEventListener("touchmove", block.current),
    [],
  );

  // Escape aborts; so does losing the page.
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
        const date = dateAt(point.current.x, point.current.y);
        if (date && date !== live.current.current) {
          live.current.current = date;
          setDrag({ start: live.current.start, current: date });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [armed, scrollerRef]);

  useEffect(() => () => clearPending(), []);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    clearPending();
    swallowClick.current = false;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const start = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-date]",
    )?.dataset.date;
    if (!start || live.current) return;
    const { pointerId, clientX: x, clientY: y } = event;
    point.current = { x, y };
    const target = event.currentTarget;
    pending.current = {
      id: pointerId,
      x,
      y,
      start,
      timer: window.setTimeout(() => {
        pending.current = null;
        live.current = { id: pointerId, start, current: start };
        try {
          target.setPointerCapture(pointerId);
        } catch {
          // Capture is a nicety; the touchmove block does the work.
        }
        navigator.vibrate?.(10);
        setDrag({ start, current: start });
      }, LONG_PRESS_MS),
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    point.current = { x: event.clientX, y: event.clientY };
    const p = pending.current;
    if (p && event.pointerId === p.id) {
      if (
        Math.hypot(event.clientX - p.x, event.clientY - p.y) > LONG_PRESS_SLOP
      )
        clearPending();
      return;
    }
    const current = live.current;
    if (!current || event.pointerId !== current.id) return;
    const date = dateAt(event.clientX, event.clientY);
    if (date && date !== current.current) {
      current.current = date;
      setDrag({ start: current.start, current: date });
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (pending.current?.id === event.pointerId) clearPending();
    if (live.current?.id === event.pointerId) finish(true);
  };
  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
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
      // The click that follows a committed drag is not a tap.
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
