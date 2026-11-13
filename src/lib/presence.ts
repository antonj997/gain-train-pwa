import { EASE, MOTION, play, settled } from "./motion";

/**
 * Things that arrive and leave in the flow of a page: a banner, an inline
 * message, an undo slot or a list item grows open from no height (its
 * padding, border and the parent's gap too) and fades in, so what is under it
 * slides down; leaving, it folds back to nothing. Runs on `play`, so the admin
 * slow motion slows it and reduced motion makes it a 120ms fade.
 */

export type PresenceMotion = { duration?: number; easing?: string };

const SIDES = ["Top", "Bottom"] as const;

/** The parent's gap that this element brings with it, and on which side. */
function gapOf(el: HTMLElement) {
  const parent = el.parentElement;
  if (!parent) return null;
  const style = getComputedStyle(parent);
  if (!/flex|grid/.test(style.display)) return null;
  if (style.display.includes("flex") && style.flexDirection.startsWith("row"))
    return null;
  const gap = parseFloat(style.rowGap) || 0;
  if (!gap) return null;
  // The gap sits before an item, or after it when it is the first one.
  const side = el.previousElementSibling ? "Top" : "Bottom";
  if (!el.previousElementSibling && !el.nextElementSibling) return null;
  return { side, gap } as const;
}

/** The element's height, padding, border and margins as drawn now (px). */
function openFrame(el: HTMLElement) {
  const style = getComputedStyle(el);
  const frame: Record<string, string | number> = {
    height: `${el.getBoundingClientRect().height}px`,
    minHeight: style.minHeight,
    opacity: 1,
  };
  for (const side of SIDES) {
    frame[`padding${side}`] = style.getPropertyValue(
      `padding-${side.toLowerCase()}`,
    );
    frame[`border${side}Width`] = style.getPropertyValue(
      `border-${side.toLowerCase()}-width`,
    );
    frame[`margin${side}`] = style.getPropertyValue(
      `margin-${side.toLowerCase()}`,
    );
  }
  return frame;
}

/** The same element folded to nothing: no margins, and its share of the gap. */
function closedFrame(el: HTMLElement, open: Record<string, string | number>) {
  const frame: Record<string, string | number> = {
    height: "0px",
    minHeight: "0px",
    opacity: 0,
    paddingTop: "0px",
    paddingBottom: "0px",
    borderTopWidth: "0px",
    borderBottomWidth: "0px",
    marginTop: "0px",
    marginBottom: "0px",
  };
  const gap = gapOf(el);
  if (gap) frame[`margin${gap.side}`] = `${-gap.gap}px`;
  return frame;
}

const clip = (el: HTMLElement) => {
  const before = el.style.overflow;
  el.style.overflow = "hidden";
  return () => {
    el.style.overflow = before;
  };
};

/** Grows a just-added element open from no height (default: a banner, 220ms). */
export function growIn(
  el: HTMLElement | null | undefined,
  {
    duration = MOTION.bannerIn,
    easing = EASE.out,
    from,
  }: PresenceMotion & {
    /** Start from this height instead of nothing (one item replacing another). */
    from?: number;
  } = {},
) {
  if (!el || !el.isConnected) return null;
  const open = openFrame(el);
  const closed = closedFrame(el, open);
  const start =
    from === undefined
      ? closed
      : { ...open, height: `${from}px`, minHeight: "0px", opacity: 0 };
  const unclip = clip(el);
  const animation = play(el, [start, open], { duration, easing });
  void settled(animation).then(unclip);
  return animation;
}

/**
 * Folds an element away to no height (default: a banner, 180ms) and keeps it
 * folded until the caller removes it.
 */
export function foldAway(
  el: HTMLElement | null | undefined,
  { duration = MOTION.bannerOut, easing = EASE.collapse }: PresenceMotion = {},
) {
  if (!el || !el.isConnected) return null;
  const open = openFrame(el);
  clip(el);
  return play(el, [open, closedFrame(el, open)], {
    duration,
    easing,
    fill: "forwards",
  });
}

/**
 * Slides elements that moved from where they were drawn (`before`, page y)
 * to where they are now: the last step of a FLIP.
 */
export function slideFrom(
  moves: { el: HTMLElement; dy: number }[],
  { duration = MOTION.page, easing = EASE.out }: PresenceMotion = {},
) {
  for (const { el, dy } of moves)
    if (Math.abs(dy) >= 1)
      play(
        el,
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
        { duration, easing },
      );
}
