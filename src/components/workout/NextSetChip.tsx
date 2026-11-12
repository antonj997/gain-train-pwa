import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { topBarRootMargin } from "@/lib/root-margin";
import { useT } from "@/i18n/useT";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A floating "Next set" chip that shows only while the next set's row is out of
 * view: just the button, its arrow pointing to where the row is. Tapping it
 * centres the row and focuses its first field.
 */
export default function NextSetChip({ setId }: { setId?: string }) {
  // Where the row is while out of view; null while it is in view.
  const [offscreen, setOffscreen] = useState<"above" | "below" | null>(null);
  const { t } = useT();
  useEffect(() => {
    setOffscreen(null);
    if (!setId) return;
    const row = document.querySelector(`[data-set-id="${setId}"]`);
    if (!row) return;
    // The sticky top bar covers the top of the screen, so a row under it is out of view.
    const covered =
      document.querySelector("[data-top-bar]")?.getBoundingClientRect()
        .bottom ?? 0;
    const onChange: IntersectionObserverCallback = ([entry]) =>
      setOffscreen(
        entry.isIntersecting
          ? null
          : entry.boundingClientRect.top < (entry.rootBounds?.top ?? covered)
            ? "above"
            : "below",
      );
    let observer: IntersectionObserver;
    try {
      observer = new IntersectionObserver(onChange, {
        rootMargin: topBarRootMargin(covered),
      });
    } catch {
      // A browser that still refuses the margin gets the plain viewport.
      observer = new IntersectionObserver(onChange);
    }
    observer.observe(row);
    return () => observer.disconnect();
  }, [setId]);
  if (!setId || !offscreen) return null;
  const go = () => {
    const row = document.querySelector<HTMLElement>(`[data-set-id="${setId}"]`);
    if (!row) return;
    row
      .querySelector<HTMLInputElement>("input:not(:disabled)")
      ?.focus({ preventScroll: true });
    row.scrollIntoView({
      block: "center",
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  };
  return (
    <button type="button" className="next-set-chip" onClick={go}>
      {offscreen === "above" ? (
        <ArrowUp size={18} aria-hidden="true" />
      ) : (
        <ArrowDown size={18} aria-hidden="true" />
      )}
      {t("workout.nextSet")}
    </button>
  );
}
