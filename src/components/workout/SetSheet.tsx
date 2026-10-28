import type { Ref } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { WorkoutSet } from "@/data/model";
import { isDrop, type SetBadgeInfo } from "@/data/drops";
import { allowedLoadKeys, loadKeyOf, type LoadKey } from "@/lib/load-keys";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";

type BodyProps = {
  badge: SetBadgeInfo;
  /** The matching previous result, for example "97.5 × 5". */
  previous?: string;
  set: WorkoutSet;
  /** How many drops follow this set. */
  dropCount: number;
  exerciseDefault: LoadKey;
  onSection: (section: WorkoutSet["section"]) => void;
  onLoadKey: (key: LoadKey) => void;
  onAddDrop: () => void;
  onDelete: () => void;
};

const LOAD_OPTIONS: { value: LoadKey; label: string }[] = [
  { value: "weight", label: "Weight" },
  { value: "bw", label: "BW" },
  { value: "bwplus", label: "BW + kg" },
  { value: "assisted", label: "Assist" },
];

const SECTION_OPTIONS: { value: WorkoutSet["section"]; label: string }[] = [
  { value: "warmup", label: "Warm-up" },
  { value: "working", label: "Working" },
  { value: "winddown", label: "Cool-down" },
];

function deleteLabel(set: WorkoutSet, dropCount: number) {
  if (isDrop(set)) return "Delete drop";
  if (dropCount === 0) return "Delete set";
  return dropCount === 1
    ? "Delete set and 1 drop"
    : `Delete set and ${dropCount} drops`;
}

/** The Set sheet's content below its title; changes apply as they are made. */
export function SetSheetBody({
  badge,
  set,
  dropCount,
  exerciseDefault,
  onSection,
  onLoadKey,
  onAddDrop,
  onDelete,
}: BodyProps) {
  const drop = isDrop(set);
  const key = loadKeyOf(set);
  const allowed = allowedLoadKeys(set.measure ?? "reps");
  const canAddDrop = !set.done && set.section === "working";
  return (
    <>
      {drop ? (
        <p className="sheet-note">
          Done straight after the set above, at a lower weight. No rest in
          between.
        </p>
      ) : (
        <div className="sheet-field">
          <span className="sheet-label" aria-hidden="true">
            Type
          </span>
          <Segmented
            label={`${badge.title} type`}
            value={set.section}
            options={SECTION_OPTIONS.map((option) => ({
              ...option,
              disabled: set.done,
            }))}
            onChange={onSection}
          />
        </div>
      )}
      <div className="sheet-field">
        <span className="sheet-label" aria-hidden="true">
          Load for this set
        </span>
        <Segmented
          label="Load for this set"
          value={key}
          options={LOAD_OPTIONS.map((option) => ({
            ...option,
            disabled: set.done || !allowed.includes(option.value),
          }))}
          onChange={onLoadKey}
        />
        <p className="sheet-hint">
          {key === exerciseDefault
            ? "Same as the exercise"
            : "Differs from the exercise"}
        </p>
      </div>
      {set.done && (
        <p className="sheet-hint">
          Uncheck this set to change its type or load.
        </p>
      )}
      <div className="sheet-actions">
        {canAddDrop && (
          <button type="button" className="btn-secondary" onClick={onAddDrop}>
            <Plus size={18} aria-hidden="true" />
            {drop ? "Add another drop" : "Add drop"}
          </button>
        )}
        <button type="button" className="btn-danger" onClick={onDelete}>
          <Trash2 size={18} aria-hidden="true" />
          {deleteLabel(set, dropCount)}
        </button>
      </div>
    </>
  );
}

/** The sheet a set's badge opens. The page behind stays readable. */
export default function SetSheet({
  open,
  onClose,
  contentRef,
  ...body
}: BodyProps & {
  open: boolean;
  onClose: () => void;
  contentRef: Ref<HTMLDivElement>;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      backdrop="light"
      contentRef={contentRef}
      title={
        <span className="sheet-title-line">
          <span>{body.badge.title}</span>
          {body.previous && (
            <span className="sheet-title-aside">Last time {body.previous}</span>
          )}
        </span>
      }
    >
      <SetSheetBody {...body} />
    </Sheet>
  );
}
