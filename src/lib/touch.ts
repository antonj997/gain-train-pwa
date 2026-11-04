/** True on a touch screen, where focusing a text field opens the keyboard. */
export const coarsePointer = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

/** Whether focusing this element would open a keyboard. */
export function opensKeyboard(element: Element | null) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !/^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/.test(
    element.type,
  );
}

export type TapPoint = { x: number; y: number; time: number };

/** How far (px) and how long (ms) a touch may go and still count as a tap. */
export const TAP_SLOP = 10;
export const TAP_TIME = 500;

/**
 * A real tap: lifted within TAP_SLOP px and TAP_TIME ms of where it went down,
 * with no scroll in between. Anything else was a drag to scroll, which must
 * never be answered with a notice.
 */
export function isTap(start: TapPoint, end: TapPoint, scrolled = false) {
  return (
    !scrolled &&
    Math.hypot(end.x - start.x, end.y - start.y) <= TAP_SLOP &&
    end.time - start.time >= 0 &&
    end.time - start.time <= TAP_TIME
  );
}
