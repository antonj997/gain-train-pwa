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
