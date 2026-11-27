import { useEffect, useId, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Columns3,
  ListOrdered,
  Repeat,
  Timer,
  Trash2,
} from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import { useT } from "@/i18n/useT";
import { formatDecimal } from "@/i18n";
import { EXERCISE_NOTE_MAX } from "@/data/model";
import { WEIGHT_STEPS } from "@/lib/exercise-settings";

type BodyProps = {
  /** Cardio only: opens "Fields…"; `fieldsHint` lists the fields shown. */
  onFields?: () => void;
  fieldsHint?: string;
  /** Opens the rep range; `repRangeHint` shows it ("8–12 reps"). */
  onRepRange?: () => void;
  repRangeHint?: string;
  /** v6 B7: the exercise's note, saved on blur. */
  note?: string;
  onNote?: (text: string) => void;
  /** v6 B7: the weight step in kg, a segment over WEIGHT_STEPS. */
  weightStep?: number;
  onWeightStep?: (step: number) => void;
  /** v6 B7: "Vilotid 2:00" opens the rest sheet. */
  restHint?: string;
  onRest?: () => void;
  onChangeExercise: () => void;
  onReorder: () => void;
  /** Opens Reorder exercises; left out when there is nothing to reorder. */
  onReorderExercises?: () => void;
  onRemove: () => void;
};

/**
 * The exercise menu's content, below the exercise's name (v6 B7): the note,
 * the rep range, the weight step and the rest time first (where the
 * progression is set), then swap, reorder, fields and remove.
 */
function ExerciseMenuSheetBody({
  onFields,
  fieldsHint,
  onRepRange,
  repRangeHint,
  note,
  onNote,
  weightStep,
  onWeightStep,
  restHint,
  onRest,
  onChangeExercise,
  onReorder,
  onReorderExercises,
  onRemove,
}: BodyProps) {
  const { t } = useT();
  const noteId = useId();
  const [text, setText] = useState(note ?? "");
  // A note saved elsewhere (another device) shows when the sheet opens again.
  useEffect(() => setText(note ?? ""), [note]);
  return (
    <>
      {onNote && (
        <div className="sheet-field exercise-note-field">
          <label className="sheet-label" htmlFor={noteId}>
            {t("exercise.noteTitle")}
          </label>
          <textarea
            id={noteId}
            className="exercise-note-input"
            rows={2}
            maxLength={EXERCISE_NOTE_MAX}
            placeholder={t("exercise.notePlaceholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => onNote(text)}
          />
          <p className="sheet-hint">{t("exercise.noteHint")}</p>
        </div>
      )}
      {onWeightStep && weightStep !== undefined && (
        <div className="sheet-field">
          <span className="sheet-label" aria-hidden="true">
            {t("exercise.stepTitle")}
          </span>
          <Segmented<string>
            label={t("exercise.stepTitle")}
            value={String(weightStep)}
            options={WEIGHT_STEPS.map((step) => ({
              value: String(step),
              label: formatDecimal(step),
            }))}
            onChange={(value) => onWeightStep(Number(value))}
          />
          <p className="sheet-hint">
            {t("exercise.stepNote", { step: formatDecimal(weightStep) })}
          </p>
        </div>
      )}
      <div className="sheet-menu">
        {onRepRange && (
          <button
            type="button"
            className="sheet-menu-item"
            onClick={onRepRange}
          >
            <Repeat size={18} aria-hidden="true" />
            <span className="sheet-menu-text">
              <span>{t("exercise.rangeTitle")}</span>
              <span className="sheet-menu-sub">
                {t("exercise.rangeRowSub")}
              </span>
            </span>
            {repRangeHint && (
              <span className="sheet-menu-hint">{repRangeHint}</span>
            )}
          </button>
        )}
        {onRest && (
          <button type="button" className="sheet-menu-item" onClick={onRest}>
            <Timer size={18} aria-hidden="true" />
            <span>{t("exercise.restRow", { time: restHint ?? "" })}</span>
          </button>
        )}
        <button
          type="button"
          className="sheet-menu-item is-lead"
          onClick={onChangeExercise}
        >
          <ArrowLeftRight size={18} aria-hidden="true" />
          <span>{t("exercise.changeExercise")}</span>
        </button>
        {onReorderExercises && (
          <button
            type="button"
            className="sheet-menu-item"
            onClick={onReorderExercises}
          >
            <ArrowUpDown size={18} aria-hidden="true" />
            <span>{t("exercise.reorderExercises")}</span>
          </button>
        )}
        {onFields && (
          <button type="button" className="sheet-menu-item" onClick={onFields}>
            <Columns3 size={18} aria-hidden="true" />
            <span>{t("exercise.fields")}</span>
            <span className="sheet-menu-hint">{fieldsHint}</span>
          </button>
        )}
        <button type="button" className="sheet-menu-item" onClick={onReorder}>
          <ListOrdered size={18} aria-hidden="true" />
          <span>{t("exercise.reorderSets")}</span>
        </button>
        <button type="button" className="btn-danger" onClick={onRemove}>
          <Trash2 size={18} aria-hidden="true" />
          {t("workout.removeExercise")}
        </button>
      </div>
    </>
  );
}

/** The sheet an exercise's ⋯ button opens; the exercise's name is its title. */
export default function ExerciseMenuSheet({
  open,
  onClose,
  name,
  ...body
}: BodyProps & { open: boolean; onClose: () => void; name: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={name}>
      <ExerciseMenuSheetBody {...body} />
    </Sheet>
  );
}
