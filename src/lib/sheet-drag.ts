import { MOTION } from "./motion";

/**
 * The bottom sheet's drag (components/ui/dialog.tsx), as pure maths so it is
 * tested. A sheet follows the finger 1:1 from its handle or its title, and
 * from anywhere in it while its content is scrolled to the top; released, it
 * closes past CLOSE_DISTANCE or on a downward fling faster than CLOSE_SPEED,
 * else it springs back (SPRING.settle).
 */

/** How far (px) a sheet must be pulled to close when let go. */
export const CLOSE_DISTANCE = 90;
/** How fast (px/ms, downward) a flick closes it from any distance. */
export const CLOSE_SPEED = 0.6;
/** Movement (px) before a press becomes a drag, a scroll or a tap. */
export const DRAG_SLOP = 6;
/** Pulled up, the sheet gives a little and stops (iOS's rubber band). */
const UP_GIVE = 0.2;
const UP_MAX = 24;

export type DragIntent = "pending" | "drag" | "none";

/**
 * What a press that has moved (dx, dy) from where it started becomes: a sheet
 * drag (down, mostly vertical, from the handle or title or with the content
 * at its top), nothing for the sheet (sideways, up into the content, or down
 * a scrolled list) or still undecided.
 */
export function dragIntent({
  dx,
  dy,
  fromTop,
  atTop,
}: {
  dx: number;
  dy: number;
  /** The press started on the handle or the title. */
  fromTop: boolean;
  /** The sheet's content is scrolled to its top. */
  atTop: boolean;
}): DragIntent {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < DRAG_SLOP && ay < DRAG_SLOP) return "pending";
  if (ax > ay) return "none";
  if (dy < 0) return fromTop ? "drag" : "none";
  return fromTop || atTop ? "drag" : "none";
}

/**
 * Whether the browser should be kept from scrolling the sheet's content while
 * a press is undecided: a downward, mostly vertical move that may become a
 * drag (iOS decides on the first touchmove whether it scrolls).
 */
export function holdsScroll({
  dx,
  dy,
  fromTop,
  atTop,
}: {
  dx: number;
  dy: number;
  fromTop: boolean;
  atTop: boolean;
}) {
  if (fromTop) return Math.abs(dy) >= Math.abs(dx);
  return atTop && dy > 0 && dy >= Math.abs(dx);
}

/** Where the sheet is drawn for a finger `dy` px below where the drag began. */
export function sheetOffset(dy: number) {
  if (dy >= 0) return dy;
  return -Math.min(UP_MAX, -dy * UP_GIVE);
}

/** The finger's speed (px/ms, + is down) over the last ~80ms of samples. */
export function releaseSpeed(samples: readonly { y: number; t: number }[]) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let i = samples.length - 2; i >= 0; i--) {
    first = samples[i];
    if (last.t - samples[i].t >= 80) break;
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

/** Let go at `offset` px moving at `speed` px/ms: close or spring back. */
export function sheetRelease(offset: number, speed: number) {
  if (speed > CLOSE_SPEED) return "close" as const;
  // Past the distance, a flick back up still keeps it open.
  if (offset > CLOSE_DISTANCE && speed > -CLOSE_SPEED / 2)
    return "close" as const;
  return "back" as const;
}

/**
 * How long the rest of the way down takes after a release: the close time
 * for what is left of the sheet's height, and no slower than the finger was
 * going (FLING_SLOPE is the close curve's starting slope).
 */
export const FLING_EASE = "cubic-bezier(0.3, 0.6, 0.6, 1)";
const FLING_SLOPE = 2;
export function closeDuration(offset: number, height: number, speed: number) {
  const left = Math.max(0, height - Math.max(0, offset));
  const share = height > 0 ? left / height : 1;
  const time = MOTION.sheetOut * share;
  const fling = speed > 0 ? (FLING_SLOPE * left) / speed : Infinity;
  return Math.round(
    Math.max(MOTION.reduced, Math.min(MOTION.sheetOut, time, fling)),
  );
}
