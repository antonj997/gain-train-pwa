import { useLayoutEffect, useRef } from "react";
import { EASE, MOTION, play } from "@/lib/motion";
import { reducedMotion } from "@/hooks/useMessages";

/** More changes than this at once is a new grid, not an edit. */
const MAX_ADDED = 2;

type Box = { left: number; top: number };

/**
 * Motion for a grid of tiles (useListMotion is for a column of rows): a new
 * tile pops in (scale and fade, 200ms ease-out), and tiles that moved because
 * of it, such as the ones after a copy Duplicate placed, slide from where
 * they were in both directions (FLIP, 240ms). Children are matched by
 * `data-key`. A change of `resetKey` (a folder, a search, the order) is a
 * new grid: nothing animates. Runs on `play`, so reduced motion turns the
 * pop into a short fade and drops the slides.
 */
export function useGridMotion<T extends HTMLElement = HTMLDivElement>(
  resetKey: unknown,
) {
  const ref = useRef<T>(null);
  const last = useRef<{ key: unknown; boxes: Map<string, Box> } | null>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const origin = grid.getBoundingClientRect();
    const boxes = new Map<string, Box>();
    const nodes = new Map<string, HTMLElement>();
    for (const node of Array.from(grid.children)) {
      if (!(node instanceof HTMLElement) || !node.dataset.key) continue;
      const r = node.getBoundingClientRect();
      boxes.set(node.dataset.key, {
        left: r.left - origin.left,
        top: r.top - origin.top,
      });
      nodes.set(node.dataset.key, node);
    }
    const before = last.current;
    last.current = { key: resetKey, boxes };
    if (!before || before.key !== resetKey || !before.boxes.size) return;
    const added = [...boxes.keys()].filter((key) => !before.boxes.has(key));
    if (added.length > MAX_ADDED) return;
    for (const key of added)
      play(
        nodes.get(key),
        [
          { opacity: 0, transform: "scale(0.92)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: MOTION.rowIn, easing: EASE.out },
      );
    if (reducedMotion()) return;
    for (const [key, box] of boxes) {
      const was = before.boxes.get(key);
      if (!was) continue;
      const dx = was.left - box.left;
      const dy = was.top - box.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      play(
        nodes.get(key),
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: MOTION.rowOut, easing: EASE.out },
      );
    }
  });
  return ref;
}
