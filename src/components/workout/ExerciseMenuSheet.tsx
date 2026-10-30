import {
  ArrowDown,
  ArrowUp,
  ListOrdered,
  Replace,
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
  onChangeExercise,
  onReorder,
  onMoveUp,
  onMoveDown,
  onRemove,
}: BodyProps) {
  const { t } = useT();
  return (
    <div className="sheet-menu">
      <button
        type="button"
        className="sheet-menu-item"
        onClick={onChangeExercise}
      >
        <Replace size={18} aria-hidden="true" />
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
