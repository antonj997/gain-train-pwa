import type { SetBadgeInfo } from "@/data/drops";

/**
 * The set's badge: its number, or W, C or a drop arrow. It is a 44 px button
 * that opens the Set sheet; the coloured chip inside is smaller than the target.
 */
export default function SetBadge({
  badge,
  editing = false,
  onClick,
}: {
  badge: SetBadgeInfo;
  /** The Set sheet is open for this set. */
  editing?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`set-badge${editing ? " is-editing" : ""}`}
      data-tone={badge.tone}
      aria-label={badge.label}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      <span className="set-badge-chip" aria-hidden="true">
        {badge.text}
      </span>
    </button>
  );
}
