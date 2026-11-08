import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import ExerciseAvatar from "./ExerciseAvatar";
import { useLongPress } from "@/hooks/useLongPress";
import { useTipTarget } from "@/hooks/useTipTarget";
import type { TipId } from "@/lib/tips";

type Props = {
  exerciseId: string;
  /** The main category, when known; the avatar looks it up otherwise. */
  category?: string;
  equipment?: string;
  title: ReactNode;
  /** A muted second line. */
  meta?: ReactNode;
  /** The row opens this page. */
  to?: string;
  /** The row is a button (with `pressed` for a toggle). */
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  /** An accessible name for the link or button, when the text alone isn't enough. */
  label?: string;
  /** Inside the row at its end (a sparkline, a check). Without it a link or button row shows a chevron. */
  end?: ReactNode;
  /** Controls beside the row, outside its link or button (⋯, Unhide). */
  actions?: ReactNode;
  className?: string;
  /**
   * Press and hold opens the row's menu (a flat row never swipes); the
   * same actions are on its ⋯ or the exercise page.
   */
  onLongPress?: (anchor: HTMLElement) => void;
  /** The tip that points the hold out, on the first row. */
  tip?: TipId;
};

/**
 * The exercise item: a flat row (no card) with the exercise's avatar, its
 * name, a muted line and a chevron. Rows sit in a `.flat-list`, separated by
 * hairlines. Used in Library, the picker, Progress and plan lists.
 */
export default function ExerciseRow({
  exerciseId,
  category,
  equipment,
  title,
  meta,
  to,
  onClick,
  pressed,
  disabled,
  label,
  end,
  actions,
  className,
  onLongPress,
  tip,
}: Props) {
  const hold = useLongPress(onLongPress, tip);
  const tipRef = useTipTarget<HTMLDivElement>(tip);
  const content = (
    <>
      <ExerciseAvatar
        exerciseId={exerciseId}
        category={category}
        equipment={equipment}
      />
      <span className="ex-row-text">
        <span className="ex-row-title">{title}</span>
        {meta && <span className="ex-row-meta">{meta}</span>}
      </span>
      {end ??
        ((to || onClick) && !actions && (
          <ChevronRight className="chev" size={20} aria-hidden="true" />
        ))}
    </>
  );
  const main = to ? (
    <Link className="ex-row-main" to={to} aria-label={label}>
      {content}
    </Link>
  ) : onClick ? (
    <button
      type="button"
      className="ex-row-main"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <span className="ex-row-main">{content}</span>
  );
  return (
    <div
      ref={tipRef}
      className={
        "ex-row" +
        (pressed ? " is-pressed" : "") +
        (onLongPress ? " long-press" : "") +
        (className ? " " + className : "")
      }
      {...hold}
    >
      {main}
      {actions}
    </div>
  );
}
