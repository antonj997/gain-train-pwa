import type { Ref } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { WorkoutSet } from "@/data/model";
import { isDrop, type SetBadgeInfo } from "@/data/drops";
import { allowedLoadKeys, loadKeyOf, type LoadKey } from "@/lib/load-keys";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import { useT } from "@/i18n/useT";
import { t, type MessageKey } from "@/i18n";

type BodyProps = {
  badge: SetBadgeInfo;
  /** The matching previous result, for example "97.5 × 5". */
  previous?: string;
  set: WorkoutSet;
  /** How many drops follow this set. */
  dropCount: number;
  exerciseDefault: LoadKey;
  /** Cardio sets have no load, and no drops. */
  cardio?: boolean;
  onSection: (section: WorkoutSet["section"]) => void;
  onLoadKey: (key: LoadKey) => void;
  onAddDrop: () => void;
  onDelete: () => void;
};

const LOAD_OPTIONS: { value: LoadKey; label: MessageKey }[] = [
  { value: "weight", label: "set.optWeight" },
  { value: "bw", label: "set.optBw" },
  { value: "bwplus", label: "set.optBwPlus" },
  { value: "assisted", label: "set.optAssist" },
];

const SECTION_OPTIONS: { value: WorkoutSet["section"]; label: MessageKey }[] = [
  { value: "warmup", label: "set.optWarmup" },
  { value: "working", label: "set.optWorking" },
  { value: "winddown", label: "set.optCooldown" },
];

function deleteLabel(set: WorkoutSet, dropCount: number) {
  if (isDrop(set)) return t("set.deleteDrop");
  if (dropCount === 0) return t("set.deleteSet");
  return t("set.deleteSetDrops", { count: dropCount });
}

/** The Set sheet's content below its title; changes apply as they are made. */
function SetSheetBody({
  badge,
  set,
  dropCount,
  exerciseDefault,
  cardio = false,
  onSection,
  onLoadKey,
  onAddDrop,
  onDelete,
}: BodyProps) {
  const drop = isDrop(set);
  const key = loadKeyOf(set);
  const allowed = allowedLoadKeys(
    set.measure === "seconds" ? "seconds" : "reps",
  );
  const canAddDrop = !cardio && !set.done && set.section === "working";
  const { t } = useT();
  return (
    <>
      {drop ? (
        <p className="sheet-note">{t("set.dropNote")}</p>
      ) : (
        <div className="sheet-field">
          <span className="sheet-label" aria-hidden="true">
            {t("set.type")}
          </span>
          <Segmented
            label={t("set.typeOf", { title: badge.title })}
            value={set.section}
            options={SECTION_OPTIONS.map((option) => ({
              ...option,
              label: t(option.label),
              disabled: set.done,
            }))}
            onChange={onSection}
          />
        </div>
      )}
      {!cardio && (
        <div className="sheet-field">
          <span className="sheet-label" aria-hidden="true">
            {t("set.loadForSet")}
          </span>
          <Segmented
            label={t("set.loadForSet")}
            value={key}
            options={LOAD_OPTIONS.map((option) => ({
              ...option,
              label: t(option.label),
              disabled: set.done || !allowed.includes(option.value),
            }))}
            onChange={onLoadKey}
          />
          <p className="sheet-hint">
            {key === exerciseDefault
              ? t("set.sameAsExercise")
              : t("set.differsFromExercise")}
          </p>
        </div>
      )}
      {set.done && (
        <p className="sheet-hint">
          {cardio
            ? t("set.uncheckToChangeType")
            : t("set.uncheckToChangeTypeLoad")}
        </p>
      )}
      <div className="sheet-actions">
        {canAddDrop && (
          <button type="button" className="btn-secondary" onClick={onAddDrop}>
            <Plus size={18} aria-hidden="true" />
            {drop ? t("set.addAnotherDrop") : t("set.addDrop")}
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
  const { t } = useT();
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
            <span className="sheet-title-aside">
              {t("set.lastTime", { value: body.previous })}
            </span>
          )}
        </span>
      }
    >
      <SetSheetBody {...body} />
    </Sheet>
  );
}
