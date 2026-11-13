import { springValues } from "./spring";

/**
 * The app's motion table (mockup v5, System → Motion; DESIGN.md → Motion) as
 * numbers for Web Animations. CSS has the same values as tokens in
 * tokens.css (--gt-dur-*, --gt-ease-*); tests/motion-tokens.test.ts keeps the
 * two equal. Everything runs through `play`, so the admin slow motion slows it
 * (the player rates every document animation) and reduced motion turns it
 * into one short fade.
 */
export const MOTION = {
  /** Reduced motion: every movement becomes a fade this long. */
  reduced: 120,
  press: 60,
  tick: 120,
  stroke: 160,
  roll: 160,
  slot: 180,
  next: 180,
  sweep: 240,
  sheen: 600,
  rowIn: 200,
  /** A removed item folds away; the items under it slide up. */
  rowOut: 240,
  sheetIn: 340,
  sheetOut: 240,
  /** The sheet's backdrop fades in and out. */
  scrim: 200,
  /** A banner, an inline message or an undo slot grows open… */
  bannerIn: 220,
  /** …and folds away. */
  bannerOut: 180,
  dockIn: 240,
  dockOut: 200,
  dockSwap: 180,
  pop: 200,
  pulse: 300,
  page: 260,
  rise: 200,
  riseStep: 15,
  morph: 300,
  morphOut: 180,
  morphIn: 220,
  /** The day sheet's date steps 12px. */
  step: 200,
  lap: 1200,
  turn: 5000,
  live: 2000,
  theme: 650,
  themeFade: 500,
  quick: 150,
  /** A swiped item settles back or opens on its buttons. */
  settle: 320,
  open: 280,
  /** The swipe's threshold pop, its ring and the set bin's lead-in. */
  arm: 220,
  ring: 380,
  binLead: 200,
  /** A deleted set: the row slides out, the bin gulps, the row folds. */
  binSlide: 220,
  binGulp: 330,
} as const;

export const EASE = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  sheet: "cubic-bezier(0.32, 0.72, 0, 1)",
  sweep: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  collapse: "cubic-bezier(0.3, 0, 0.2, 1)",
  /** A swiped item's settle, with a little overshoot. */
  swipe: "cubic-bezier(0.2, 1.3, 0.4, 1)",
  swipeOpen: "cubic-bezier(0.2, 0.9, 0.3, 1)",
  gulp: "cubic-bezier(0.3, 0.7, 0.2, 1)",
} as const;

/** Springs as stiffness / damping per unit mass. */
export const SPRING = {
  check: [520, 26],
  record: [400, 22],
  settle: [380, 34],
  /** A planned day lifts in the week strip and drops into another. */
  lift: [400, 26],
  drop: [380, 30],
} as const;

type Frame = Record<string, string | number | null | undefined>;

/**
 * What reduced motion plays instead of `keyframes`: a fade out when the
 * movement ends hidden (opacity 0), else a short fade in.
 */
export function reducedFrames(keyframes: Frame[]): Frame[] {
  const last = keyframes[keyframes.length - 1] ?? {};
  return Number(last.opacity) === 0 && last.opacity !== undefined
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ opacity: 0.35 }, { opacity: 1 }];
}

/**
 * Keyframes that follow a spring from `from` to `to`, sampled at 60 fps,
 * each mapped to a frame by `frame`; play them linearly for `duration` ms.
 */
export function springFrames(
  [k, c]: readonly [number, number],
  from: number,
  to: number,
  frame: (value: number) => Frame,
  velocity = 0,
) {
  const { values, duration } = springValues(k, c, from, to, velocity);
  return { keyframes: values.map(frame), duration: Math.round(duration) };
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type PlayOptions = KeyframeAnimationOptions & {
  /** Information, not decoration: kept as it is under reduced motion. */
  keep?: boolean;
};

/**
 * Plays keyframes on an element with Web Animations; under reduced motion a
 * 120 ms fade instead (unless `keep`). Null when the element cannot animate.
 */
export function play(
  element: Element | null | undefined,
  keyframes: Frame[],
  { keep, ...options }: PlayOptions = {},
): Animation | null {
  if (!element || typeof (element as HTMLElement).animate !== "function")
    return null;
  try {
    if (!keep && prefersReduced())
      return element.animate(reducedFrames(keyframes) as Keyframe[], {
        duration: MOTION.reduced,
        easing: "linear",
        fill: options.fill === "forwards" ? "forwards" : "none",
      });
    return element.animate(keyframes as Keyframe[], {
      easing: "ease-out",
      ...options,
    });
  } catch {
    // An animation is never worth an error.
    return null;
  }
}

/** Plays a spring (see springFrames) on an element. */
export function playSpring(
  element: Element | null | undefined,
  spring: readonly [number, number],
  from: number,
  to: number,
  frame: (value: number) => Frame,
  { velocity = 0, ...options }: PlayOptions & { velocity?: number } = {},
) {
  const { keyframes, duration } = springFrames(
    spring,
    from,
    to,
    frame,
    velocity,
  );
  return play(element, keyframes, { duration, easing: "linear", ...options });
}

/** Resolves when an animation ends or is cancelled (null at once). */
export const settled = (animation: Animation | null) =>
  animation ? animation.finished.then(noop, noop) : Promise.resolve();
const noop = () => {};
