/**
 * The rootMargin that leaves out the area under the sticky top bar. Safari
 * rejects anything that is not a plain length (for example "--5px" or
 * "-NaNpx"), and an invalid value throws, so clamp to a whole, finite number.
 */
export function topBarRootMargin(covered: number) {
  const px = Number.isFinite(covered) ? Math.max(0, Math.ceil(covered)) : 0;
  return px ? `-${px}px 0px 0px 0px` : "0px";
}
