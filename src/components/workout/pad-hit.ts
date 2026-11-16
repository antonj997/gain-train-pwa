import { padFieldAt, type PadField, type PadTarget } from "@/lib/number-pad";

/** The boxes of every field the number pad can type on the page now. */
function padFieldBoxes() {
  return [
    ...document.querySelectorAll<HTMLInputElement>(
      "[data-set-id] input[data-pad-field]",
    ),
  ].flatMap((input) => {
    const setId = input.closest("[data-set-id]")?.getAttribute("data-set-id");
    const field = input.getAttribute("data-pad-field") as PadField | null;
    if (!setId || !field) return [];
    const { left, top, right, bottom } = (
      input.closest(".set-field") ?? input
    ).getBoundingClientRect();
    return [{ setId, field, left, top, right, bottom }];
  });
}

/**
 * A press outside an open sheet that lands on a set's load or reps field
 * (under the sheet's backdrop): the field, so one tap can close the sheet
 * and open the pad there. Null for a press anywhere else. With a mouse the
 * click that follows lands on the closing backdrop, where the pad would take
 * it for a tap outside and close: that one click is kept from it.
 */
export function padFieldUnder(event: PointerEvent): PadTarget | null {
  const hit = padFieldAt(padFieldBoxes(), event.clientX, event.clientY);
  // Radix waits for a touch's click before it reports the press: it is over.
  if (hit && event.pointerType !== "touch") {
    const swallow = (click: MouseEvent) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(
      () => window.removeEventListener("click", swallow, { capture: true }),
      600,
    );
  }
  return hit;
}
