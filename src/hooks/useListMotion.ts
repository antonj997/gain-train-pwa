import { useLayoutEffect, useRef } from "react";
import { EASE, MOTION, settled } from "@/lib/motion";
import { foldAway, growIn, slideFrom } from "@/lib/presence";
import { reducedMotion } from "@/hooks/useMessages";

export type ListMotionOptions = {
  /** When this changes (a search, a filter, another tab) the list is new: nothing animates. */
  resetKey?: unknown;
  /** "row" for list items (200 in / 240 out), "banner" for messages (220 / 180). */
  kind?: "row" | "banner";
  /** Also animate the first items into an empty list (a banner stack). */
  fromEmpty?: boolean;
};

/** More changes than this at once is a new list, not an edit. */
const MAX_CHANGES = 4;

type Snapshot = {
  nodes: HTMLElement[];
  boxes: Map<HTMLElement, { top: number; height: number }>;
  key: unknown;
};

const children = (list: HTMLElement) =>
  Array.from(list.children).filter(
    (n): n is HTMLElement =>
      n instanceof HTMLElement && !n.hasAttribute("data-list-ghost"),
  );

function snapshot(list: HTMLElement, key: unknown): Snapshot {
  const nodes = children(list);
  const boxes = new Map<HTMLElement, { top: number; height: number }>();
  // Tops from the list's own top, so a scroll between renders is no move.
  const origin = list.getBoundingClientRect().top;
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    boxes.set(node, { top: r.top - origin, height: r.height });
  }
  return { nodes, boxes, key };
}

/**
 * Animates a list's direct children as they come and go, without React
 * having to keep removed items: a new item grows in (200ms, ease-out), a
 * removed one is put back in its place as an inert copy that folds away
 * (240ms on the collapse curve) while the items under it slide up, an item
 * that takes another's place (an undo slot for the routine it replaces, or
 * back) grows or shrinks from the old one's height, and a reorder slides each
 * item from where it was (FLIP). Items that fold themselves away first (an
 * expired undo slot) carry data-folded and are not copied. Returns the ref
 * for the list element.
 */
export function useListMotion<T extends HTMLElement = HTMLDivElement>({
  resetKey,
  kind = "row",
  fromEmpty = false,
}: ListMotionOptions = {}) {
  const ref = useRef<T>(null);
  const last = useRef<Snapshot | null>(null);
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) {
      last.current = null;
      return;
    }
    list.dataset.listMotion = "";
    const before = last.current;
    const now = snapshot(list, resetKey);
    last.current = now;
    if (!before || before.key !== resetKey) return;
    if (!before.nodes.length && !fromEmpty) return;
    const kept = new Set(now.nodes);
    const was = new Set(before.nodes);
    const added = now.nodes.filter((n) => !was.has(n));
    const removed = before.nodes.filter((n) => !kept.has(n));
    if (!added.length && !removed.length) {
      // Same items: a reorder slides each from where it was.
      if (reducedMotion()) return;
      if (before.nodes.some((n, i) => n !== now.nodes[i]))
        slideFrom(
          now.nodes.map((el) => ({
            el,
            dy:
              (before.boxes.get(el)?.top ?? 0) - (now.boxes.get(el)?.top ?? 0),
          })),
        );
      return;
    }
    if (added.length + removed.length > MAX_CHANGES) return;
    const timing =
      kind === "banner"
        ? {
            in: { duration: MOTION.bannerIn, easing: EASE.out },
            out: { duration: MOTION.bannerOut, easing: EASE.collapse },
          }
        : {
            in: { duration: MOTION.rowIn, easing: EASE.out },
            out: { duration: MOTION.rowOut, easing: EASE.collapse },
          };
    // The item that was before each removed one, to put it back after.
    const prevOf = (nodes: HTMLElement[], n: HTMLElement) =>
      nodes[nodes.indexOf(n) - 1] ?? null;
    const replaced = new Set<HTMLElement>();
    for (const el of added) {
      const prev = prevOf(now.nodes, el);
      const twin = removed.find(
        (r) => !replaced.has(r) && prevOf(before.nodes, r) === prev,
      );
      if (twin && !twin.hasAttribute("data-folded")) {
        replaced.add(twin);
        growIn(el, {
          duration: MOTION.bannerIn,
          easing: EASE.out,
          from: before.boxes.get(twin)?.height ?? 0,
        });
      } else growIn(el, timing.in);
    }
    for (const ghost of removed) {
      if (replaced.has(ghost) || ghost.hasAttribute("data-folded")) continue;
      // Back where it was, after the item that was before it (or first).
      const after = before.nodes
        .slice(0, before.nodes.indexOf(ghost))
        .reverse()
        .find((n) => n.parentElement === list);
      list.insertBefore(
        ghost,
        after ? after.nextSibling : list.firstElementChild,
      );
      ghost.setAttribute("data-list-ghost", "");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      ghost.style.pointerEvents = "none";
      void settled(foldAway(ghost, timing.out)).then(() => ghost.remove());
    }
  });
  return ref;
}
