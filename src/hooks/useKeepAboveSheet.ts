import { useEffect, type RefObject } from "react";
import { centreScrollDelta } from "@/lib/keep-above-sheet";

// Radix mounts the sheet a render after it opens, so give it a few frames.
const FRAMES_TO_WAIT = 10;

/** How far the sheet still has to slide up; 0 when its transform cannot be read. */
function slideOffset(element: HTMLElement) {
  try {
    return new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
  } catch {
    return 0;
  }
}

/** The nearest ancestor that scrolls by itself, such as a routine's form; null for the page. */
function scrollParent(element: HTMLElement) {
  for (
    let parent = element.parentElement;
    parent && parent !== document.body && parent !== document.documentElement;
    parent = parent.parentElement
  )
    if (
      /(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
      parent.scrollHeight > parent.clientHeight
    )
      return parent;
  return null;
}

/**
 * While a set's sheet is open, pads the page by the sheet's height
 * (`--sheet-space`, used by the workout list and a routine's form) and scrolls
 * the set's row to sit midway between the top of what is visible (the top bar,
 * or the top of a scrolling form) and the sheet.
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
      const sliding = slideOffset(element);
      const rowRect = row.getBoundingClientRect();
      const scroller = scrollParent(row);
      const delta = centreScrollDelta({
        visibleTop: scroller
          ? scroller.getBoundingClientRect().top
          : (document.querySelector("[data-top-bar]")?.getBoundingClientRect()
              .bottom ?? 0),
        sheetTop: rect.top - sliding,
        rowTop: rowRect.top,
        rowHeight: rowRect.height,
      });
      (scroller ?? window).scrollBy({
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
