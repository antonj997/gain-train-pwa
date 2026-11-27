import { useState, type ComponentProps, type Ref } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, Flame, Trash2 } from "lucide-react";
import type { WorkoutSet } from "@/data/model";
import { isDrop, type SetBadgeInfo } from "@/data/drops";
import { allowedLoadKeys, loadKeyOf, type LoadKey } from "@/lib/load-keys";
import { useProfile } from "@/contexts/useProfile";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import ListRow from "@/components/ui/ListRow";
import Reveal from "@/components/motion/Reveal";
import { useT } from "@/i18n/useT";
import { t, type MessageKey } from "@/i18n";
import { formatWeight, getWeightUnit, type WeightUnit } from "@/lib/units";
import { RIR_TOP, rirOf } from "@/lib/rir";

type BodyProps = {
  badge: SetBadgeInfo;
  /** The matching previous result, for example "97.5 × 5". */
  previous?: string;
  /** Today's target for the set, for example "100 kg × 5". */
  target?: string;
  set: WorkoutSet;
  /** How many drops follow this set. */
  dropCount: number;
  /** Cardio sets have no load, and no drops. */
  cardio?: boolean;
  onSection: (section: WorkoutSet["section"]) => void;
  onLoadKey: (key: LoadKey) => void;
  /**
   * "Fråga efter RIR" is on (v6 B4): the RIR row shows the value and opens
   * the pad in RIR mode. Without it there is no RIR row.
   */
  onOpenRir?: () => void;
  onAddDrop: () => void;
  /**
   * The first working set while unchecked, with "Tips i passet" on: "Lägg
   * till uppvärmning" opens the warm-up ladder (v6 B6).
   */
  onAddWarmup?: () => void;
  /** "Tips i passet": the add rows carry their hint lines. */
  tips?: boolean;
  onDelete: () => void;
  /** The exercise's weight unit (useWeightUnits); the default otherwise. */
  weightUnit?: WeightUnit;
};

