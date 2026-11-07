import type { ReactNode } from "react";
import { Layers, Play } from "lucide-react";

type Props = {
  title: ReactNode;
  /** A muted line: exercises, length, when it was last done. */
  meta?: ReactNode;
  /** A second muted line, such as the exercise names. */
  detail?: ReactNode;
  /** What tapping the card does (preview or edit), and its spoken name. */
  onOpen: () => void;
  openLabel: string;
  onStart: () => void;
  startLabel: string;
  disabled?: boolean;
  /** Extra controls before the play button, such as ⋯. */
  actions?: ReactNode;
};

/**
 * The routine item: a card on surface-2 (20px corners) with a 44px layers
 * tile, the name and a muted line, and a round 44px play button that starts
 * it. Tapping the rest of the card opens the routine.
 */
export default function RoutineCard({
  title,
  meta,
  detail,
  onOpen,
  openLabel,
  onStart,
  startLabel,
  disabled,
  actions,
}: Props) {
  return (
    <div className="routine-card">
      <button
        type="button"
        className="routine-card-open"
        aria-label={openLabel}
        onClick={onOpen}
      >
        <span className="routine-tile" aria-hidden="true">
          <Layers size={22} />
        </span>
        <span className="routine-card-text">
          <span className="routine-card-title">{title}</span>
          {meta && <span className="routine-card-meta">{meta}</span>}
          {detail && <span className="routine-card-meta">{detail}</span>}
        </span>
      </button>
      {actions}
      <button
        type="button"
        className="routine-play"
        aria-label={startLabel}
        disabled={disabled}
        onClick={onStart}
      >
        <Play size={18} fill="currentColor" stroke="none" aria-hidden="true" />
      </button>
    </div>
  );
}
