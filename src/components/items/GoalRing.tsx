import type { ReactNode } from "react";

type Props = {
  /** 0 to 1. */
  fraction: number;
  size?: 44 | 60;
  /** The progress bar's spoken name. */
  label: string;
  /** Shown in the middle, such as “82%”. */
  children?: ReactNode;
  /** Drawn in the done colour once reached. */
  done?: boolean;
};

/** The goal item: a progress ring, accent on a surface-2 track. */
export default function GoalRing({
  fraction,
  size = 60,
  label,
  children,
  done,
}: Props) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const stroke = size === 60 ? 6 : 5;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  return (
    <span
      className={"goal-ring" + (done ? " is-done" : "")}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          className="goal-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
        />
        {clamped > 0 && (
          <circle
            className="goal-ring-value"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={`${clamped * length} ${length}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {children !== undefined && (
        <span className="goal-ring-text" aria-hidden="true">
          {children}
        </span>
      )}
    </span>
  );
}
