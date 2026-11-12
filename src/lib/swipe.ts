/**
 * The maths of a horizontal swipe on a boxed item (a routine card, a workout
 * in History's grouped box, a set row). Pure, so it is tested; the hook that
 * reads the pointer and moves the item is src/hooks/useSwipe.ts.
 *
 * Offsets are in px: negative is a swipe to the left, positive to the right.
 */

/** How far (px) a finger must move before the drag picks an axis. */
export const AXIS_SLOP = 8;
/**
 * How much more sideways than up or down a drag must be to swipe. Anything
 * closer is a scroll: vertical always wins an ambiguous drag.
 */
export const AXIS_RATIO = 1.3;
/** Past the threshold the item jumps this much further: the magnetic snap. */
export const SNAP_PULL = 10;
/** Once armed, the drag must come back this far under the threshold to disarm. */
export const DISARM_SLACK = 12;
/** A flick (px/ms) that opens a reveal side even short of its threshold. */
export const FLICK_SPEED = 0.45;
/** How far (px) an item must have moved for a fling to commit. */
export const FLING_MIN = 24;
/** How far a side with no action gives before it stops, as a rubber band. */
const NO_ACTION_GIVE = 36;

export type Axis = "pending" | "x" | "y";

/**
 * Which way a drag goes: undecided until it has moved AXIS_SLOP, then
 * sideways only when clearly more sideways than vertical.
 */
export function decideAxis(dx: number, dy: number, slop = AXIS_SLOP): Axis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.hypot(ax, ay) < slop) return "pending";
  return ax > ay * AXIS_RATIO ? "x" : "y";
}

/**
 * iOS's rubber band: past the free travel each further px moves less, and
 * the total never reaches `dimension`.
 */
export function rubberBand(overshoot: number, dimension: number, c = 0.55) {
  if (!(overshoot > 0) || !(dimension > 0)) return 0;
  return (1 - 1 / ((overshoot * c) / dimension + 1)) * dimension;
}

/**
 * One side of a swipe. "commit" acts on release past the threshold (start a
 * routine, delete a set); "reveal" opens buttons `max` px wide and stays open.
 */
export type SwipeSide = {
  kind: "commit" | "reveal";
  /** Where the side arms: commit on release, or open. */
  threshold: number;
  /** Free travel; past it the item resists. A reveal side opens to it. */
  max: number;
  /**
   * A commit side that brakes past its threshold: each further px of the
   * finger moves the item this much (a set row: 0.35).
   */
  band?: number;
  /**
   * A commit side that also acts on a fling outwards this fast (px/ms) once
   * it has moved FLING_MIN px, short of the threshold (a set row: 0.5).
   */
  fling?: number;
};
/** `left` is a swipe to the left (dx < 0); `right` a swipe to the right. */
export type SwipeConfig = { left?: SwipeSide | null; right?: SwipeSide | null };

const sideOf = (offset: number, config: SwipeConfig) =>
  (offset < 0 ? config.left : config.right) ?? null;

/** Where the item sits for a finger `raw` px from where the item started. */
export function resistedOffset(raw: number, config: SwipeConfig) {
  if (!raw) return 0;
  const sign = Math.sign(raw);
  const distance = Math.abs(raw);
  const side = sideOf(raw, config);
  if (!side) return sign * rubberBand(distance, NO_ACTION_GIVE);
  if (side.band !== undefined && distance > side.threshold)
    return sign * (side.threshold + (distance - side.threshold) * side.band);
  if (distance <= side.max) return raw;
  return sign * (side.max + rubberBand(distance - side.max, side.max));
}

/** Whether the side under the item is armed, with a little hysteresis. */
export function isArmed(offset: number, config: SwipeConfig, wasArmed = false) {
  const side = sideOf(offset, config);
  if (!side) return false;
  const distance = Math.abs(offset);
  return distance >= side.threshold - (wasArmed ? DISARM_SLACK : 0);
}

/** How far towards its threshold the item is, 0–1. */
export function swipeProgress(offset: number, config: SwipeConfig) {
  const side = sideOf(offset, config);
  if (!side || side.threshold <= 0) return 0;
  return Math.min(1, Math.abs(offset) / side.threshold);
}

/** The drawn offset: armed, the item snaps a little past the threshold. */
export function displayOffset(
  offset: number,
  config: SwipeConfig,
  armed: boolean,
) {
  const side = sideOf(offset, config);
  if (!armed || !side || side.kind !== "commit") return offset;
  const pulled = side.threshold + SNAP_PULL;
  return Math.abs(offset) < pulled ? Math.sign(offset) * pulled : offset;
}

export type Settle =
  | { action: "close" }
  | { action: "open"; side: "left" | "right"; offset: number }
  | { action: "commit"; side: "left" | "right" };

/**
 * What a release does. A commit side acts past its threshold, or on a fling
 * outwards when it allows one (`fling`: a set row; starting a routine must be
 * meant). A reveal side opens past its threshold or on a flick outwards, and
 * closes on a flick back.
 */
export function settle(
  offset: number,
  velocity: number,
  config: SwipeConfig,
): Settle {
  const side = sideOf(offset, config);
  const name = offset < 0 ? "left" : "right";
  if (!side || !offset) return { action: "close" };
  const distance = Math.abs(offset);
  const outward = Math.sign(velocity) === Math.sign(offset);
  const speed = Math.abs(velocity);
  if (side.kind === "commit")
    return distance >= side.threshold ||
      (side.fling !== undefined &&
        outward &&
        speed >= side.fling &&
        distance >= FLING_MIN)
      ? { action: "commit", side: name }
      : { action: "close" };
  if (speed >= FLICK_SPEED && !outward) return { action: "close" };
  if (distance >= side.threshold || (speed >= FLICK_SPEED && outward))
    return { action: "open", side: name, offset: Math.sign(offset) * side.max };
  return { action: "close" };
}

/** A commit side's threshold for an item `width` px wide: about a third, 72–110px. */
export const commitThreshold = (width: number) =>
  Math.round(Math.min(110, Math.max(72, width * 0.3)));

/** The set-delete bubble's scale while dragging: grows to 0.82, full at the threshold. */
export const bubbleScale = (progress: number, armed: boolean) =>
  armed ? 1 : Math.max(0, Math.min(1, progress)) * 0.82;
