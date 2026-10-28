import { useEffect, type RefObject } from "react";
import { centreScrollDelta } from "@/lib/keep-above-sheet";

// Radix mounts the sheet a render after it opens, so give it a few frames.
const FRAMES_TO_WAIT = 10;

/**
 * While a set's sheet is open, pads the page by the sheet's height
 * (`--sheet-space`, used by the workout list) and scrolls the set's row to sit
 * midway between the top bar and the sheet.
 */
export function useKeepAboveSheet(
  rowId: string | null,
  sheet: RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!rowId) return;
    const root = document.documentElement;
    let frame = 0;
    let waited = 0;
    let observer: ResizeObserver | undefined;

    const measure = (element: HTMLElement) => {
      const row = document.querySelector<HTMLElement>(
        `[data-set-id="${rowId}"]`,
      );
      if (!row) return;
      const rect = element.getBoundingClientRect();
      // The sheet slides up as it opens; measure where it will rest.
      const sliding = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        .m42;
      const rowRect = row.getBoundingClientRect();
      const delta = centreScrollDelta({
        visibleTop:
          document.querySelector("[data-top-bar]")?.getBoundingClientRect()
            .bottom ?? 0,
        sheetTop: rect.top - sliding,
        rowTop: rowRect.top,
        rowHeight: rowRect.height,
      });
      window.scrollBy({
        top: delta,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    };

    const start = () => {
      const element = sheet.current;
      if (!element) {
        if (++waited < FRAMES_TO_WAIT) frame = requestAnimationFrame(start);
        return;
      }
      const publish = () =>
        root.style.setProperty("--sheet-space", `${element.offsetHeight}px`);
      publish();
      observer = new ResizeObserver(publish);
      observer.observe(element);
      measure(element);
    };
    frame = requestAnimationFrame(start);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      root.style.removeProperty("--sheet-space");
    };
  }, [rowId, sheet]);
}
