import { useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Exercise } from "@/data/model";
import { isDrop } from "@/data/drops";
import { moveId, orderChanged, reorderByIds } from "@/lib/exercise-order";
import { countLabel } from "@/lib/labels";
import Sheet from "@/components/ui/Sheet";
import SortableSetList from "@/components/SortableSetList";
import { t } from "@/i18n";

/**
 * "Reorder exercises": the workout's or routine's exercises with their set
 * counts, moved with the same handles as Reorder sets or with ↑ and ↓. The
 * exercise whose menu opened it is marked. The order is saved on Done (or
 * when the sheet closes), once.
 */
export default function ReorderExercisesSheet({
  open,
  exercises,
  currentId,
  onSave,
  onClose,
}: {
  open: boolean;
  exercises: readonly Exercise[];
  /** The exercise whose ⋯ menu opened the sheet. */
  currentId: string | null;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const moving = useRef(false);
  const ids = exercises.map((ex) => ex.id);
  const [draft, setDraft] = useState<string[] | null>(null);
  // A new opening starts from the exercises' current order.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(null);
  }
  const order = reorderByIds(exercises, draft ?? ids);
  const finish = () => {
    if (draft && orderChanged(draft, ids)) onSave(order.map((ex) => ex.id));
    setDraft(null);
    onClose();
  };
  const step = (id: string, by: -1 | 1) =>
    setDraft(
      moveId(
        order.map((ex) => ex.id),
        id,
        by,
      ),
    );
  return (
    <Sheet
      open={open}
      onClose={finish}
      title={t("exercise.reorderExercises")}
      onEscapeKeyDown={(event) => {
        if (moving.current) event.preventDefault();
      }}
    >
      <SortableSetList
        sets={order}
        name=""
        handleLabel={(ex, index) =>
          t("exercise.moveHandle", { name: ex.name, n: index + 1 })
        }
        onMovingChange={(value) => {
          moving.current = value;
        }}
        onReorder={(next) => setDraft(next.map((ex) => ex.id))}
      >
        {(ex, index, handle) => (
          <div
            className={
              "reorder-item reorder-exercise" +
              (ex.id === currentId ? " is-current" : "")
            }
            aria-current={ex.id === currentId ? "true" : undefined}
          >
            <div className="reorder-row">
              {handle}
              <span className="reorder-exercise-text">
                <span className="reorder-exercise-name">{ex.name}</span>
                <span className="row-sub">
                  {countLabel(ex.sets.filter((s) => !isDrop(s)).length, "set")}
                </span>
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={t("exercise.moveUpNamed", { name: ex.name })}
                disabled={index === 0}
                onClick={() => step(ex.id, -1)}
              >
                <ArrowUp size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t("exercise.moveDownNamed", { name: ex.name })}
                disabled={index === order.length - 1}
                onClick={() => step(ex.id, 1)}
              >
                <ArrowDown size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </SortableSetList>
      <button type="button" className="btn-primary" onClick={finish}>
        {t("common.done")}
      </button>
    </Sheet>
  );
}
