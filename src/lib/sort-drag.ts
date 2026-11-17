/**
 * Geometry for dragging a row in a sortable list. The list's DOM order stays
 * put while a row is held: the held row follows the finger, and the rows it
 * passes slide one slot out of its way. Positions are the rows' tops and
 * heights when the row was picked up.
 */
export type Slots = { tops: number[]; heights: number[] };

/** How far a held row and its neighbours move: its height plus the gap after it. */
export function slotPitch({ tops, heights }: Slots, from: number) {
  const gap =
    tops.length > 1
      ? Math.max(0, tops[1] - (tops[0] + heights[0]))
      : 0;
  return heights[from] + gap;
}

/**
 * Where the row at `index` sits while the row from `from` is held over
 * `target`: the rows between slide up (moving down) or down (moving up).
 */
export function slotShift(
  index: number,
  from: number,
  target: number,
  pitch: number,
) {
  if (index === from) return 0;
  if (from < target && index > from && index <= target) return -pitch;
  if (target < from && index >= target && index < from) return pitch;
  return 0;
}

/** How far the held row moves to land in `target`'s slot. */
export function dropOffset({ tops, heights }: Slots, from: number, target: number) {
  if (target === from) return 0;
  if (target < from) return tops[target] - tops[from];
  return tops[target] + heights[target] - heights[from] - tops[from];
}

/** The list in its new order, `from` moved to `target`. */
export function moveItem<T>(items: readonly T[], from: number, target: number) {
  const result = [...items];
  if (from === target || from < 0 || from >= items.length) return result;
  const [item] = result.splice(from, 1);
  result.splice(Math.max(0, Math.min(target, result.length)), 0, item);
  return result;
}
