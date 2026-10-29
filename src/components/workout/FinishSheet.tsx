import { finishSummary } from "@/lib/labels";
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
        className="btn-danger"
        disabled={busy}
        onClick={onAbandon}
      >
        {t("workout.abandonWorkout")}
      </button>
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
