import { useState, type Ref } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, Trash2 } from "lucide-react";
import type { WorkoutSet } from "@/data/model";
import { isDrop, type SetBadgeInfo } from "@/data/drops";
import { allowedLoadKeys, loadKeyOf, type LoadKey } from "@/lib/load-keys";
import { useProfile } from "@/contexts/useProfile";
import Sheet from "@/components/ui/Sheet";
import Segmented from "@/components/ui/Segmented";
import { useT } from "@/i18n/useT";
import { t, type MessageKey } from "@/i18n";
import { formatWeight, getWeightUnit } from "@/lib/units";
import { RIR_VALUES, rirOf, rirValueText } from "@/lib/rir";

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
  /** Sets or clears the set's reps in reserve; without it there is no RIR row. */
  onRir?: (rir: number | null) => void;
  onAddDrop: () => void;
  onDelete: () => void;
};

const LOAD_OPTIONS: { value: LoadKey; label: MessageKey }[] = [
  { value: "weight", label: "set.optWeight" },
  { value: "bw", label: "set.optBw" },
  { value: "bwplus", label: "set.optBwPlus" },
  { value: "assisted", label: "set.optAssist" },
  { value: "none", label: "set.optNone" },
];

type RirChoice = "off" | "0" | "1" | "2" | "3";

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
  cardio = false,
  onSection,
  onLoadKey,
  onRir,
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
  const { bodyWeightKg } = useProfile();
  const unit = getWeightUnit();
  // RIR is optional and rare: one quiet "Add RIR" until it is used.
  const rir = rirOf(set);
  const [rirShown, setRirShown] = useState(rir !== null);
  const rirAllowed =
    !!onRir && !cardio && set.measure !== "seconds" && set.measure !== "cardio";
  return (
    <>
      {/* Adding goes first; deleting is last and set apart. */}
      {canAddDrop && (
        <button
          type="button"
          className="btn-secondary set-sheet-add-drop"
          onClick={onAddDrop}
        >
          <ArrowDown size={20} aria-hidden="true" />
          {drop ? t("set.addAnotherDrop") : t("set.addDrop")}
        </button>
      )}
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
      {rirAllowed &&
        (rirShown || rir !== null ? (
          <div className="sheet-field">
            <span className="sheet-label" aria-hidden="true">
              {t("set.rirTitle")}
            </span>
            <Segmented<RirChoice>
              label={t("set.rirTitle")}
              value={rir === null ? "off" : (String(rir) as RirChoice)}
              options={[
                { value: "off", label: "–" },
                ...RIR_VALUES.map((value) => ({
                  value: String(value) as RirChoice,
                  label: rirValueText(value),
                })),
              ]}
              onChange={(value) =>
                onRir!(value === "off" ? null : Number(value))
              }
            />
            <span className="sr-only">
              {rir === null ? t("set.rirNone") : ""}
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="set-sheet-add-rir"
            onClick={() => setRirShown(true)}
          >
            {t("set.addRir")}
          </button>
        ))}
      {!cardio && (
        <div className="sheet-field">
          <span className="sheet-label" aria-hidden="true">
            {t("set.loadForSet")}
          </span>
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
              t("set.bwExplain", { weight: formatWeight(bodyWeightKg, unit) })
            )}
            {". "}
            {t("set.noneExplain")}
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
      <button
        type="button"
        className="btn-danger set-sheet-delete"
        onClick={onDelete}
      >
        <Trash2 size={20} aria-hidden="true" />
        {deleteLabel(set, dropCount)}
      </button>
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
          {(body.previous || body.target) && (
            <span className="sheet-title-aside">
              {[
                body.previous && t("set.lastTime", { value: body.previous }),
                body.target && t("set.targetToday", { value: body.target }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </span>
      }
    >
      <SetSheetBody {...body} />
    </Sheet>
  );
}
