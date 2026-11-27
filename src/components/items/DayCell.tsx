import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { dayCellClass, type DayCellState } from "./day-cell";

/** The count badge on a day with two or more workouts. */
export function DayCount({ count }: { count?: number }) {
  return count && count >= 2 ? (
    <span className="day-count" aria-hidden="true">
      {count}
    </span>
  ) : null;
}

/**
 * The moved badge (v6 A2, R8-1): a 20 px ink circle in the count badge's
 * shape, with an arrow in a 3 px line. It sits in the corner on the side the
 * workout came from and points the way it moved: from an earlier day it is
 * top-left pointing right, from a later day top-right pointing left. `inline`
 * draws it smaller in a legend.
 */
export function MovedBadge({
  side,
  inline,
}: {
  side: "left" | "right";
  inline?: boolean;
}) {
  return (
    <span
      className={`moved-badge is-${side}${inline ? " is-inline" : ""}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={inline ? 10 : 12}
        height={inline ? 10 : 12}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M4 12h14M13 6l6 6-6 6"
          transform={
            side === "right" ? "translate(24 0) scale(-1 1)" : undefined
          }
        />
      </svg>
    </span>
  );
}

type Props = DayCellState & {
  size: "grid" | "week" | "month";
  /** A button, or a plain decorative span. */
  as?: "button" | "span";
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/**
 * The day item, one shape in every calendar: the Train week strip, the
 * History grid and month calendar and the plan's week. 12px squares in the
 * grid, 44px cells elsewhere; the states never change.
 */
const DayCell = forwardRef<HTMLButtonElement, Props>(function DayCell(
  {
    size,
    as = "span",
    trained,
    today,
    planned,
    missed,
    plannedToday,
    moved,
    todayDot,
    count,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes =
    dayCellClass(
      { trained, today, planned, missed, plannedToday, moved, todayDot },
      size,
    ) + (className ? " " + className : "");
  const inner = (
    <>
      {children}
      {moved && size !== "grid" ? <MovedBadge side={moved} /> : null}
      <DayCount count={count} />
    </>
  );
  if (as === "button")
    return (
      <button ref={ref} type="button" className={classes} {...rest}>
        {inner}
      </button>
    );
  return (
    <span className={classes} aria-hidden={rest["aria-hidden"]}>
      {inner}
    </span>
  );
});

export default DayCell;
