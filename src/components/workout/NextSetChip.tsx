import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A floating "Next set" chip that shows only while the next set's row is out of
 * view. Tapping it centres the row and focuses its first field.
 */
export default function NextSetChip({ setId }: { setId?: string }) {
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    setOffscreen(false);
    if (!setId) return;
    const row = document.querySelector(`[data-set-id="${setId}"]`);
    if (!row) return;
    // The sticky top bar covers the top of the screen, so a row under it is out of view.
    const covered =
      document.querySelector("[data-top-bar]")?.getBoundingClientRect()
        .bottom ?? 0;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { rootMargin: `-${Math.ceil(covered)}px 0px 0px 0px` },
    );
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
      Next set
      <ArrowDown size={16} aria-hidden="true" />
    </button>
  );
}
