import { useEffect } from "react";
import { viewportMetrics } from "@/lib/visual-viewport";

/**
 * Publishes the visible area (window.visualViewport) on the root, once a
 * frame at most: --viewport-height, --viewport-top and --viewport-bottom (the
 * `bottom` a fixed bar needs to rest on the screen's bottom edge), and
 * data-keyboard-open. iPhone keyboards resize the visual viewport, not the
 * layout viewport or dvh, and with a field focused (or after its keyboard
 * closes) iPhone scrolls the visible area away from the layout viewport that
 * `position: fixed; bottom: 0` sticks to. Only changed values are written, so
 * a plain scroll restyles nothing.
 */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    let shown = "";
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const editing = !!document.activeElement?.matches(
          "input, textarea, select",
        );
        const m = viewportMetrics(
          window.innerHeight,
          viewport
            ? {
                height: viewport.height,
                offsetTop: viewport.offsetTop,
                scale: viewport.scale,
              }
            : null,
          editing,
        );
        const next = `${m.height}|${m.top}|${m.bottom}|${m.keyboardOpen}`;
        if (next === shown) return;
        shown = next;
        root.style.setProperty("--viewport-height", `${m.height}px`);
        root.style.setProperty("--viewport-top", `${m.top}px`);
        root.style.setProperty("--viewport-bottom", `${m.bottom}px`);
        root.toggleAttribute("data-keyboard-open", m.keyboardOpen);
      });
    };
    update();
    const passive = { passive: true } as const;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update, passive);
    window.addEventListener("resize", update);
    // iPhone does not always tell visualViewport when the page's own scroll
    // carries the visible area back to the layout viewport.
    window.addEventListener("scroll", update, passive);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      root.style.removeProperty("--viewport-height");
      root.style.removeProperty("--viewport-top");
      root.style.removeProperty("--viewport-bottom");
      root.removeAttribute("data-keyboard-open");
    };
  }, []);
}
