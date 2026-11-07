export type DayCellState = {
  /** A workout was logged: filled with the done colour. */
  trained?: boolean;
  /** Today: an accent ring. */
  today?: boolean;
  /** Planned and not yet trained: a done-coloured outline. */
  planned?: boolean;
  /** Workouts that day; two or more show the count badge. */
  count?: number;
};

/**
 * The CSS classes of a day cell, for cells that need their own element (the
 * History grids add selection states on top). Rest and empty days are
 * surface-2.
 */
export function dayCellClass(
  { trained, today, planned }: DayCellState,
  size: "grid" | "week" | "month",
) {
  return (
    `day-cell is-${size}` +
    (trained ? " is-trained" : planned ? " is-planned" : "") +
    (today ? " is-today" : "")
  );
}