const LOAD_OPTIONS: { value: LoadKey; label: MessageKey }[] = [
  { value: "weight", label: "set.optWeight" },
  { value: "bw", label: "set.optBw" },
  { value: "bwplus", label: "set.optBwPlus" },
  { value: "assisted", label: "set.optAssist" },
  { value: "none", label: "set.optNone" },
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

/** "2 reps kvar i tanken", "5 eller fler kvar i tanken", or "Välj". */
function rirRowValue(set: WorkoutSet) {
  const rir = rirOf(set);
  if (rir === null) return t("set.rirChoose");
  if (rir >= RIR_TOP) return t("set.rirValueTop");
  return t("set.rirValue", { count: rir });
}

/**
 * The Set sheet's content below its title (v6 B4), in groups: adding (a
 * warm-up before the first working set, a drop), then the set's rows (Type,
 * RIR, Load), then Delete set apart. Changes apply as they are made.
 */
function SetSheetBody({
  badge,
  set,
  dropCount,
  cardio = false,
  onSection,
  onLoadKey,
  onOpenRir,
  onAddDrop,
  onAddWarmup,
  tips = true,
  onDelete,
  weightUnit,
}: BodyProps) {
  const drop = isDrop(set);
  const key = loadKeyOf(set);
  const allowed = allowedLoadKeys(
    set.measure === "seconds" ? "seconds" : "reps",
  );
  const canAddDrop = !cardio && !set.done && set.section === "working";
  const { t } = useT();
  const { bodyWeightKg } = useProfile();
  const unit = weightUnit ?? getWeightUnit();
  // Type and Load open in place under their row (Reveal).
  const [open, setOpen] = useState<"type" | "load" | null>(null);
  const toggle = (row: "type" | "load") =>
    setOpen((current) => (current === row ? null : row));
  const rirAllowed =
    !!onOpenRir && !cardio && !drop && set.measure !== "seconds";
  const sectionLabel = t(
    SECTION_OPTIONS.find((o) => o.value === set.section)!.label,
  );
  const loadLabel = t(LOAD_OPTIONS.find((o) => o.value === key)!.label, {
    unit,
  });
  return (
    <>
      {(onAddWarmup || canAddDrop) && (
        <div className="list set-sheet-group">
          {onAddWarmup && (
            <ListRow
              tone="accent"
              leading={<Flame size={20} aria-hidden="true" />}
              title={t("set.addWarmup")}
              sub={t("set.addWarmupSub")}
              onClick={onAddWarmup}
            />
          )}
          {canAddDrop && (
            <ListRow
              tone="accent"
              leading={<ArrowDown size={20} aria-hidden="true" />}
              title={drop ? t("set.addAnotherDrop") : t("set.addDrop")}
              sub={tips ? t("set.addDropSub") : undefined}
              onClick={onAddDrop}
            />
          )}
        </div>
      )}
      <div className="list set-sheet-group">
        {drop ? (
          <p className="sheet-note set-sheet-note">{t("set.dropNote")}</p>
        ) : (
          <>
            <ListRow
              title={t("set.rowType")}
              value={sectionLabel}
              chevron
              onClick={() => toggle("type")}
            />
            <Reveal>
              {open === "type" && (
                <div className="set-sheet-choice">
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
            </Reveal>
          </>
        )}
        {rirAllowed && (
          <ListRow
            title={t("set.rowRir")}
            value={rirRowValue(set)}
            chevron
            onClick={onOpenRir}
          />
        )}
        {!cardio && (
          <>
            <ListRow
              title={t("set.rowLoad")}
              value={loadLabel}
              chevron
              onClick={() => toggle("load")}
            />
            <Reveal>
              {open === "load" && (
                <div className="set-sheet-choice">
                  <div className="set-sheet-loads">
                    <Segmented
                      label={t("set.loadForSet")}
                      value={key}
                      options={LOAD_OPTIONS.map((option) => ({
                        ...option,
                        label: t(option.label, { unit }),
                        disabled: set.done || !allowed.includes(option.value),
                      }))}
                      onChange={onLoadKey}
                    />
                  </div>
                  {/* What BW stands for, and the weight it counts. */}
                  <p className="sheet-hint">
                    {bodyWeightKg === null ? (
                      <>
                        {t("set.bwExplainNotSet")}{" "}
                        <Link to="/settings">{t("set.bwSetInSettings")}</Link>
                      </>
                    ) : (
                      t("set.bwExplain", {
                        weight: formatWeight(bodyWeightKg, unit),
                      })
                    )}
                    {". "}
                    {t("set.noneExplain")}
                  </p>
                </div>
              )}
            </Reveal>
          </>
        )}
      </div>
      {set.done && (
        <p className="sheet-hint">
          {cardio
            ? t("set.uncheckToChangeType")
            : t("set.uncheckToChangeTypeLoad")}
        </p>
      )}
      <div className="list set-sheet-group">
        <ListRow
          tone="danger"
          leading={<Trash2 size={20} aria-hidden="true" />}
          title={deleteLabel(set, dropCount)}
          onClick={onDelete}
        />
      </div>
    </>
  );
}

/** The sheet a set's badge opens. The page behind stays readable. */
export default function SetSheet({
  open,
  onClose,
  contentRef,
  onPointerDownOutside,
  onCloseAutoFocus,
  name,
  ...body
}: BodyProps & {
  open: boolean;
  onClose: () => void;
  /** The exercise's name, in the title: "Set 3 · Knäböj". */
  name?: string;
  contentRef: Ref<HTMLDivElement>;
  /** A press outside the sheet: a set's field there takes the number pad. */
  onPointerDownOutside?: ComponentProps<typeof Sheet>["onPointerDownOutside"];
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { t } = useT();
  const { previous, target } = body;
  // "Förra 100 kg × 5 · mål 100 × 6".
  const sub =
    previous && target
      ? t("set.sheetSub", { previous, target })
      : previous
        ? t("set.sheetSubPrevious", { previous })
        : target
          ? t("set.sheetSubTarget", { target })
          : undefined;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      backdrop="light"
      contentRef={contentRef}
      onPointerDownOutside={onPointerDownOutside}
      onCloseAutoFocus={onCloseAutoFocus}
      title={
        name
          ? t("set.sheetTitle", { set: body.badge.title, name })
          : body.badge.title
      }
      description={sub}
    >
      <SetSheetBody {...body} />
    </Sheet>
  );
}
