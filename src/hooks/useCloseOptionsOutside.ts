import { useEffect, type Dispatch, type RefObject } from "react";
import type { OptionsAction } from "@/lib/exercise-options";

/**
 * Closes an exercise's options when focus or a tap lands outside its card, or
 * on Escape (returning focus to the card's options button).
 */
export function useCloseOptionsOutside(
  container: RefObject<HTMLElement>,
  openId: string | undefined,
  changeOptions: Dispatch<OptionsAction>,
) {
  useEffect(() => {
    if (!openId) return;
    const card = container.current?.querySelector<HTMLElement>(
      "[data-options-open]",
    );
    if (!card) return;
    let pointerActivation = false;
    const beginPointer = () => {
      pointerActivation = true;
    };
    const cancelPointer = () => {
      pointerActivation = false;
    };
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !card.contains(event.target))
        changeOptions({ type: "close", id: openId });
    };
    const closeAfterClick = (event: MouseEvent) => {
      pointerActivation = false;
      closeOutside(event);
    };
    const closeOnFocus = (event: FocusEvent) => {
      // Keep the layout still until a pointer's target has received its click.
      if (!pointerActivation) closeOutside(event);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      pointerActivation = false;
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      card.querySelector<HTMLButtonElement>(".exercise-heading button")?.focus({
        preventScroll: true,
      });
      changeOptions({ type: "close", id: openId });
    };
    document.addEventListener("pointerdown", beginPointer, true);
    document.addEventListener("pointercancel", cancelPointer, true);
    document.addEventListener("click", closeAfterClick);
    document.addEventListener("focusin", closeOnFocus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", beginPointer, true);
      document.removeEventListener("pointercancel", cancelPointer, true);
      document.removeEventListener("click", closeAfterClick);
      document.removeEventListener("focusin", closeOnFocus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [container, openId, changeOptions]);
}
