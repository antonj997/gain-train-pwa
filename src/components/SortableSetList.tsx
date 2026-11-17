import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GripVertical } from "lucide-react";
import { capturePointer, releasePointer } from "@/lib/pointer-capture";
import {
  createSetReorderController,
  edgeScrollDelta,
  finishSetReorder,
  pointerSetTarget,
  type SetReorder,
  type SetReorderEvent,
} from "@/lib/set-editing";
import {
  dropOffset,
  moveItem,
  slotPitch,
  slotShift,
  type Slots,
} from "@/lib/sort-drag";
import { MOTION, SPRING, playSpring, settled } from "@/lib/motion";
import { reducedMotion } from "@/hooks/useMessages";
import { TAP_SLOP } from "@/lib/touch";
import "@/styles/workout.css";
import { t } from "@/i18n";

/** How long a finger rests on a row before it is picked up. */
export const HOLD_MS = 250;
/** How much a picked-up row grows. */
const LIFT_SCALE = 1.03;

/** A press that may become a pick-up: held still (touch) or dragged (mouse). */
type Press = {
  pointerId: number;
  id: string;
  x: number;
  y: number;
  mouse: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

/** A row held under the finger. The DOM order stays put until it is dropped. */
type Lift = {
  pointerId: number;
  id: string;
  from: number;
  target: number;
  rows: HTMLElement[];
  slots: Slots;
  pitch: number;
  /** Centres of the other rows, for the slot under the finger. */
  centers: number[];
  startY: number;
  /** From the finger to the held row's centre. */
  offsetY: number;
  clientY: number;
  scroll: HTMLElement;
  startScroll: number;
  lastFrameTime?: number;
  grow: Animation | null;
};

function nearestScrollContainer(element: HTMLElement) {
  const document = element.ownerDocument;
  for (
    let parent = element.parentElement;
    parent && parent !== document.body;
    parent = parent.parentElement
  ) {
    const overflow =
      document.defaultView?.getComputedStyle(parent).overflowY ?? "";
    if (
      /(auto|scroll|overlay)/.test(overflow) &&
      parent.scrollHeight > parent.clientHeight
    )
      return parent;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

const at = (y: number) => (y ? `0 ${y}px` : "");

/** A dropped row springs from `y` px off into its slot and back to size. */
function settle(row: HTMLElement, y: number) {
  if (reducedMotion()) return;
  row.dataset.settling = "";
  const moves = [
    playSpring(row, SPRING.drop, y, 0, (v) => ({ translate: at(v) || "0 0" })),
    playSpring(row, SPRING.drop, LIFT_SCALE, 1, (v) => ({ scale: v })),
  ];
  void Promise.all(moves.map(settled)).then(() => {
    if (!row.getAnimations().length) delete row.dataset.settling;
  });
}

/**
 * A list sorted by hand: hold a row (or press its grip) and it lifts, follows
 * the finger while the other rows slide out of its way, and settles into its
 * slot when let go; only then is the new order committed, once. With a
 * keyboard the grip moves it (Space or Enter, the arrow keys, Escape cancels).
 * Sorts sets in Reorder sets and exercises in Reorder exercises.
 */
export default function SortableSetList<T extends { id: string }>({
  sets,
  name,
  handleLabel,
  onReorder,
  onMovingChange,
  children,
}: {
  sets: T[];
  name: string;
  /** The handle's name for the row at `index`; "Move Squat set 2" by default. */
  handleLabel?: (item: T, index: number) => string;
  onReorder: (sets: T[]) => void;
  /** Called with true when a keyboard or pointer move starts, false when it ends. */
  onMovingChange?: (moving: boolean) => void;
  children: (set: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const lift = useRef<Lift | null>(null);
  /** Inline positions to clear once the new order has rendered. */
  const pendingClear = useRef(false);
  /** The dropped row, still this far (px) from its new slot when it rendered. */
  const pendingSettle = useRef<{ id: string; y: number } | null>(null);
  const animationFrame = useRef<number | null>(null);
  const controller = useRef(createSetReorderController());
  const focusAfterMove = useRef<HTMLButtonElement | null>(null);
  const keyHandle = useRef<HTMLButtonElement | null>(null);
  const setsRef = useRef(sets);
  const onReorderRef = useRef(onReorder);
  const onMovingChangeRef = useRef(onMovingChange);
  setsRef.current = sets;
  onReorderRef.current = onReorder;
  onMovingChangeRef.current = onMovingChange;
  const [order, setOrder] = useState<SetReorder | null>(null);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const instructionsId = useId();

  // ── Keyboard moves (the grip): the order previews as the keys move it. ──
  const dispatch = useCallback((event: SetReorderEvent) => {
    const result = controller.current.send(setsRef.current, event);
    if (!result.handled) return false;
    setOrder(result.order);
    if (result.finished) {
      focusAfterMove.current = keyHandle.current;
      keyHandle.current = null;
      if (result.commit) onReorderRef.current(result.commit);
      setAnnouncement(
        result.finished.cancelled
          ? t("set.moveCancelled")
          : t("set.droppedAt", {
              position: result.finished.targetIndex + 1,
              total: setsRef.current.length,
            }),
      );
    } else if (result.order) {
      setAnnouncement(
        t("set.movingAt", {
          position: result.order.targetIndex + 1,
          total: setsRef.current.length,
        }),
      );
    }
    return true;
  }, []);

  // ── Pointer moves: the held row follows the finger. ──
  const clearRows = useCallback(() => {
    const list = listRef.current;
    pendingClear.current = false;
    if (!list) return;
    delete list.dataset.sorting;
    list
      .querySelectorAll<HTMLElement>("[data-sortable-set-id]")
      .forEach((row) => {
        row.getAnimations().forEach((animation) => animation.cancel());
        row.style.translate = "";
        row.style.scale = "";
        delete row.dataset.lifted;
        delete row.dataset.settling;
      });
  }, []);

  const stopFrames = () => {
    if (animationFrame.current !== null) {
      window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  };

  const follow = useCallback((held: Lift) => {
    const scrolled = held.scroll.scrollTop - held.startScroll;
    held.rows[held.from].style.translate = at(
      held.clientY - held.startY + scrolled,
    );
    const target = pointerSetTarget(
      held.clientY,
      held.offsetY,
      held.startScroll,
      held.scroll.scrollTop,
      held.centers,
    );
    if (target === held.target) return;
    held.target = target;
    held.rows.forEach((row, index) => {
      if (index !== held.from)
        row.style.translate = at(
          slotShift(index, held.from, target, held.pitch),
        );
    });
    setAnnouncement(
      t("set.movingAt", { position: target + 1, total: held.rows.length }),
    );
  }, []);

  const scrollFrame = useCallback(
    (time: number) => {
      animationFrame.current = null;
      const held = lift.current;
      if (!held) return;
      const container = held.scroll;
      const documentScroll =
        container === container.ownerDocument.scrollingElement;
      const bounds = documentScroll
        ? { top: 0, bottom: window.innerHeight }
        : container.getBoundingClientRect();
      const delta = edgeScrollDelta(
        held.clientY,
        Math.max(0, bounds.top),
        Math.min(window.innerHeight, bounds.bottom),
        container.scrollTop,
        container.scrollHeight - container.clientHeight,
        held.lastFrameTime === undefined ? 16 : time - held.lastFrameTime,
      );
      held.lastFrameTime = time;
      if (delta) {
        container.scrollTop += delta;
        follow(held);
      }
      animationFrame.current = window.requestAnimationFrame(scrollFrame);
    },
    [follow],
  );

  const pickUp = useCallback(
    (id: string, pointerId: number, clientY: number) => {
      const list = listRef.current;
      if (!list || lift.current) return;
      if (controller.current.current()) return; // a keyboard move is running
      const rows = Array.from(
        list.querySelectorAll<HTMLElement>("[data-sortable-set-id]"),
      );
      const from = rows.findIndex((row) => row.dataset.sortableSetId === id);
      if (from < 0) return;
      // A row still settling lands at once, so the slots are measured true.
      rows.forEach((row) => {
        row.getAnimations().forEach((animation) => animation.finish());
        delete row.dataset.settling;
      });
      const rects = rows.map((row) => row.getBoundingClientRect());
      const slots = {
        tops: rects.map((rect) => rect.top),
        heights: rects.map((rect) => rect.height),
      };
      const scroll = nearestScrollContainer(list);
      const row = rows[from];
      capturePointer(list, pointerId);
      lift.current = {
        pointerId,
        id,
        from,
        target: from,
        rows,
        slots,
        pitch: slotPitch(slots, from),
        centers: rects
          .filter((_, index) => index !== from)
          .map((rect) => rect.top + rect.height / 2),
        startY: clientY,
        offsetY: clientY - (rects[from].top + rects[from].height / 2),
        clientY,
        scroll,
        startScroll: scroll.scrollTop,
        grow: null,
      };
      list.dataset.sorting = "";
      row.dataset.lifted = "";
      row.style.scale = String(LIFT_SCALE);
      if (!reducedMotion())
        lift.current.grow = playSpring(
          row,
          SPRING.lift,
          1,
          LIFT_SCALE,
          (s) => ({ scale: s }),
        );
      navigator.vibrate?.(10);
      setDragging(true);
      setAnnouncement(
        t("set.movingAt", { position: from + 1, total: rows.length }),
      );
      animationFrame.current = window.requestAnimationFrame(scrollFrame);
    },
    [scrollFrame],
  );

  /**
   * Lets go: the new order is committed at once and the row settles into its
   * slot from where the finger left it (or back, cancelled). Nothing waits on
   * the settle, so the next row can be picked up straight away.
   */
  const drop = useCallback(
    (cancelled: boolean) => {
      const held = lift.current;
      if (!held) return;
      lift.current = null;
      stopFrames();
      releasePointer(listRef.current ?? undefined, held.pointerId);
      setDragging(false);
      const target = cancelled ? held.from : held.target;
      const now =
        held.clientY -
        held.startY +
        held.scroll.scrollTop -
        held.startScroll;
      const y = now - dropOffset(held.slots, held.from, target);
      setAnnouncement(
        cancelled
          ? t("set.moveCancelled")
          : t("set.droppedAt", {
              position: target + 1,
              total: held.rows.length,
            }),
      );
      held.grow?.cancel();
      if (target === held.from) {
        // Back where it was: the others slide home while it settles.
        const row = held.rows[held.from];
        held.rows.forEach((other) => (other.style.translate = ""));
        row.style.scale = "";
        delete row.dataset.lifted;
        settle(row, y);
        window.setTimeout(() => {
          const list = listRef.current;
          if (list && !lift.current) delete list.dataset.sorting;
        }, MOTION.slot * 2);
        return;
      }
      // The rows already stand where the new order puts them: once it renders
      // the offsets are cleared and only the dropped row is still moving.
      pendingClear.current = true;
      pendingSettle.current = { id: held.id, y };
      onReorderRef.current(moveItem(setsRef.current, held.from, target));
      window.setTimeout(() => {
        if (pendingClear.current) clearRows();
        pendingSettle.current = null;
      }, 400);
    },
    [clearRows],
  );

  useLayoutEffect(() => {
    if (!pendingClear.current) return;
    clearRows();
    const landing = pendingSettle.current;
    pendingSettle.current = null;
    const row = landing
      ? listRef.current?.querySelector<HTMLElement>(
          `[data-sortable-set-id="${CSS.escape(landing.id)}"]`,
        )
      : null;
    if (row && landing) settle(row, landing.y);
  }, [sets, clearRows]);

  // Native listeners: a held row's moves must not reach the sheet (which
  // would drag itself), and iOS only stops scrolling for a cancelled touchmove.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const cancelPress = () => {
      if (press.current?.timer) clearTimeout(press.current.timer);
      press.current = null;
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button > 0) return;
      if (lift.current || controller.current.current()) return;
      const target = event.target as Element;
      const row = target.closest<HTMLElement>("[data-sortable-set-id]");
      const id = row?.dataset.sortableSetId;
      if (!row || !id || !list.contains(row)) return;
      cancelPress();
      // The grip lifts at once; the rest of the row after a short hold.
      if (target.closest(".set-drag-handle")) {
        event.preventDefault();
        pickUp(id, event.pointerId, event.clientY);
        return;
      }
      const mouse = event.pointerType === "mouse";
      press.current = {
        pointerId: event.pointerId,
        id,
        x: event.clientX,
        y: event.clientY,
        mouse,
        timer: mouse
          ? undefined
          : setTimeout(() => {
              const p = press.current;
              press.current = null;
              if (p) pickUp(p.id, p.pointerId, p.y);
            }, HOLD_MS),
      };
    };
    const move = (event: PointerEvent) => {
      const held = lift.current;
      if (held && event.pointerId === held.pointerId) {
        event.preventDefault();
        event.stopPropagation();
        held.clientY = event.clientY;
        follow(held);
        return;
      }
      const p = press.current;
      if (!p || p.pointerId !== event.pointerId) return;
      const moved = Math.hypot(event.clientX - p.x, event.clientY - p.y);
      if (moved <= TAP_SLOP) return;
      cancelPress();
      // A mouse drags at once; a finger that moves first is scrolling.
      if (p.mouse) {
        pickUp(p.id, p.pointerId, p.y);
        const held = lift.current as Lift | null;
        if (held) {
          held.clientY = event.clientY;
          follow(held);
        }
      }
    };
    const up = (event: PointerEvent) => {
      if (press.current?.pointerId === event.pointerId) cancelPress();
      if (lift.current?.pointerId !== event.pointerId) return;
      event.stopPropagation();
      drop(false);
    };
    const cancel = (event: PointerEvent) => {
      if (press.current?.pointerId === event.pointerId) cancelPress();
      if (lift.current?.pointerId === event.pointerId) drop(true);
    };
    const touchMove = (event: TouchEvent) => {
      if (!lift.current) return;
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
    };
    // No text selection or callout under a held finger.
    const contextMenu = (event: Event) => {
      if (press.current || lift.current) event.preventDefault();
    };
    list.addEventListener("pointerdown", down);
    list.addEventListener("pointermove", move);
    list.addEventListener("pointerup", up);
    list.addEventListener("pointercancel", cancel);
    list.addEventListener("lostpointercapture", cancel);
    list.addEventListener("touchmove", touchMove, { passive: false });
    list.addEventListener("contextmenu", contextMenu);
    return () => {
      cancelPress();
      list.removeEventListener("pointerdown", down);
      list.removeEventListener("pointermove", move);
      list.removeEventListener("pointerup", up);
      list.removeEventListener("pointercancel", cancel);
      list.removeEventListener("lostpointercapture", cancel);
      list.removeEventListener("touchmove", touchMove);
      list.removeEventListener("contextmenu", contextMenu);
    };
  }, [pickUp, follow, drop]);

  // Escape: cancels a pointer or keyboard move before a dialog closes on it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (lift.current) {
        event.preventDefault();
        event.stopPropagation();
        drop(true);
      } else if (controller.current.current()) {
        event.preventDefault();
        // Run before Radix's document listener so a routine dialog stays open.
        event.stopPropagation();
        dispatch({ type: "cancel" });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dispatch, drop]);

  const moving = order !== null || dragging;
  useEffect(() => {
    if (!moving) return;
    onMovingChangeRef.current?.(true);
    return () => onMovingChangeRef.current?.(false);
  }, [moving]);

  useEffect(() => {
    const current = controller.current.current();
    if (current && !sets.some((set) => set.id === current.id))
      dispatch({ type: "cancel" });
    const held = lift.current;
    if (held && !sets.some((set) => set.id === held.id)) drop(true);
  }, [sets, dispatch, drop]);

  useLayoutEffect(() => {
    const handle = keyHandle.current ?? focusAfterMove.current;
    handle?.focus({ preventScroll: true });
    focusAfterMove.current = null;
  }, [order]);

  useEffect(
    () => () => {
      controller.current.send(setsRef.current, { type: "cancel" });
      stopFrames();
      const held = lift.current;
      lift.current = null;
      if (held) releasePointer(listRef.current ?? undefined, held.pointerId);
    },
    [],
  );

  const visibleSets = finishSetReorder(sets, order);
  return (
    <div className="sortable-set-list" ref={listRef}>
      <p id={instructionsId} className="sr-only">
        {t("set.sortInstructions")}
      </p>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
      {visibleSets.map((set, index) => (
        <div
          key={set.id}
          className={`sortable-set-item${order?.id === set.id ? " is-moving" : ""}`}
          data-sortable-set-id={set.id}
        >
          {children(
            set,
            index,
            <button
              type="button"
              className="set-drag-handle"
              aria-label={
                handleLabel
                  ? handleLabel(set, index)
                  : t("set.moveHandle", { name, n: index + 1 })
              }
              aria-describedby={instructionsId}
              aria-pressed={order?.id === set.id}
              onKeyDown={(event) => {
                if (lift.current) return;
                keyHandle.current = event.currentTarget;
                if (dispatch({ type: "key", id: set.id, key: event.key })) {
                  event.preventDefault();
                  if (event.key === "Escape") event.stopPropagation();
                } else if (!controller.current.current())
                  keyHandle.current = null;
              }}
            >
              <GripVertical size={17} aria-hidden="true" />
              <span aria-hidden="true">{index + 1}</span>
            </button>,
          )}
        </div>
      ))}
    </div>
  );
}
