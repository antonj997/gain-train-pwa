/** What window.visualViewport reports, or null where there is none. */
export type VisualViewportReading = {
  height: number;
  offsetTop: number;
  scale: number;
} | null;

export type ViewportMetrics = {
  /** The visible height (--viewport-height). */
  height: number;
  /** How far the visible area is scrolled down the layout viewport (--viewport-top). */
  top: number;
  /**
   * How far the visible area's bottom edge sits above the layout viewport's
   * (--viewport-bottom): what `bottom` a fixed bar needs to rest on the screen's
   * bottom edge. Negative when the visible area has slid below the layout
   * viewport, as iPhone does while a page scrolls with a field focused, or
   * after its keyboard closes; positive above an on-screen keyboard.
   */
  bottom: number;
  /** An on-screen keyboard covers the lower part of the screen. */
  keyboardOpen: boolean;
};

/** A keyboard is at least this tall; a smaller gap is a bar or rounding. */
const KEYBOARD_MIN = 140;

/**
 * The visible area against the layout viewport that `position: fixed` uses.
 * While the page is pinch-zoomed nothing follows the visible area, so the
 * browser's own panning shows the bars where they are.
 */
export function viewportMetrics(
  innerHeight: number,
  viewport: VisualViewportReading,
  editing: boolean,
): ViewportMetrics {
  const unzoomed = !viewport || Math.abs(viewport.scale - 1) < 0.05;
  if (!viewport || !unzoomed)
    return { height: innerHeight, top: 0, bottom: 0, keyboardOpen: false };
  const { height, offsetTop: top } = viewport;
  // Whole pixels: subpixel noise would restyle the page on every scroll.
  const bottom = Math.round(innerHeight - top - height);
  return {
    height,
    top,
    bottom: Object.is(bottom, -0) ? 0 : bottom,
    keyboardOpen: editing && innerHeight - height > KEYBOARD_MIN,
  };
}
