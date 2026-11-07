import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import DateTile from "./DateTile";

type Props = {
  date: string;
  title: ReactNode;
  /** A muted line: length, sets, exercises. */
  meta?: ReactNode;
  /** After the muted line, such as a record pill. */
  badge?: ReactNode;
  onClick: () => void;
  selected?: boolean;
};

/**
 * The workout item: a date tile, the name and a muted line, and a chevron.
 * Rows sit in a `.grouped` box (one per week) with hairlines between them.
 */
export default function WorkoutRow({
  date,
  title,
  meta,
  badge,
  onClick,
  selected,
}: Props) {
  return (
    <button
      type="button"
      className={"workout-row" + (selected ? " is-selected" : "")}
      onClick={onClick}
    >
      <DateTile date={date} />
      <span className="workout-row-text">
        <span className="workout-row-title">{title}</span>
        {(meta || badge) && (
          <span className="workout-row-meta">
            {meta}
            {badge}
          </span>
        )}
      </span>
      <ChevronRight className="chev" size={20} aria-hidden="true" />
    </button>
  );
}
