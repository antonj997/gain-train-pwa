import { useRef } from "react";
import {
  labelSet,
  validSet,
  type Exercise,
  type WorkoutSet,
} from "@/data/model";
import { dropGroup, isDrop, setBadge } from "@/data/drops";
import Sheet from "@/components/ui/Sheet";
import SortableSetList from "@/components/SortableSetList";

/**
 * The sets in the order of `parentIds`, each followed by its drops. A set that
 * is not named (an orphaned drop) goes last rather than being lost.
 */
// A pure helper kept beside the sheet that uses it; only hot reload cares.
// eslint-disable-next-line react-refresh/only-export-components
export function reorderGroups(
  sets: WorkoutSet[],
  parentIds: string[],
): WorkoutSet[] {
  const ordered = parentIds.flatMap((id) => {
    const index = sets.findIndex((set) => set.id === id);
    if (index < 0) return [];
    const { start, end } = dropGroup(sets, index);
    return sets.slice(start, end);
  });
  const placed = new Set(ordered.map((set) => set.id));
  return [...ordered, ...sets.filter((set) => !placed.has(set.id))];
}

const summary = (set: WorkoutSet) =>
  validSet(set) ? labelSet(set) : "Not filled in";

/** Moves sets, and the drops that follow them, with handles or arrow keys. */
export default function ReorderSetsSheet({
  open,
  exercise,
  onReorder,
  onClose,
}: {
  open: boolean;
  exercise: Exercise;
  onReorder: (sets: WorkoutSet[]) => void;
  onClose: () => void;
}) {
  const moving = useRef(false);
  const { sets } = exercise;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Reorder sets"
      // Escape cancels a move in progress; only a second one closes the sheet.
      onEscapeKeyDown={(event) => {
        if (moving.current) event.preventDefault();
      }}
    >
      <SortableSetList
        sets={sets.filter((set) => !isDrop(set))}
        name={exercise.name}
        onMovingChange={(value) => {
          moving.current = value;
        }}
        onReorder={(next) =>
          onReorder(
            reorderGroups(
              sets,
              next.map((set) => set.id),
            ),
          )
        }
      >
        {(set, _index, handle) => {
          const at = sets.findIndex((item) => item.id === set.id);
          const badge = setBadge(sets, at);
          const drops = sets.slice(at + 1, dropGroup(sets, at).end);
          return (
            <div className="reorder-item">
              <div className="reorder-row">
                {handle}
                <span className="set-badge" data-tone={badge.tone}>
                  <span className="set-badge-chip" aria-hidden="true">
                    {badge.text}
                  </span>
                </span>
                <span className="reorder-summary">{summary(set)}</span>
              </div>
              {drops.map((drop) => (
                <p key={drop.id} className="reorder-drop">
                  <span aria-hidden="true">↓ </span>
                  <span className="sr-only">Drop: </span>
                  {summary(drop)}
                </p>
              ))}
            </div>
          );
        }}
      </SortableSetList>
    </Sheet>
  );
}
