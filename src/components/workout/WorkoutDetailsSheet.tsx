import { type Workout, today } from "@/data/model";
import { selectInputValue } from "@/lib/set-editing";
import { WORKOUT_NOTE_MAX } from "@/lib/workout-note";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/useT";

type BodyProps = {
  workout: Workout;
  onChange: (workout: Workout) => void;
};

/** The details sheet's fields: name, date, an optional duration and the workout's note. */
function WorkoutDetailsSheetBody({ workout: w, onChange }: BodyProps) {
  const { t } = useT();
  return (
    <>
      <label className="sheet-field">
        <span className="sheet-label">{t("workout.name")}</span>
        <input
          value={w.name}
          maxLength={100}
          aria-invalid={!w.name.trim()}
          onChange={(e) => onChange({ ...w, name: e.target.value })}
        />
      </label>
      <label className="sheet-field">
        <span className="sheet-label">{t("workout.date")}</span>
        <input
          type="date"
          value={w.date}
          max={today()}
          onChange={(e) => onChange({ ...w, date: e.target.value })}
        />
      </label>
      <label className="sheet-field">
        <span className="sheet-label">{t("workout.durationLabel")}</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="1440"
          step="1"
          placeholder={
            w.startedAt ? t("workout.autoTimer") : t("workout.notRecorded")
          }
          value={w.duration ?? ""}
          onFocus={selectInputValue}
          onClick={selectInputValue}
          onChange={(e) =>
            onChange({
              ...w,
              duration: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
      {/* The same note as the Finish sheet's; it is saved trimmed. */}
      <label className="sheet-field">
        <span className="sheet-label">{t("workout.noteLabel")}</span>
        <textarea
          className="finish-note"
          rows={2}
          maxLength={WORKOUT_NOTE_MAX}
          placeholder={t("workout.note")}
          value={w.note ?? ""}
          onChange={(e) => onChange({ ...w, note: e.target.value })}
        />
      </label>
    </>
  );
}

/** Opens from the workout's title or the date chip. Changes apply as typed. */
export default function WorkoutDetailsSheet({
  open,
  onClose,
  ...body
}: BodyProps & { open: boolean; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("workout.details")}>
      <WorkoutDetailsSheetBody {...body} />
    </Sheet>
  );
}
