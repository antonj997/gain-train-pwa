import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { type WorkoutSet, validSet } from "@/data/model";
import { isDrop, type SetBadgeInfo } from "@/data/drops";
import { getSetIssues } from "@/lib/workout-editor";
import { bodyWeightForSet } from "@/lib/set-editing";
import { hasExtraWeight } from "@/lib/set-load";
import { motionMs } from "@/lib/slow-motion";
import {
  formatWeightValue,
  fromUnit,
  getWeightUnit,
  toUnit,
  type WeightUnit,
} from "@/lib/units";
import type { LoadMarker } from "@/lib/load-keys";
import {
  changeSetNumber,
  getSetInputText,
  type InputField,
} from "@/lib/set-input";
import {
  type CardioFields,
  type CardioKey,
  type CardioMetric,
  cardioGridStyle,
  formatDistance,
  formatDuration,
  formatPace,
  paceUnit,
  parseDistance,
  parseDuration,
} from "@/lib/cardio";
import { HOLD_MAX } from "@/lib/rep-hold";
import SetNumberInput from "@/components/SetNumberInput";
import SetBadge from "@/components/workout/SetBadge";
import { ImprovedMark } from "@/components/DoneSetList";
import "@/styles/workout.css";
// The module translator, not a hook: the workout page remounts on a new
// language, and tests render this row with a minimal hook host.
import { t } from "@/i18n";

// What a screen reader hears after the set's name, by the kind of load.
const LOAD_NAMES = {
  kg: { plus: "set.loadPlus", minus: "set.loadMinus", kg: "set.loadKg" },
  lb: { plus: "set.loadPlusLb", minus: "set.loadMinusLb", kg: "set.loadLb" },
} as const;

// What a row shows when the card passes no choice: the original four fields.
const ALL_CARDIO_FIELDS: CardioFields = {
  fields: ["time", "distance", "level", "calories"],
  distanceUnit: "km",
};

type CardioInput = {
  metric: Exclude<CardioMetric, "pace">;
  field: CardioKey;
  name: string;
  placeholder: string;
  inputMode: "numeric" | "decimal";
  timer?: boolean;
  parse?: (text: string) => number | null;
  format?: (value: number | null) => string;
};

/** The typed fields a cardio row can show, in their column order. */
function cardioInputs({ distanceUnit: unit }: CardioFields): CardioInput[] {
  return [
    {
      metric: "time",
      field: "durationSec",
      name: t("set.fieldTime"),
      placeholder: t("set.phTime"),
      // The number pad; the colons come by themselves (timerEntry).
      inputMode: "numeric",
      timer: true,
      parse: parseDuration,
      format: formatDuration,
    },
    {
      metric: "distance",
      field: "distanceM",
      name: t(`set.fieldDistance_${unit}`),
      placeholder: unit,
      inputMode: unit === "m" ? "numeric" : "decimal",
      parse: (text) => parseDistance(text, unit),
      format: (value) => formatDistance(value, unit),
    },
    {
      metric: "level",
      field: "level",
      name: t("set.fieldLevel"),
      placeholder: t("set.phLevel"),
      inputMode: "numeric",
    },
    {
      metric: "incline",
      field: "inclinePct",
      name: t("set.fieldIncline"),
      placeholder: "%",
      inputMode: "decimal",
    },
    {
      metric: "calories",
      field: "calories",
      name: t("set.fieldCalories"),
      placeholder: "kcal",
      inputMode: "numeric",
    },
    {
      metric: "heartRate",
      field: "heartRate",
      name: t("set.fieldHeartRate"),
      placeholder: "bpm",
      inputMode: "numeric",
    },
  ];
}

/**
 * One set as a single line: badge, previous result, load, count and done.
 * `mode: "plan"` is a routine's planned set: just badge, load and count, with
 * no previous result and no check. In a log, drops have no check of their own
 * either, since their set above is checked for them.
 */
