import { useState } from "react";
import type { SetBadgeInfo } from "@/data/drops";

/**
 * The set's badge: its number, or W, C or a drop arrow. It is a 44 px button
 * that opens the Set sheet; the coloured chip inside is smaller than the target.
 * When its number changes (a set above was deleted) the old one fades out as
 * the new one fades in, 120 ms.
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
  const [shown, setShown] = useState<{ text: string; old: string | null }>({
    text: badge.text,
    old: null,
  });
  if (shown.text !== badge.text) setShown({ text: badge.text, old: shown.text });
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
        {shown.old === null ? (
          badge.text
        ) : (
          <>
            <span key={shown.text} className="set-badge-in">
              {badge.text}
            </span>
            <span
              className="set-badge-out"
              onAnimationEnd={() => setShown((s) => ({ ...s, old: null }))}
            >
              {shown.old}
            </span>
          </>
        )}
      </span>
    </button>
  );
}
