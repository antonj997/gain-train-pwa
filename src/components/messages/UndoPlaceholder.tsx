import { useEffect, useRef } from "react";
import { runUndo } from "@/lib/message-store";
import { UNDO_MS, type UndoEntry } from "@/lib/messages";
import { motionScale } from "@/lib/slow-motion";
import { reducedMotion } from "@/hooks/useMessages";
import { UndoTimer } from "./MessageSlot";
import { t } from "@/i18n";

const COLLAPSE_MS = 220;

/**
 * A removed item's place, kept for a few seconds: a dashed box reading
 * "Routine Legs A deleted" with Undo and a line that runs out, then it folds
 * away and the items under it slide up.
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
  useEffect(() => {
    const el = box.current;
    if (!el || reducedMotion() || typeof el.animate !== "function") return;
    // Fold away just before the store lets it go.
    const timer = window.setTimeout(
      () => {
        const height = el.getBoundingClientRect().height;
        el.animate(
          [
            { height: `${height}px`, opacity: 1 },
            { height: "0px", opacity: 0, marginBlock: "0px" },
          ],
          { duration: COLLAPSE_MS, easing: "ease-in", fill: "forwards" },
        );
      },
      Math.max(0, left - COLLAPSE_MS * scale),
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
