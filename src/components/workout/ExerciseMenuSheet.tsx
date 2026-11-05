import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Columns3,
  ListOrdered,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/useT";

type BodyProps = {
  /** The current load and count, for example "kg · reps". */
  hint?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Left out for cardio, which has no load or count to change. */
  onLoadAndCount?: () => void;
  /** Cardio only: opens "Fields…"; `fieldsHint` lists the fields shown. */
  onFields?: () => void;
  fieldsHint?: string;
  onChangeExercise: () => void;
  onReorder: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

/** The exercise menu's actions, below the exercise's name. */
function ExerciseMenuSheetBody({
  hint,
  canMoveUp,
  canMoveDown,
  onLoadAndCount,
  onFields,
  fieldsHint,
  onChangeExercise,
  onReorder,
  onMoveUp,
  onMoveDown,
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
      {onLoadAndCount && (
        <button
          type="button"
          className="sheet-menu-item"
          onClick={onLoadAndCount}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span>{t("exercise.loadAndCount")}</span>
          <span className="sheet-menu-hint">{hint}</span>
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
      <button
        type="button"
        className="sheet-menu-item"
        disabled={!canMoveUp}
        onClick={onMoveUp}
      >
        <ArrowUp size={18} aria-hidden="true" />
        <span>{t("exercise.moveUp")}</span>
      </button>
      <button
        type="button"
        className="sheet-menu-item"
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <ArrowDown size={18} aria-hidden="true" />
        <span>{t("exercise.moveDown")}</span>
      </button>
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
