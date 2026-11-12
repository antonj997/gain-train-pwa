/**
 * A press on a set's load or reps field that moves up or down steps the value
 * (the number pad's ±2.5 kg or ±1 rep) without opening the pad. Pure, so it
 * is tested; set-input.ts reads the pointer.
 */

/** How far (px) a finger moves on a field per step when dragging it. */
export const DRAG_STEP_PX = 14;
/** How far (px) a finger must move up or down before the drag steps. */
export const DRAG_SLOP = 8;

/** The steps a drag from `startY` to `y` has made: up is more. */
export const dragSteps = (startY: number, y: number, px = DRAG_STEP_PX) =>
  Math.trunc((startY - y) / px);

/** Which way a press on a field turns out: still undecided, a step drag, or a selection. */
export function dragIntent(
  dx: number,
  dy: number,
  slop = DRAG_SLOP,
): "pending" | "step" | "select" {
  if (Math.abs(dy) >= slop && Math.abs(dy) > Math.abs(dx)) return "step";
  if (Math.abs(dx) >= 4 && Math.abs(dx) >= Math.abs(dy)) return "select";
  return "pending";
}
