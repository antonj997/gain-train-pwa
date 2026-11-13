import { useEffect, useLayoutEffect, useRef } from "react";
import { runUndo } from "@/lib/message-store";
import { UNDO_MS, type UndoEntry } from "@/lib/messages";
import { motionScale } from "@/lib/slow-motion";
import { MOTION } from "@/lib/motion";
import { foldAway, growIn } from "@/lib/presence";
import { UndoTimer } from "./MessageSlot";
import { t } from "@/i18n";

/**
 * A removed item's place, kept for a few seconds: a dashed box reading
 * "Routine Legs A deleted" with Undo and a line that runs out, then it folds
 * away (180ms, like a banner) and the items under it slide up.
 */
export default function UndoPlaceholder({
  entry,
  className,
}: {
  entry: UndoEntry;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Real milliseconds left; slow motion slows the animations by itself.
  const left = Math.max(0, entry.expiresAt - Date.now());
  const scale = motionScale();
  // Standing alone it grows open in the space (a list grows it from the
  // removed item's height instead: useListMotion).
  useLayoutEffect(() => {
    const el = box.current;
    if (el && !el.parentElement?.hasAttribute("data-list-motion")) growIn(el);
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Fold away (180ms) just before the store lets it go.
    const timer = window.setTimeout(
      () => {
        el.setAttribute("data-folded", "");
        foldAway(el);
      },
      Math.max(0, left - MOTION.bannerOut * scale),
    );
    return () => window.clearTimeout(timer);
    // Once per placeholder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={box}
      className={"undo-placeholder" + (className ? ` ${className}` : "")}
      role="status"
      data-undo={entry.id}
    >
      <span className="undo-text">{entry.text}</span>
      <button
        type="button"
        className="undo-button"
        onClick={() => runUndo(entry.id)}
      >
        {t("undo.label")}
      </button>
      <UndoTimer
        ms={left / scale}
        startAt={Math.min(1, left / (UNDO_MS * scale))}
      />
    </div>
  );
}
