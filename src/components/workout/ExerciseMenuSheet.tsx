import {
  ArrowDown,
  ArrowUp,
  ListOrdered,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Sheet from "@/components/ui/Sheet";

type BodyProps = {
  /** The current load and count, for example "kg · reps". */
  hint?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Left out for cardio, which has no load or count to change. */
  onLoadAndCount?: () => void;
  onReorder: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

/** The exercise menu's actions, below the exercise's name. */
export function ExerciseMenuSheetBody({
  hint,
  canMoveUp,
  canMoveDown,
  onLoadAndCount,
  onReorder,
  onMoveUp,
  onMoveDown,
  onRemove,
}: BodyProps) {
  return (
    <div className="sheet-menu">
      {onLoadAndCount && (
        <button
          type="button"
          className="sheet-menu-item"
          onClick={onLoadAndCount}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span>Load and count</span>
          <span className="sheet-menu-hint">{hint}</span>
        </button>
      )}
      <button type="button" className="sheet-menu-item" onClick={onReorder}>
        <ListOrdered size={18} aria-hidden="true" />
        <span>Reorder sets</span>
      </button>
      <button
        type="button"
        className="sheet-menu-item"
        disabled={!canMoveUp}
        onClick={onMoveUp}
      >
        <ArrowUp size={18} aria-hidden="true" />
        <span>Move up</span>
      </button>
      <button
        type="button"
        className="sheet-menu-item"
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <ArrowDown size={18} aria-hidden="true" />
        <span>Move down</span>
      </button>
      <button type="button" className="btn-danger" onClick={onRemove}>
        <Trash2 size={18} aria-hidden="true" />
        Remove exercise
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
