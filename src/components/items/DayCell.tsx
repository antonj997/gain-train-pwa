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
 * grid, 36–44px cells elsewhere; the states never change.
 */
const DayCell = forwardRef<HTMLButtonElement, Props>(function DayCell(
  {
    size,
    as = "span",
    trained,
    today,
    planned,
    count,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes =
    dayCellClass({ trained, today, planned }, size) +
    (className ? " " + className : "");
  const inner = (
    <>
      {children}
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
