/**
 * Taps on a checked (locked) row's fields. In a live workout (v6 B2) the
 * first tap already shakes the row and shows the toast at the workout's foot
 * (lockedTapMessage), so nothing moves under the finger. Where there is no
 * toast slot, one tap is ignored without a word and a second tap on the same
 * row within LOCKED_TAP_MS shows the notice under it ("Uncheck this set to
 * edit its values."). Pure, so it is tested; the row is
 * components/workout/SetLine.tsx.
 */
import { t } from "../i18n";

/** The toast a first tap on a checked set shows (v6 B2). */
export const lockedTapMessage = () => t("set.lockedToast");

/** A checked field's accessible name (v6 B2). */
export const lockedFieldName = () => t("set.lockedField");

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
