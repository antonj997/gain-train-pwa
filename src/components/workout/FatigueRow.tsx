import { useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import {
  fatigueTargetText as targetText,
  type FatigueNote,
} from "@/data/fatigue";
import type { SetTarget } from "@/data/targets";
import { EASE, MOTION, play, settled } from "@/lib/motion";
import type { WeightUnit } from "@/lib/units";
import { formatDecimal, t, type MessageKey } from "@/i18n";

/** What the row shows: a suggestion, or a target already lowered. */
export type FatigueRowState =
  | { kind: "suggest"; note: FatigueNote }
  | { kind: "lowered"; to: SetTarget }
  | null;

/**
 * The quiet fatigue row under an exercise's heading (v6 B13, §D10): ink-2
 * text with an info glyph, no coloured box. "Föreslå" offers "Sänk till …"
 * and "Behåll målet"; "Automatiskt" says the target is lowered, with Ångra.
 * When the row goes (a choice, or Ångra) it folds away (row-out on the
 * collapse curve), so the sets under it slide up.
 */
export default function FatigueRow({
  state,
  unit = "kg",
  onLower,
  onKeep,
  onUndo,
}: {
  state: FatigueRowState;
  unit?: WeightUnit;
  onLower?: () => void;
  onKeep?: () => void;
  onUndo?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // The row stays while it folds away, with what it said.
  const [shown, setShown] = useState<FatigueRowState>(state);
  if (state && state !== shown) setShown(state);
  const leaving = !state && !!shown;
  useLayoutEffect(() => {
    if (!leaving) return;
    const el = box.current;
    const out = play(
      el,
      [
        { height: `${el?.offsetHeight ?? 0}px`, opacity: 1 },
        { height: "0px", opacity: 0 },
      ],
      { duration: MOTION.rowOut, easing: EASE.collapse, fill: "forwards" },
    );
    let gone = false;
    void settled(out).then(() => {
      if (!gone) setShown(null);
    });
    return () => {
      gone = true;
    };
  }, [leaving]);
  if (!shown) return null;
  const text =
    shown.kind === "suggest"
      ? t("workout.fatigueNote", {
          muscle: t(`muscleName.${shown.note.muscle}` as MessageKey),
          today: formatDecimal(shown.note.today),
          before: formatDecimal(shown.note.before),
          from: targetText(shown.note.from, unit),
        })
      : t("workout.fatigueAuto", { to: targetText(shown.to, unit) });
  return (
    <div
      ref={box}
      className="fatigue-row"
      role="status"
      aria-hidden={leaving || undefined}
    >
      <p className="fatigue-text">
        <Info size={15} aria-hidden="true" />
        <span>{text}</span>
      </p>
      <div className="fatigue-actions">
        {shown.kind === "suggest" ? (
          <>
            <button type="button" className="fatigue-link" onClick={onLower}>
              {t("workout.fatigueLower", {
                to: targetText(shown.note.to, unit),
              })}
            </button>
            <button type="button" className="fatigue-link" onClick={onKeep}>
              {t("workout.fatigueKeep")}
            </button>
          </>
        ) : (
          <button type="button" className="fatigue-link" onClick={onUndo}>
            {t("undo.label")}
          </button>
        )}
      </div>
    </div>
  );
}
