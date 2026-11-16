/**
 * Taps on a checked (locked) row's fields in a live workout. One tap is
 * ignored without a word: it is usually a stray touch, or a finger on its way
 * to scroll. A second tap on the same row within LOCKED_TAP_MS shows the
 * notice ("Uncheck this set to edit its values."). Pure, so it is tested; the
 * row is components/workout/SetLine.tsx.
 */

/** How close together two taps must be to count as trying again. */
export const LOCKED_TAP_MS = 2000;

/** The row's last tap and how many came in a row; null before the first. */
export type LockedTaps = { at: number; count: number } | null;

/** One more tap at `now`: the row's new count, and whether the notice shows. */
export function lockedTap(
  taps: LockedTaps,
  now: number,
  windowMs = LOCKED_TAP_MS,
): { taps: LockedTaps; warn: boolean } {
  const again = !!taps && now >= taps.at && now - taps.at <= windowMs;
  const count = again ? taps.count + 1 : 1;
  return { taps: { at: now, count }, warn: count >= 2 };
}
