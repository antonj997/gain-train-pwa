/**
 * Plays every animation on the page slower while slow motion is on. Each frame
 * (and as soon as a CSS animation or transition starts) it sets playbackRate
 * = 1/scale on everything `document.getAnimations()` returns: CSS transitions
 * and keyframes, Web Animations and, where the browser lists them, the
 * ::view-transition pseudo-elements' animations. It also publishes the scale
 * as --gt-motion-scale on <html>. Off, nothing runs at all.
 */

const ROOT_PROPERTY = "--gt-motion-scale";

const animationsOf = (doc: Document): Animation[] => {
  try {
    return typeof doc.getAnimations === "function" ? doc.getAnimations() : [];
  } catch {
    return [];
  }
};

const setRate = (animation: Animation, rate: number) => {
  // A reversed animation keeps its direction.
  const next = animation.playbackRate < 0 ? -rate : rate;
  if (animation.playbackRate === next) return;
  try {
    animation.playbackRate = next;
  } catch {
    // An animation is never worth an error.
  }
};

/** The running player's sweep, for a caller that has just started animations. */
let activeSweep: (() => void) | null = null;

/**
 * Slows what has just started at once instead of on the next frame (the
 * view transition calls it when its pseudo-elements start). Off, a no-op.
 */
export function sweepSlowMotion() {
  activeSweep?.();
}

/** Starts slowing animations by `scale`; returns the function that stops it. */
export function startSlowMotion(scale: number, doc: Document = document) {
  const root = doc.documentElement;
  const rate = 1 / scale;
  root.style.setProperty(ROOT_PROPERTY, String(scale));
  root.dataset.slowMotion = String(scale);

  const sweep = () => {
    for (const animation of animationsOf(doc)) setRate(animation, rate);
  };
  let frame = 0;
  const loop = () => {
    sweep();
    frame = requestAnimationFrame(loop);
  };
  const events = ["animationstart", "transitionrun", "transitionstart"];
  for (const name of events) doc.addEventListener(name, sweep, true);
  activeSweep = sweep;
  sweep();
  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    if (activeSweep === sweep) activeSweep = null;
    for (const name of events) doc.removeEventListener(name, sweep, true);
    // Whatever is still running finishes at normal speed.
    for (const animation of animationsOf(doc))
      if (Math.abs(animation.playbackRate) === rate) setRate(animation, 1);
    root.style.removeProperty(ROOT_PROPERTY);
    delete root.dataset.slowMotion;
  };
}