export default function SetLine({
  set,
  mode,
  name,
  badge,
  previous,
  improved = false,
  marker,
  bodyWeightKg = null,
  weightUnit,
  next = false,
  cardioFields = ALL_CARDIO_FIELDS,
  hold = false,
  editing = false,
  unlocked = false,
  canCheck,
  checkHint,
  onOpenSheet,
  onChange,
  onToggleDone,
  onFocus,
}: {
  set: WorkoutSet;
  mode: "log" | "plan";
  name: string;
  badge: SetBadgeInfo;
  previous?: string;
  /** Checked and better than the same set last time: a small up arrow by Previous. */
  improved?: boolean;
  /** How this set's load differs from the exercise's default load. */
  marker: LoadMarker;
  bodyWeightKg?: number | null;
  /**
   * How weights show and are typed; stored in kg. Passed so a memoised row
   * redraws when it changes; the module's unit is the default.
   */
  weightUnit?: WeightUnit;
  /** The next set to do: drawn with an accent. */
  next?: boolean;
  /**
   * The fields a cardio set shows and its distance unit. A value in a field
   * that is not shown stays saved; History lists it.
   */
  cardioFields?: CardioFields;
  /**
   * The exercise counts "Reps + hold": a reps set shows a hold field (seconds
   * per rep) next to its reps. Without it a set's hold stays saved, unseen.
   */
  hold?: boolean;
  /** Its Set sheet is open. */
  editing?: boolean;
  /**
   * A checked set's values stay editable: editing a finished workout, where
   * every set is checked. A live workout locks them until unchecked.
   */
  unlocked?: boolean;
  /** The set, and any drops it has, can be checked. */
  canCheck: boolean;
  /** Why the check can't be pressed yet; shown under the row when tapped. */
  checkHint?: string;
  /** Called with this set's id, so one function can serve every row. */
  onOpenSheet: (setId: string) => void;
  onChange: (set: WorkoutSet) => void;
  onToggleDone?: (setId: string) => void;
  onFocus?: () => void;
}) {
  const [checkedNow, setCheckedNow] = useState(false);
  const [lockedAttempt, setLockedAttempt] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const wasDone = useRef(set.done);
  useEffect(() => {
    if (set.done && !wasDone.current) {
      setCheckedNow(true);
      const timeout = window.setTimeout(
        () => setCheckedNow(false),
        motionMs(200),
      );
      wasDone.current = set.done;
      return () => window.clearTimeout(timeout);
    }
    wasDone.current = set.done;
  }, [set.done]);
  // A drop is unchecked from the set above, so the row cannot clear its own
  // notice: forget it as soon as the row is open again.
  const locked = set.done && !unlocked;
  if (lockedAttempt && !locked) setLockedAttempt(false);
  // The notices belong to this row: they go away once a tap or focus lands
  // anywhere outside it.
  const row = useRef<HTMLDivElement>(null);
  const noticeShown = lockedAttempt || hintShown;
  useEffect(() => {
    if (!noticeShown) return;
    const away = (event: Event) => {
      if (row.current?.contains(event.target as Node)) return;
      setLockedAttempt(false);
      setHintShown(false);
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("focusin", away, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("focusin", away, true);
    };
  }, [noticeShown]);

  const drop = isDrop(set);
  // Unique within the exercise: "Bench Press set 2", "Bench Press drop 1 after set 2".
  const label = `${name} ${badge.name}`;
  const timed = set.measure === "seconds";
  const cardio = set.measure === "cardio";
  const holdField = hold && !timed && !cardio;
  const extraWeight = hasExtraWeight(set);
  const plainBodyweight =
    marker === "bw" || (set.load === "bodyweight" && !extraWeight);
  const displayedBodyWeight = bodyWeightForSet(set, bodyWeightKg);
  // The marker names what the field shows; with none, the set's own load does.
  const unit = weightUnit ?? getWeightUnit();
  // Pounds show to one decimal, so a typed "132.25" would come back as
  // "132.3" mid-typing. The row remembers what was typed for the kg it stored.
  const typedWeight = useRef<{
    kg: number;
    value: number;
    unit: WeightUnit;
  } | null>(null);
  const typed = typedWeight.current;
  const shownWeight =
    set.weight === null
      ? null
      : typed && typed.kg === set.weight && typed.unit === unit
        ? typed.value
        : toUnit(set.weight, unit);
  const loadName = t(
    LOAD_NAMES[unit][
      marker === "plus" || marker === "minus" || marker === "kg"
        ? marker
        : extraWeight
          ? "plus"
          : set.load === "assisted"
            ? "minus"
            : "kg"
    ],
  );
  const issues = getSetIssues(set);
  const errorId = `set-errors-${set.id}`;
  const lockId = `set-locked-${set.id}`;
  const hintId = `set-hint-${set.id}`;
  const showLock = locked && lockedAttempt;
  const checkDisabled = !set.done && !canCheck;
  const showHint = checkDisabled && !!checkHint;
  // Once the set can be checked, the reason it couldn't is old news.
  if (hintShown && !showHint) setHintShown(false);
  // A blank field in an open row is just not filled in yet; in a checked row
  // that can be edited, it is a mistake to fix before saving.
  const visibleIssues = Object.entries(issues)
    .filter(
      ([field]) =>
        (set.done && unlocked) ||
        getSetInputText(set, field as InputField) !== undefined ||
        (set[field as InputField] ?? null) !== null,
    )
    .map(([, issue]) => issue);
  if (set.done && !validSet(set) && !visibleIssues.length)
    visibleIssues.push(t("set.uncheckToFix"));
  const describedBy = (field: InputField) =>
    [
      visibleIssues.length && issues[field] ? errorId : "",
      showLock ? lockId : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const updateNumber = (
    field: InputField,
    value: number | null,
    unfinishedText?: string,
  ) => {
    if (locked) {
      setLockedAttempt(true);
      return;
    }
    onChange(changeSetNumber(set, field, value, unfinishedText, unlocked));
  };

  const shownMetrics = cardio ? cardioFields.fields : [];
  const inputs = cardio ? cardioInputs(cardioFields) : [];

  const classes = [
    "set-line",
    // Only a field that shows a marker gets wider than three digits need.
    !plainBodyweight &&
      (marker === "plus" || marker === "minus") &&
      "load-prefix",
    !plainBodyweight && marker === "kg" && "load-suffix",
    cardio && "is-cardio",
    hold && !cardio && "has-hold",
    set.done && "is-done",
    drop && "is-drop",
    next && "is-next",
    editing && "is-editing",
    checkedNow && "is-just-checked",
  ]
    .filter(Boolean)
    .join(" ");
  const countField = (
    <div className={`set-field set-count${timed ? " is-timed" : ""}`}>
      {/* A checked row reads like the result: "60 × 8", "BW × 10", "45 s". */}
      {set.done && !timed && (
        <span className="set-times" aria-hidden="true">
          ×
        </span>
      )}
      <SetNumberInput
        aria-label={`${label} ${timed ? t("set.fieldSeconds") : t("set.fieldReps")}`}
        aria-invalid={
          !!issues.reps &&
          (set.reps !== null || getSetInputText(set, "reps") !== undefined)
        }
        aria-describedby={describedBy("reps")}
        inputMode="numeric"
        min="1"
        max="10000"
        step="1"
        placeholder={timed ? t("set.phSec") : t("set.phReps")}
        value={set.reps}
        inputText={getSetInputText(set, "reps")}
        readOnly={locked}
        onLockedAttempt={() => setLockedAttempt(true)}
        onValueChange={(value, text) => updateNumber("reps", value, text)}
      />
      {set.done && timed && set.reps !== null && (
        <span className="set-marker set-seconds" aria-hidden="true">
          s
        </span>
      )}
    </div>
  );
  const holdInput = (
    <div className="set-field set-hold">
      {/* Checked: "60 × 6 · 2 s", the "·" drawn in the gap. */}
      {set.done && set.holdSec != null && (
        <span className="set-times" aria-hidden="true">
          ·
        </span>
      )}
      <SetNumberInput
        aria-label={`${label} ${t("set.fieldHold")}`}
        aria-invalid={
          !!issues.holdSec &&
          ((set.holdSec ?? null) !== null ||
            getSetInputText(set, "holdSec") !== undefined)
        }
        aria-describedby={describedBy("holdSec")}
        inputMode="numeric"
        pattern="[0-9]*"
        min="0"
        max={String(HOLD_MAX)}
        step="1"
        placeholder={set.done ? undefined : t("set.phHold")}
        value={set.holdSec ?? null}
        inputText={getSetInputText(set, "holdSec")}
        readOnly={locked}
        onLockedAttempt={() => setLockedAttempt(true)}
        onValueChange={(value, text) => updateNumber("holdSec", value, text)}
      />
      {set.holdSec != null && (
        <span className="set-marker set-seconds" aria-hidden="true">
          s
        </span>
      )}
    </div>
  );
  return (
    <div
      ref={row}
      data-set-id={set.id}
      data-mode={mode}
      className={classes}
      onFocusCapture={onFocus}
    >
      {next && <span className="sr-only">{t("set.nextSr")}</span>}
      <SetBadge
        badge={badge}
        editing={editing}
        onClick={() => onOpenSheet(set.id)}
      />
      {mode === "log" && !cardio && (
        <span className="set-previous">
          {previous ? (
            <>
              <span className="sr-only">{t("set.previousSr") + " "}</span>
              {previous}
              {improved && set.done && (
                <>
                  {" "}
                  <ImprovedMark />
                </>
              )}
            </>
          ) : (
            <>
              <span aria-hidden="true">–</span>
              <span className="sr-only">{t("set.noPrevious")}</span>
            </>
          )}
        </span>
      )}
      {cardio ? (
        <div className="cardio-fields" style={cardioGridStyle(shownMetrics)}>
          {shownMetrics.map((metric) => {
            if (metric === "pace") {
              const pace = formatPace(
                set.durationSec,
                set.distanceM,
                cardioFields.distanceUnit,
              );
              return (
                <div className="set-field set-pace" key={metric}>
                  <span aria-hidden="true">{pace || "–"}</span>
                  <span className="sr-only">
                    {`${label} ${t("set.fieldPace")}: ${
                      pace
                        ? `${pace} ${paceUnit(cardioFields.distanceUnit)}`
                        : t("set.noPace")
                    }`}
                  </span>
                </div>
              );
            }
            const props = inputs.find((input) => input.metric === metric)!;
            const { field } = props;
            return (
              // A new unit remounts the field, so it shows the value in that unit.
              <div
                className="set-field"
                key={
                  metric === "distance"
                    ? `${metric}-${cardioFields.distanceUnit}`
                    : metric
                }
              >
                <SetNumberInput
                  aria-label={`${label} ${props.name}`}
                  aria-invalid={
                    !!issues[field] &&
                    ((set[field] ?? null) !== null ||
                      getSetInputText(set, field) !== undefined)
                  }
                  aria-describedby={describedBy(field)}
                  inputMode={props.inputMode}
                  pattern={props.inputMode === "numeric" ? "[0-9]*" : undefined}
                  entry={props.timer ? "timer" : "number"}
                  placeholder={props.placeholder}
                  value={set[field] ?? null}
                  inputText={getSetInputText(set, field)}
                  parse={props.parse}
                  format={props.format}
                  readOnly={locked}
                  onLockedAttempt={() => setLockedAttempt(true)}
                  onValueChange={(value, text) =>
                    updateNumber(field, value, text)
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {plainBodyweight ? (
            <span className="set-field set-bodyweight">
              <span aria-hidden="true">
                {t("set.bwShort")}
                {displayedBodyWeight !== null && (
                  <small>{` ${formatWeightValue(displayedBodyWeight, unit)} ${unit}`}</small>
                )}
              </span>
              <span className="sr-only">
                {displayedBodyWeight === null
                  ? t("set.bwSr", { label })
                  : t("set.bwKgSr", {
                      label,
                      kg: formatWeightValue(displayedBodyWeight, unit),
                      unitName: t(unit === "lb" ? "set.loadLb" : "set.loadKg"),
                    })}
              </span>
            </span>
          ) : (
            <div
              className={`set-field${marker === "plus" || marker === "minus" ? " has-prefix" : ""}${marker === "kg" ? " has-suffix" : ""}`}
            >
              {(marker === "plus" || marker === "minus") && (
                <span
                  className="set-marker set-marker-prefix"
                  aria-hidden="true"
                >
                  {marker === "plus" ? "+" : "−"}
                </span>
              )}
              <SetNumberInput
                aria-label={`${label} ${loadName}`}
                aria-invalid={
                  !!issues.weight &&
                  (set.weight !== null ||
                    getSetInputText(set, "weight") !== undefined)
                }
                aria-describedby={describedBy("weight")}
                inputMode="decimal"
                min="0"
                max="10000"
                step="any"
                placeholder={marker === "kg" ? undefined : unit}
                // Shown and typed in the unit; stored in kg. An untouched
                // field never writes, so its exact kg value stays.
                value={shownWeight}
                inputText={getSetInputText(set, "weight")}
                readOnly={locked}
                onLockedAttempt={() => setLockedAttempt(true)}
                onValueChange={(value, text) => {
                  const kg = value === null ? null : fromUnit(value, unit);
                  typedWeight.current =
                    kg === null || value === null ? null : { kg, value, unit };
                  updateNumber("weight", kg, text);
                }}
              />
              {marker === "kg" && (
                <span
                  className="set-marker set-marker-suffix"
                  aria-hidden="true"
                >
                  {unit}
                </span>
              )}
            </div>
          )}
          {holdField ? (
            <div className="set-count-hold">
              {countField}
              {holdInput}
            </div>
          ) : (
            countField
          )}
        </>
      )}
      {mode === "log" && !drop ? (
        <>
          <button
            type="button"
            className={`set-check${showLock ? " unlock-highlight" : ""}`}
            aria-label={
              set.done
                ? t("set.uncheck", { label })
                : t("set.complete", { label })
            }
            aria-pressed={set.done}
            aria-describedby={
              showLock
                ? lockId
                : showHint
                  ? hintId
                  : visibleIssues.length
                    ? errorId
                    : undefined
            }
            // Not `disabled`, so a tap still lands and can say why.
            aria-disabled={checkDisabled || undefined}
            onClick={() => {
              setLockedAttempt(false);
              if (checkDisabled) setHintShown(!!checkHint);
              else onToggleDone?.(set.id);
            }}
          >
            <Check size={21} />
          </button>
          {showHint && !hintShown && (
            <span id={hintId} className="sr-only">
              {checkHint}
            </span>
          )}
        </>
      ) : mode === "log" ? (
        <span className="set-line-spacer" aria-hidden="true" />
      ) : null}
      {!!visibleIssues.length && (
        <p id={errorId} className="set-errors field-error">
          {visibleIssues.join(" ")}
        </p>
      )}
      {showHint && hintShown && (
        <p id={hintId} className="set-errors set-hint" role="status">
          {checkHint}
        </p>
      )}
      {showLock && (
        <p id={lockId} className="set-errors field-error" role="status">
          {t("set.uncheckToEdit")}
        </p>
      )}
    </div>
  );
}
