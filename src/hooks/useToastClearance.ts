import { useLayoutEffect, type RefObject } from "react";

/**
 * Starts toasts just below this element, the page's header or the workout's
 * sticky top bar, so they never cover its title or buttons. Sets
 * `--toast-top` on the root while mounted; the stylesheet has a fallback.
 */
export function useToastClearance(ref: RefObject<HTMLElement>, sticky = false) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const place = () => {
      // A sticky bar stays put in the viewport; a header scrolls with the page.
      const bottom =
        element.getBoundingClientRect().bottom + (sticky ? 0 : window.scrollY);
      root.style.setProperty("--toast-top", `${Math.round(bottom) + 8}px`);
    };
    place();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--toast-top");
    };
  }, [ref, sticky]);
}
