import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { type WorkoutSet, validSet } from "@/data/model";
import { isDrop, type SetBadgeInfo } from "@/data/drops";
import { getSetIssues } from "@/lib/workout-editor";
import { bodyWeightForSet } from "@/lib/set-editing";
import { hasExtraWeight } from "@/lib/set-load";
import type { LoadMarker } from "@/lib/load-keys";
import { changeSetNumber, getSetInputText } from "@/lib/set-input";
import SetNumberInput from "@/components/SetNumberInput";
import SetBadge from "@/components/workout/SetBadge";
import "@/styles/workout.css";

// What a screen reader hears after the set's name, by the kind of load.
const LOAD_NAMES = {
  plus: "added kilograms",
  minus: "assistance kilograms",
  kg: "kilograms",
} as const;

/**
 * One set as a single line: badge, previous result, load, count and done.
 * `mode: "plan"` is a routine's planned set, which is never checked; drops have
 * no check of their own either, since their set above is checked for them.
 */
export default function SetLine({
  set,
  mode,
  name,
  badge,
  previous,
  marker,
  bodyWeightKg = null,
  next = false,
  editing = false,
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
  /** How this set's load differs from the exercise's default load. */
  marker: LoadMarker;
  bodyWeightKg?: number | null;
  /** The next set to do: drawn with an accent. */
  next?: boolean;
  /** Its Set sheet is open. */
  editing?: boolean;
  /** The set, and any drops it has, can be checked. */
  canCheck: boolean;
  /** Why the check is disabled, for screen readers. */
  checkHint?: string;
  onOpenSheet: () => void;
  onChange: (set: WorkoutSet) => void;
  onToggleDone?: () => void;
  onFocus?: () => void;
}) {
  const [checkedNow, setCheckedNow] = useState(false);
  const [lockedAttempt, setLockedAttempt] = useState(false);
  const wasDone = useRef(set.done);
  useEffect(() => {
    if (set.done && !wasDone.current) {
      setCheckedNow(true);
      const timeout = window.setTimeout(() => setCheckedNow(false), 200);
      wasDone.current = set.done;
      return () => window.clearTimeout(timeout);
    }
    wasDone.current = set.done;
  }, [set.done]);
  // A drop is unchecked from the set above, so the row cannot clear its own
  // notice: forget it as soon as the row is open again.
  if (lockedAttempt && !set.done) setLockedAttempt(false);

  const drop = isDrop(set);
  // "Set 1" reads as "Bench Press set 1"; "Warm-up set" as "Bench Press warm-up set".
  const label = `${name} ${badge.title.charAt(0).toLowerCase()}${badge.title.slice(1)}`;
  const timed = set.measure === "seconds";
  const extraWeight = hasExtraWeight(set);
  const plainBodyweight =
    marker === "bw" || (set.load === "bodyweight" && !extraWeight);
  const displayedBodyWeight = bodyWeightForSet(set, bodyWeightKg);
  // The marker names what the field shows; with none, the set's own load does.
  const loadName =
    LOAD_NAMES[
      marker === "plus" || marker === "minus" || marker === "kg"
        ? marker
        : extraWeight
          ? "plus"
          : set.load === "assisted"
            ? "minus"
            : "kg"
    ];
  const issues = getSetIssues(set);
  const errorId = `set-errors-${set.id}`;
  const lockId = `set-locked-${set.id}`;
  const hintId = `set-hint-${set.id}`;
  const showLock = set.done && lockedAttempt;
  const checkDisabled = !set.done && !canCheck;
  const showHint = checkDisabled && !!checkHint;
  const visibleIssues = Object.entries(issues)
    .filter(
      ([field]) =>
        getSetInputText(set, field as "weight" | "reps") !== undefined ||
        (field === "weight" ? set.weight !== null : set.reps !== null),
    )
    .map(([, issue]) => issue);
  if (set.done && !validSet(set) && !visibleIssues.length)
    visibleIssues.push("Uncheck this set to correct its missing values.");
  const describedBy = (field: "weight" | "reps") =>
    [
      visibleIssues.length && issues[field] ? errorId : "",
      showLock ? lockId : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const updateNumber = (
    field: "weight" | "reps",
    value: number | null,
    unfinishedText?: string,
  ) => {
    if (set.done) {
      setLockedAttempt(true);
      return;
    }
    onChange(changeSetNumber(set, field, value, unfinishedText));
  };

  const classes = [
    "set-line",
    set.done && "is-done",
    drop && "is-drop",
    next && "is-next",
    editing && "is-editing",
    checkedNow && "is-just-checked",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div data-set-id={set.id} className={classes} onFocusCapture={onFocus}>
      {next && <span className="sr-only">Next set</span>}
      <SetBadge badge={badge} editing={editing} onClick={onOpenSheet} />
      <span className="set-previous">{previous || "–"}</span>
      {plainBodyweight ? (
        <span className="set-field set-bodyweight">
          <span aria-hidden="true">
            BW
            {displayedBodyWeight !== null && (
              <small>{` ${displayedBodyWeight} kg`}</small>
            )}
          </span>
          <span className="sr-only">
            {displayedBodyWeight === null
              ? "Bodyweight"
              : `Bodyweight ${displayedBodyWeight} kilograms`}
          </span>
        </span>
      ) : (
        <div
          className={`set-field${marker === "plus" || marker === "minus" ? " has-prefix" : ""}${marker === "kg" ? " has-suffix" : ""}`}
        >
          {(marker === "plus" || marker === "minus") && (
            <span className="set-marker set-marker-prefix" aria-hidden="true">
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
            placeholder={marker === "kg" ? undefined : "kg"}
            value={set.weight}
            inputText={getSetInputText(set, "weight")}
            readOnly={set.done}
            onLockedAttempt={() => setLockedAttempt(true)}
            onValueChange={(value, text) => updateNumber("weight", value, text)}
          />
          {marker === "kg" && (
            <span className="set-marker set-marker-suffix" aria-hidden="true">
              kg
            </span>
          )}
        </div>
      )}
      <div className="set-field">
        <SetNumberInput
          aria-label={`${label} ${timed ? "seconds" : "reps"}`}
          aria-invalid={
            !!issues.reps &&
            (set.reps !== null || getSetInputText(set, "reps") !== undefined)
          }
          aria-describedby={describedBy("reps")}
          inputMode="numeric"
          min="1"
          max="10000"
          step="1"
          placeholder={timed ? "sec" : "reps"}
          value={set.reps}
          inputText={getSetInputText(set, "reps")}
          readOnly={set.done}
          onLockedAttempt={() => setLockedAttempt(true)}
          onValueChange={(value, text) => updateNumber("reps", value, text)}
        />
      </div>
      {mode === "log" && !drop ? (
        <>
          <button
            type="button"
            className={`set-check${showLock ? " unlock-highlight" : ""}`}
            aria-label={`${set.done ? "Uncheck" : "Complete"} ${label}`}
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
            disabled={checkDisabled}
            onClick={() => {
              setLockedAttempt(false);
              onToggleDone?.();
            }}
          >
            <Check size={21} />
          </button>
          {showHint && (
            <span id={hintId} className="sr-only">
              {checkHint}
            </span>
          )}
        </>
      ) : (
        <span className="set-line-spacer" aria-hidden="true" />
      )}
      {!!visibleIssues.length && (
        <p id={errorId} className="set-errors field-error">
          {visibleIssues.join(" ")}
        </p>
      )}
      {showLock && (
        <p id={lockId} className="set-errors field-error" role="status">
          Uncheck this set to edit its values.
        </p>
      )}
    </div>
  );
}
