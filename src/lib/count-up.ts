// The Finish sheet's numbers count up from 0 (mockup v5, B6): 500 ms, a
// cubic ease-out. Pure, so it is tested (tests/count-up.test.ts); the
// component that plays it is FinishSheet's CountUp.

/** How long a number counts up, before the admin slow motion. */
export const COUNT_UP_MS = 500;

/** The cubic ease-out: fast at first, settling at 1. */
export const easeOutCubic = (progress: number) => {
  const p = Math.min(1, Math.max(0, progress));
  return 1 - Math.pow(1 - p, 3);
};

/**
 * The value shown `elapsed` ms into a count up to `to` lasting `duration` ms:
 * whole numbers, or `decimals` places. Exactly `to` at the end, and never past it.
 */
export function countUpValue(
  to: number,
  elapsed: number,
  duration = COUNT_UP_MS,
  decimals = 0,
) {
  if (!(duration > 0) || elapsed >= duration) return to;
  const factor = 10 ** decimals;
  const value = Math.round(to * easeOutCubic(elapsed / duration) * factor);
  return Math.min(to, value / factor);
}
