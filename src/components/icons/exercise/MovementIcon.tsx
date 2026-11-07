import { MOVEMENT_SHAPES, type Movement } from "./paths";

/**
 * One movement icon (see paths.ts), drawn in the current text colour like a
 * Lucide icon. Decorative: the exercise's name always sits next to it.
 */
export default function MovementIcon({
  movement,
  size = 22,
  className,
}: {
  movement: Movement;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-movement={movement}
    >
      {MOVEMENT_SHAPES[movement].map((shape, index) =>
        typeof shape === "string" ? (
          <path key={index} d={shape} />
        ) : (
          <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ),
      )}
    </svg>
  );
}
