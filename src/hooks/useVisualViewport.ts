import { useEffect } from "react";

// iOS keyboards resize the visual viewport, not the layout viewport or dvh.
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Preserve normal browser panning when the user pinch-zooms.
        const unzoomed = !viewport || Math.abs(viewport.scale - 1) < 0.05;
        const height = unzoomed
          ? (viewport?.height ?? window.innerHeight)
          : window.innerHeight;
        const top = unzoomed ? (viewport?.offsetTop ?? 0) : 0;
        root.style.setProperty("--viewport-height", `${height}px`);
        root.style.setProperty("--viewport-top", `${top}px`);
        const editing = document.activeElement?.matches(
          "input, textarea, select",
        );
        root.toggleAttribute(
          "data-keyboard-open",
          !!editing && unzoomed && window.innerHeight - height > 140,
        );
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      root.style.removeProperty("--viewport-height");
      root.style.removeProperty("--viewport-top");
      root.removeAttribute("data-keyboard-open");
    };
  }, []);
}
