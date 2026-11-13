import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X } from "lucide-react";
import { type WorkoutSet, validSet } from "@/data/model";
import { isDrop, type SetBadgeInfo } from "@/data/drops";
import { getSetIssues } from "@/lib/workout-editor";
import { bodyWeightForSet } from "@/lib/set-editing";
import { hasExtraWeight } from "@/lib/set-load";
import { padFields, stepPadValue, type PadField } from "@/lib/number-pad";
import { RIR_VALUES, rirLabel, rirOf, rirValueText, withRir } from "@/lib/rir";
import { motionMs } from "@/lib/slow-motion";
import { EASE, MOTION, play, settled } from "@/lib/motion";
import type { SetInputGestures } from "@/lib/set-input";
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
import { ImprovedMark, RecordMark } from "@/components/DoneSetList";
import { NumberPadContext } from "@/components/workout/number-pad-context";
import {
  playCheck,
  playNext,
  playStep,
  playUncheck,
  pressCheck,
  releaseCheck,
} from "@/components/workout/set-motion";
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
  record,
  recordQuiet = false,
  target,
  onFill,
  askRir = false,
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
  /** Checked and better than the same set last time: a small up arrow between Previous and the load. */
  improved?: boolean;
  /**
   * The records this checked set holds so far ("Heaviest weight"): a record
   * mark in the arrow's place. A string, so a memoised row compares it.
   */
  record?: string;
  /** A rep record or estimated 1RM: the mark is quieter than the heaviest weight's. */
  recordQuiet?: boolean;
  /** The set's target under Previous ("Target 87.5 × 5"); the next set only. */
  target?: string;
  /**
   * Fills the set with its target, else last time's result, in one tap on
   * Previous. Called with this set's id.
   */
  onFill?: (setId: string) => void;
  /** After the set is checked, offer its reps in reserve for 4 s (Settings). */
  askRir?: boolean;
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
  const [lockedAttempt, setLockedAttempt] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  // A drop is unchecked from the set above, so the row cannot clear its own
  // notice: forget it as soon as the row is open again.
  const locked = set.done && !unlocked;
  if (lockedAttempt && !locked) setLockedAttempt(false);
  // The notices belong to this row: they go away once a tap or focus lands
  // anywhere outside it.
  const row = useRef<HTMLDivElement>(null);
  // The check's motion plays when the set changes state, not on first show.
  const was = useRef({ done: set.done, next });
  const press = useRef<Animation | null>(null);
  // Ask for RIR after a check (Settings): a compact chooser under the row,
  // once the check's motion is done, for 4 s. It never blocks: everything
  // else still works, and letting it go (or Skip) leaves RIR empty.
  const [asking, setAsking] = useState(false);
  const askTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(askTimer.current), []);
  const canAsk =
    askRir &&
    mode === "log" &&
    !isDrop(set) &&
    set.measure !== "seconds" &&
    set.measure !== "cardio";
  useLayoutEffect(() => {
    const before = was.current;
    was.current = { done: set.done, next };
    const el = row.current;
    if (!el || mode !== "log") return;
    if (set.done !== before.done) {
      press.current?.cancel();
      press.current = null;
      if (set.done) playCheck(el, before.next);
      else playUncheck(el);
      window.clearTimeout(askTimer.current);
      if (!set.done) setAsking(false);
      else if (canAsk && rirOf(set) === null)
        askTimer.current = window.setTimeout(
          () => setAsking(true),
          motionMs(ASK_AFTER_MS),
        );
    } else if (next && !before.next && !set.done) playNext(el);
    // Only a change of state plays; the set's other values do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.done, next, mode]);
  const pressDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    press.current?.cancel();
    press.current = pressCheck(event.currentTarget);
  };
  const pressUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const check = event.currentTarget;
    // The click comes after the finger lifts: if it checked the set, the
    // check's spring has taken over by the next frame.
    requestAnimationFrame(() => {
      if (!press.current) return;
      press.current.cancel();
      press.current = null;
      releaseCheck(check);
    });
  };
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

  // The live workout's number pad: a tap on the load or reps opens it there
  // (on a touch screen it replaces the phone's keyboard), and a drag up or
  // down on the field steps the value without it, one tick per step.
  const pad = useContext(NumberPadContext);
  const padded = pad && mode === "log" && !locked ? padFields(set) : [];
  const stepping = useRef<{ value: number | null } | null>(null);
  const padProps = (field: PadField) => {
    if (!pad || !padded.includes(field)) return {};
    const input = () =>
      row.current?.querySelector<HTMLInputElement>(
        `input[data-pad-field="${field}"]`,
      ) ?? null;
    const gestures: SetInputGestures = {
      tap: () => pad.open(set.id, field),
      stepStart: () => {
        stepping.current = {
          value: field === "weight" ? shownWeight : set.reps,
        };
        input()?.parentElement?.classList.add("is-stepping");
      },
      step: (total, delta) => {
        const value = stepPadValue(
          stepping.current?.value ?? null,
          total,
          field,
          unit,
        );
        if (field === "weight") {
          const kg = value === null ? null : fromUnit(value, unit);
          typedWeight.current =
            kg === null || value === null ? null : { kg, value, unit };
          updateNumber("weight", kg);
        } else updateNumber("reps", value);
        playStep(input(), delta);
      },
      stepEnd: () => {
        stepping.current = null;
        input()?.parentElement?.classList.remove("is-stepping");
      },
    };
    return {
      ...(pad.coarse ? { inputMode: "none" as const } : {}),
      "data-pad-field": field,
      gestures,
      onKeyboardFocus: pad.coarse ? () => pad.open(set.id, field) : undefined,
    };
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
  ]
    .filter(Boolean)
    .join(" ");
  const rir = rirOf(set);
  const countField = (
    <div
      className={`set-field set-count${timed ? " is-timed" : ""}${rir !== null ? " has-rir" : ""}`}
    >
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
        {...padProps("reps")}
      />
      {set.done && timed && set.reps !== null && (
        <span className="set-marker set-seconds" aria-hidden="true">
          s
        </span>
      )}
      {rir !== null && (
        // Chosen in the Set sheet or after the check: small and muted, under
        // the result.
        <span className="set-rir">
          <span aria-hidden="true">{rirLabel(set)}</span>
          <span className="sr-only">
            {t("set.rirSr", { value: rirValueText(rir) })}
          </span>
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
      {/* The green tone that sweeps across the row from the ✓ as it is checked. */}
      {mode === "log" && <span className="set-sweep" aria-hidden="true" />}
      {next && <span className="sr-only">{t("set.nextSr")}</span>}
      <SetBadge
        badge={badge}
        editing={editing}
        onClick={() => onOpenSheet(set.id)}
      />
      {mode === "log" && !cardio && (
        <PreviousCell
          previous={previous}
          target={target}
          next={next}
          onFill={
            onFill && !set.done && (target || previous)
              ? () => {
                  onFill(set.id);
                  for (const input of row.current?.querySelectorAll<HTMLInputElement>(
                    ".set-field input",
                  ) ?? [])
                    playStep(input, 1);
                }
              : undefined
          }
        />
      )}
      {mode === "log" && !cardio && (
        // Its own narrow column between Previous and the load: the record
        // mark, else the up arrow, once the set is checked.
        <span className="set-slot">
          {set.done && record ? (
            // The mark pops in once as the set is checked, with one light
            // sweep across it (set-motion.ts).
            <span
              className={"set-record-pop" + (recordQuiet ? " is-quiet" : "")}
            >
              <RecordMark label={record} quiet={recordQuiet} />
              {!recordQuiet && (
                <span className="set-record-sheen" aria-hidden="true" />
              )}
            </span>
          ) : set.done && improved ? (
            <ImprovedMark />
          ) : null}
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
          {set.load === "none" ? (
            // No load: nothing to type, just a muted dash in the column.
            <span className="set-field set-noload">
              <span aria-hidden="true">–</span>
              <span className="sr-only">{t("set.noLoadSr", { label })}</span>
            </span>
          ) : plainBodyweight ? (
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
                {...padProps("weight")}
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
            onPointerDown={pressDown}
            onPointerUp={pressUp}
            onPointerCancel={pressUp}
            onPointerLeave={pressUp}
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
            {/* Lucide's check, drawn as a stroke when the set is checked. */}
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
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
      {asking && (
        <RirAsk
          label={label}
          value={rir}
          onChoose={(value) => onChange(withRir(set, value))}
          onDone={() => setAsking(false)}
        />
      )}
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

/** How long after a check the RIR chooser comes: once the check's motion is done. */
const ASK_AFTER_MS = 320;
/** How long the RIR chooser stays when nothing is chosen. */
const ASK_FOR_MS = 4000;

/**
 * The Previous column: last time's result and, on the next set, its target
 * under it in the accent.
 * With `onFill` it is a button: one tap fills the set with the target, else
 * with last time's result.
 */
function PreviousCell({
  previous,
  target,
  next,
  onFill,
}: {
  previous?: string;
  target?: string;
  next: boolean;
  onFill?: () => void;
}) {
  const content = (
    <>
      {previous ? (
        <>
          <span className="sr-only">{t("set.previousSr") + " "}</span>
          {previous}
        </>
      ) : (
        <>
          <span aria-hidden="true">–</span>
          <span className="sr-only">{t("set.noPrevious")}</span>
        </>
      )}
      {target && (
        <span className={"set-target" + (next ? " is-next" : "")}>
          <span className="sr-only">{". "}</span>
          {/* It wraps after "Target" if at all, never inside the value. */}
          {target
            .replace(/ ([·×]) /g, "\u00a0$1\u00a0")
            .replace(/(\d) s$/, "$1\u00a0s")}
        </span>
      )}
    </>
  );
  if (!onFill) return <span className="set-previous">{content}</span>;
  return (
    <button
      type="button"
      className="set-previous is-fill"
      // The pad keeps its field: a fill is not a tap outside it.
      data-pad-keep=""
      onMouseDown={(event) => event.preventDefault()}
      onClick={onFill}
    >
      {content}
      <span className="sr-only">
        {". " + (target ? t("set.fillTarget") : t("set.fillPrevious"))}
      </span>
    </button>
  );
}

/**
 * The compact RIR chooser under a just-checked row: 0, 1, 2, 3+ and Skip.
 * It grows in below the row (the rows under it move down; nothing is
 * covered) and folds away after 4 s, on a choice, or on Skip.
 */
function RirAsk({
  label,
  value,
  onChoose,
  onDone,
}: {
  label: string;
  value: number | null;
  onChoose: (value: number) => void;
  onDone: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    const el = box.current;
    const out = play(
      el,
      [
        { height: `${el?.offsetHeight ?? 0}px`, opacity: 1 },
        { height: "0px", opacity: 0 },
      ],
      { duration: MOTION.slot, easing: EASE.in, fill: "forwards" },
    );
    void settled(out).then(() => done.current());
  };
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    play(
      el,
      [
        { height: "0px", opacity: 0 },
        { height: `${el.offsetHeight}px`, opacity: 1 },
      ],
      { duration: MOTION.slot, easing: EASE.out },
    );
    const timer = window.setTimeout(
      () => leaveRef.current(),
      motionMs(ASK_FOR_MS),
    );
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div
      ref={box}
      className="set-rir-ask"
      role="group"
      aria-label={t("set.rirAskLabel", { label })}
      data-pad-keep=""
      // Taps here leave focus (and the number pad) where they were.
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="set-rir-ask-title" aria-hidden="true">
        {t("set.rirAsk")}
      </span>
      {RIR_VALUES.map((rir) => (
        <button
          key={rir}
          type="button"
          className="set-rir-choice"
          aria-pressed={value === rir}
          onClick={() => {
            onChoose(rir);
            leave();
          }}
        >
          {rirValueText(rir)}
        </button>
      ))}
      <button
        type="button"
        className="set-rir-skip"
        aria-label={t("set.rirSkip")}
        title={t("set.rirSkip")}
        onClick={leave}
      >
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
