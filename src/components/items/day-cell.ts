export type DayCellState = {
  /** A workout was logged: filled with the done colour. */
  trained?: boolean;
  /** Today: an accent ring (a dot in the middle with `todayDot`). */
  today?: boolean;
  /** Planned and not yet trained: a neutral (`--gt-line-control`) ring. */
  planned?: boolean;
  /** A planned day that passed with nothing matched to it: a dashed ring. */
  missed?: boolean;
  /** Today's planned day, still to do: today's ring with a dot under the number. */
  plannedToday?: boolean;
  /**
   * The workout came here from another day: the corner badge sits on the
   * side it came from ("left" = an earlier day, the arrow points right).
   */
  moved?: "left" | "right";
  /** Today as a 4 px dot in the middle instead of a ring (the 12 px grids). */
  todayDot?: boolean;
  /** Workouts that day; two or more show the count badge. */
  count?: number;
};

/**
 * The CSS classes of a day cell, for cells that need their own element (the
 * History grids add selection states on top). Rest and empty days are
 * surface-2.
 */
export function dayCellClass(
  {
    trained,
    today,
    planned,
    missed,
    plannedToday,
    moved,
    todayDot,
  }: DayCellState,
  size: "grid" | "week" | "month",
) {
  return (
    `day-cell is-${size}` +
    (trained
      ? " is-trained"
      : planned
        ? " is-planned"
        : missed
          ? " is-missed"
          : "") +
    (today ? (todayDot ? " is-today-dot" : " is-today") : "") +
    (plannedToday && !trained && !todayDot ? " is-planned-today" : "") +
    (moved ? ` has-moved-${moved}` : "")
  );
}
