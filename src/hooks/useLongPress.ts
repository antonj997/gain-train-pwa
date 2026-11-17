import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { TAP_SLOP } from "@/lib/touch";
import { tipUsed } from "@/lib/tip-store";
import type { TipId } from "@/lib/tips";

/** How long (ms) a finger rests before a flat row opens its menu. */
export const LONG_PRESS_MS = 500;
const SWALLOW_CLICK_MS = 600;

/**
 * Press and hold on a flat row (it never swipes) opens its menu. A move
 * past the tap slop, a scroll (pointercancel) or lifting early is a normal
 * tap or scroll. The click after a hold is swallowed, and a right-click (or
 * Android's long-press context menu) opens the same menu. Spread the result
 * on the row's root and give it the `long-press` class (no iOS callout, no
 * text selection).
 */
export function useLongPress(
  onLongPress: ((anchor: HTMLElement) => void) | undefined,
  tip?: TipId,
) {
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const firedAt = useRef(0);
  const handler = useRef(onLongPress);
  handler.current = onLongPress;
  const clear = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => clear, []);
  const fire = (el: HTMLElement) => {
    firedAt.current = performance.now();
    // The menu may open under the finger (a bottom sheet): the click that
    // lifting it makes must not choose an item there either. The first click
    // until shortly after the finger lifts is swallowed, wherever it lands.
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      stop();
    };
    const lifted = () => setTimeout(stop, SWALLOW_CLICK_MS / 2);
    const stop = () => {
      window.removeEventListener("click", swallow, true);
      window.removeEventListener("pointerup", lifted, true);
      window.removeEventListener("pointercancel", lifted, true);
    };
    window.addEventListener("click", swallow, true);
    window.addEventListener("pointerup", lifted, true);
    window.addEventListener("pointercancel", lifted, true);
    setTimeout(stop, 5000);
    navigator.vibrate?.(10);
    if (tip) tipUsed(tip);
    handler.current?.(el);
  };
  if (!onLongPress) return {};
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary) return;
      if (event.pointerType === "mouse") return; // right-click opens it instead
      clear();
      const el = event.currentTarget;
      press.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer: setTimeout(() => {
          press.current = null;
          fire(el);
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const p = press.current;
      if (
        p &&
        p.id === event.pointerId &&
        Math.hypot(event.clientX - p.x, event.clientY - p.y) > TAP_SLOP
      )
        clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu(event: MouseEvent<HTMLElement>) {
      event.preventDefault();
      // A touch hold already opened it; a right-click opens it now.
      if (performance.now() - firedAt.current < SWALLOW_CLICK_MS) return;
      clear();
      fire(event.currentTarget);
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (performance.now() - firedAt.current < SWALLOW_CLICK_MS) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
