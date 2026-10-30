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
import { type WorkoutSet } from "@/data/model";
import { capturePointer, releasePointer } from "@/lib/pointer-capture";
import {
  createSetReorderController,
  edgeScrollDelta,
  finishSetReorder,
  pointerSetTarget,
  type SetReorder,
  type SetReorderEvent,
} from "@/lib/set-editing";
import "@/styles/workout.css";
import { t } from "@/i18n";

type Drag = {
  pointerId?: number;
  offsetY?: number;
  centers?: number[];
  initialScrollTop?: number;
  scrollContainer?: HTMLElement;
  clientY?: number;
  lastFrameTime?: number;
  handle: HTMLButtonElement;
  capture?: HTMLDivElement;
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

/** Movement is local until drop, so draft saving runs once per move. */
export default function SortableSetList({
  sets,
  name,
  onReorder,
  onMovingChange,
  children,
}: {
  sets: WorkoutSet[];
  name: string;
  onReorder: (sets: WorkoutSet[]) => void;
  /** Called with true when a keyboard or pointer move starts, false when it ends. */
  onMovingChange?: (moving: boolean) => void;
  children: (set: WorkoutSet, index: number, handle: ReactNode) => ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const controller = useRef(createSetReorderController());
  const animationFrame = useRef<number | null>(null);
  const focusAfterMove = useRef<HTMLButtonElement | null>(null);
  const setsRef = useRef(sets);
  const onReorderRef = useRef(onReorder);
  const onMovingChangeRef = useRef(onMovingChange);
  setsRef.current = sets;
  onReorderRef.current = onReorder;
  onMovingChangeRef.current = onMovingChange;
  const [order, setOrder] = useState<SetReorder | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const instructionsId = useId();

  const releaseDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (animationFrame.current !== null) {
      window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    if (drag?.pointerId !== undefined)
      releasePointer(drag.capture, drag.pointerId);
    return drag;
  }, []);

  const dispatch = useCallback(
    (event: SetReorderEvent, handle?: HTMLButtonElement) => {
      const result = controller.current.send(setsRef.current, event);
      if (!result.handled) return false;
      setOrder(result.order);
      if (result.finished) {
        focusAfterMove.current = releaseDrag()?.handle ?? null;
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
        if (!dragRef.current && handle) dragRef.current = { handle };
        setAnnouncement(
          t("set.movingAt", {
            position: result.order.targetIndex + 1,
            total: setsRef.current.length,
          }),
        );
      }
      return true;
    },
    [releaseDrag],
  );

  function movePointer(drag: Drag) {
    if (
      drag.pointerId === undefined ||
      drag.clientY === undefined ||
      !drag.centers ||
      !drag.scrollContainer
    )
      return;
    dispatch({
      type: "pointer-move",
      pointerId: drag.pointerId,
      targetIndex: pointerSetTarget(
        drag.clientY,
        drag.offsetY ?? 0,
        drag.initialScrollTop ?? 0,
        drag.scrollContainer.scrollTop,
        drag.centers,
      ),
    });
  }

  function scrollFrame(time: number) {
    animationFrame.current = null;
    const drag = dragRef.current;
    const container = drag?.scrollContainer;
    if (
      !drag ||
      drag.pointerId === undefined ||
      drag.clientY === undefined ||
      !container
    )
      return;
    const documentScroll =
      container === container.ownerDocument.scrollingElement;
    const bounds = documentScroll
      ? { top: 0, bottom: window.innerHeight }
      : container.getBoundingClientRect();
    const delta = edgeScrollDelta(
      drag.clientY,
      Math.max(0, bounds.top),
      Math.min(window.innerHeight, bounds.bottom),
      container.scrollTop,
      container.scrollHeight - container.clientHeight,
      drag.lastFrameTime === undefined ? 16 : time - drag.lastFrameTime,
    );
    drag.lastFrameTime = time;
    if (delta) {
      container.scrollTop += delta;
      movePointer(drag);
    }
    if (dragRef.current === drag)
      animationFrame.current = window.requestAnimationFrame(scrollFrame);
  }

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && controller.current.current()) {
        event.preventDefault();
        // Run before Radix's document listener so a routine dialog stays open.
        event.stopPropagation();
        dispatch({ type: "cancel" });
      }
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [dispatch]);

  const moving = order !== null;
  useEffect(() => {
    if (!moving) return;
    onMovingChangeRef.current?.(true);
    return () => onMovingChangeRef.current?.(false);
  }, [moving]);

  useEffect(() => {
    const current = controller.current.current();
    if (current && !sets.some((set) => set.id === current.id))
      dispatch({ type: "cancel" });
  }, [sets, dispatch]);

  useLayoutEffect(() => {
    const handle = dragRef.current?.handle ?? focusAfterMove.current;
    handle?.focus({ preventScroll: true });
    focusAfterMove.current = null;
  }, [order]);

  useEffect(
    () => () => {
      controller.current.send(setsRef.current, { type: "cancel" });
      releaseDrag();
    },
    [releaseDrag],
  );

  const visibleSets = finishSetReorder(sets, order);
  return (
    <div
      className="sortable-set-list"
      ref={listRef}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (drag?.pointerId !== event.pointerId) return;
        event.preventDefault();
        drag.clientY = event.clientY;
        movePointer(drag);
      }}
      onPointerUp={(event) =>
        dispatch({ type: "pointer-end", pointerId: event.pointerId })
      }
      onPointerCancel={(event) =>
        dispatch({ type: "pointer-cancel", pointerId: event.pointerId })
      }
      onLostPointerCapture={(event) =>
        dispatch({ type: "pointer-cancel", pointerId: event.pointerId })
      }
    >
      <p id={instructionsId} className="sr-only">
        Drag to reorder. With a keyboard, press Space or Enter to grab, use
        arrow keys to move, then Space or Enter to drop. Escape cancels the
        move.
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
              aria-label={t("set.moveHandle", { name, n: index + 1 })}
              aria-describedby={instructionsId}
              aria-pressed={order?.id === set.id}
              onPointerDown={(event) => {
                if (
                  !event.isPrimary ||
                  event.button !== 0 ||
                  controller.current.current()
                )
                  return;
                const capture = listRef.current;
                const rows = Array.from(
                  capture?.querySelectorAll<HTMLElement>(
                    "[data-sortable-set-id]",
                  ) ?? [],
                );
                const row = rows[index];
                if (!capture || !row) return;
                event.preventDefault();
                const bounds = row.getBoundingClientRect();
                const scrollContainer = nearestScrollContainer(capture);
                event.currentTarget.focus();
                // Capture on the stable list: the handle itself moves in the DOM.
                capturePointer(capture, event.pointerId);
                dragRef.current = {
                  pointerId: event.pointerId,
                  offsetY: event.clientY - (bounds.top + bounds.height / 2),
                  centers: rows
                    .filter((item) => item.dataset.sortableSetId !== set.id)
                    .map((item) => {
                      const rect = item.getBoundingClientRect();
                      return rect.top + rect.height / 2;
                    }),
                  initialScrollTop: scrollContainer.scrollTop,
                  scrollContainer,
                  clientY: event.clientY,
                  handle: event.currentTarget,
                  capture,
                };
                if (
                  dispatch({
                    type: "pointer-start",
                    id: set.id,
                    pointerId: event.pointerId,
                  })
                )
                  animationFrame.current =
                    window.requestAnimationFrame(scrollFrame);
                else releaseDrag();
              }}
              onKeyDown={(event) => {
                if (
                  dispatch(
                    { type: "key", id: set.id, key: event.key },
                    event.currentTarget,
                  )
                ) {
                  event.preventDefault();
                  if (event.key === "Escape") event.stopPropagation();
                }
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
