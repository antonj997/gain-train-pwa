import { useT } from "@/i18n/useT";

/**
 * The start dialog's text and three buttons when a workout already runs (v6
 * A3), in order: continue it (primary), save it as a routine and finish
 * (secondary), and discard it and start anew (danger text, two taps).
 */
export default function RunningWorkoutChoices({
  name,
  text,
  armed,
  busy,
  onContinue,
  onSaveRoutine,
  onDiscard,
}: {
  name: string;
  text: string;
  armed: boolean;
  busy: boolean;
  onContinue: () => void;
  onSaveRoutine: () => void;
  onDiscard: () => void;
}) {
  const { t } = useT();
  return (
    <>
      <p className="start-running-text">{text}</p>
      <button
        type="button"
        className="btn-primary btn-block"
        disabled={busy}
        onClick={onContinue}
      >
        {t("start.continueNamed", { name })}
      </button>
      <button
        type="button"
        className="btn-secondary btn-block"
        disabled={busy}
        onClick={onSaveRoutine}
      >
        {t("start.saveRoutineAndEnd")}
      </button>
      <button
        type="button"
        className={
          "btn-quiet btn-block start-discard" + (armed ? " is-armed" : "")
        }
        disabled={busy}
        onClick={onDiscard}
      >
        {armed ? t("start.discardAgain") : t("start.discardAndStart")}
      </button>
    </>
  );
}
