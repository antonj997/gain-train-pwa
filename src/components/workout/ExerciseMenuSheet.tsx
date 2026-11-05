import {
  ArrowLeftRight,
  ArrowUpDown,
  Columns3,
  ListOrdered,
  Trash2,
} from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/useT";

type BodyProps = {
  /** Cardio only: opens "Fields…"; `fieldsHint` lists the fields shown. */
  onFields?: () => void;
  fieldsHint?: string;
  onChangeExercise: () => void;
  onReorder: () => void;
  /** Opens Reorder exercises; left out when there is nothing to reorder. */
  onReorderExercises?: () => void;
  onRemove: () => void;
};

/** The exercise menu's actions, below the exercise's name. */
function ExerciseMenuSheetBody({
  onFields,
  fieldsHint,
  onChangeExercise,
  onReorder,
  onReorderExercises,
  onRemove,
}: BodyProps) {
  const { t } = useT();
  return (
    <div className="sheet-menu">
      {/* First and in accent: swapping keeps the sets, so it beats remove and add. */}
      <button
        type="button"
        className="sheet-menu-item is-lead"
        onClick={onChangeExercise}
      >
        <ArrowLeftRight size={18} aria-hidden="true" />
        <span>{t("exercise.changeExercise")}</span>
      </button>
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
      <button type="button" className="btn-danger" onClick={onRemove}>
        <Trash2 size={18} aria-hidden="true" />
        {t("workout.removeExercise")}
      </button>
    </div>
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
