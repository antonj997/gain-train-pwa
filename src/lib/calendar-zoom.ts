/**
 * The geometry of the Calendar card's zoom between the compact year grid and
 * the month calendar (src/components/HistoryCalendar.tsx). Each day of the
 * month flies from its square in the compact grid to its cell in the month
 * grid and grows on the way (a FLIP: the cell is drawn in its month place and
 * a transform puts it back on the square first). Days with no square there,
 * or with one scrolled out of sight, fade in instead. Pure, so it is tested
 * (tests/calendar-zoom.test.ts); the component measures and plays.
 */

export type Rect = { left: number; top: number; width: number; height: number };

/** The share of the zoom's duration each part takes, and when it starts. */
export const ZOOM_PARTS = {
  /** A day's flight. Rows start one stagger step apart. */
  flight: 0.85,
  /** The day number shows in the second half of the way in, and goes early on the way out. */
  number: 1,
  /** The compact grid scales past and fades out (in reverse on the way back). */
  layer: 0.7,
  layerScale: 2.6,
  /** Collapsing, the compact grid waits this share before it comes back. */
  layerDelayBack: 0.2,
  /** The weekday heads and the days that fade in, after this share. */
  fade: 0.5,
  fadeDelay: 0.45,
  /** The card's height. */
  height: 0.85,
} as const;

/** The transform that draws a box laid out at `to` over `from`; its origin is the top left corner. */
export function flipTransform(from: Rect, to: Rect) {
  const sx = to.width ? from.width / to.width : 1;
  const sy = to.height ? from.height / to.height : 1;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `translate(${round(from.left - to.left)}px, ${round(from.top - to.top)}px) scale(${round(sx)}, ${round(sy)})`;
}

/** Whether a box lies wholly inside `clip` (the visible part of the sideways-scrolling grid). */
export function insideRect(box: Rect, clip: Rect, slack = 0.5) {
  return (
    box.width > 0 &&
    box.left >= clip.left - slack &&
    box.top >= clip.top - slack &&
    box.left + box.width <= clip.left + clip.width + slack &&
    box.top + box.height <= clip.top + clip.height + slack
  );
}

/**
 * When a row of days sets off: rows go one `step` apart from the top as the
 * calendar opens, and from the bottom as it closes, so the reverse mirrors it.
 */
export function rowDelay(
  week: number,
  weeks: number,
  expanding: boolean,
  step: number,
) {
  return (expanding ? week : weeks - 1 - week) * step;
}

export type ZoomPlan = {
  /** Days that fly between a square in the compact grid and their month cell. */
  flights: { date: string; from: Rect; to: Rect }[];
  /** Days that fade in or out in place. */
  fades: string[];
  /** The centre of the squares that fly, relative to `layer`: the compact grid zooms about it. */
  origin: { x: number; y: number } | null;
};

/**
 * Which month days fly and which fade. `cells` are the month calendar's days
 * with their boxes; `squares` the compact grid's days by date; `clip` the
 * visible part of the compact grid; `layer` the compact grid's own box.
 */
export function zoomPlan(
  cells: readonly { date: string; box: Rect }[],
  squares: ReadonlyMap<string, Rect>,
  clip: Rect,
  layer: Rect,
): ZoomPlan {
  const flights: ZoomPlan["flights"] = [];
  const fades: string[] = [];
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { date, box } of cells) {
    const square = squares.get(date);
    if (square && insideRect(square, clip)) {
      flights.push({ date, from: square, to: box });
      left = Math.min(left, square.left);
      top = Math.min(top, square.top);
      right = Math.max(right, square.left + square.width);
      bottom = Math.max(bottom, square.top + square.height);
    } else fades.push(date);
  }
  const origin = flights.length
    ? {
        x: Math.round(((left + right) / 2 - layer.left) * 10) / 10,
        y: Math.round(((top + bottom) / 2 - layer.top) * 10) / 10,
      }
    : null;
  return { flights, fades, origin };
}
