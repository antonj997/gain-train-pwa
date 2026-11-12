import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { finishSummary } from "@/lib/labels";
import { motionMs } from "@/lib/slow-motion";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import { useT } from "@/i18n/useT";

type BodyProps = {
  /** Checked sets that will be saved. */
  completed: number;
  /** Sets that are not checked and will be left out. */
  unchecked: number;
  /** Hidden for a workout that was started from a routine. */
  showRoutineSwitch: boolean;
  saveRoutine: boolean;
  busy: boolean;
  onSaveRoutine: (on: boolean) => void;
  onSave: () => void;
  onKeepLogging: () => void;
  onAbandon: () => void;
};

/** How long "Tap again to discard" waits for the second tap. */
const CONFIRM_MS = 3000;

/** The Finish sheet's content below its title. Only drafts use it. */
function FinishSheetBody({
  completed,
  unchecked,
  showRoutineSwitch,
  saveRoutine,
  busy,
  onSaveRoutine,
  onSave,
  onKeepLogging,
  onAbandon,
}: BodyProps) {
  const { t } = useT();
  // Discard asks for a second tap in the same place, not a dialog; after a
  // few seconds it goes back to asking for the first.
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = window.setTimeout(
      () => setAsking(false),
      motionMs(CONFIRM_MS),
    );
    return () => window.clearTimeout(timer);
  }, [asking]);
  return (
    <>
      <p className="sheet-note" role="status">
        {finishSummary(completed, unchecked)}
      </p>
      {showRoutineSwitch && (
        <Switch
          label={t("workout.saveAsRoutine")}
          checked={saveRoutine}
          disabled={busy}
          onChange={onSaveRoutine}
        />
      )}
      <button
        type="button"
        className="btn-primary"
        disabled={busy || completed === 0}
        onClick={onSave}
      >
        {busy ? t("workout.saving") : t("workout.saveWorkout")}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={onKeepLogging}
      >
        {t("workout.keepLogging")}
      </button>
      <button
        type="button"
        className={"btn-danger finish-discard" + (asking ? " is-asking" : "")}
        disabled={busy}
        onClick={() => {
          if (!asking) setAsking(true);
          else {
            setAsking(false);
            onAbandon();
          }
        }}
      >
        <Trash2 size={18} aria-hidden="true" />
        {/* The new words fade in where the old ones were. */}
        <span key={String(asking)} className="finish-discard-label">
          {asking ? t("workout.abandonConfirm") : t("workout.abandonWorkout")}
        </span>
      </button>
      <span className="sr-only" role="status">
        {asking ? t("workout.abandonConfirm") : ""}
      </span>
    </>
  );
}

/** What a person sees after tapping Finish. */
export default function FinishSheet({
  open,
  onClose,
  ...body
}: BodyProps & { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet
      open={open}
      // The sheet stays put while a save or abandon runs.
      onClose={() => {
        if (!body.busy) onClose();
      }}
      title={t("workout.finishTitle")}
    >
      <FinishSheetBody {...body} />
    </Sheet>
  );
}
