import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { type WorkoutSet, validSet } from "@/data/model";
import { getSetIssues } from "@/lib/workout-editor";
import { localizedDate } from "@/lib/dates";
import { bodyWeightForSet, toggleSetCompletion } from "@/lib/set-editing";
import { hasExtraWeight } from "@/lib/set-load";
import SetNumberInput from "@/components/SetNumberInput";
import { changeSetNumber, getSetInputText } from "@/lib/set-input";
import "@/styles/set-editing.css";

export default function SetRow({
  compact = false,
  showProfile = false,
  reorderHandle,
  bodyWeightKg = null,
  next = false,
  set,
  index,
  name,
  previous,
  previousDate,
  onFocus,
  onChange,
  onRemove,
}: {
  compact?: boolean;
  showProfile?: boolean;
  reorderHandle?: ReactNode;
  bodyWeightKg?: number | null;
  next?: boolean;
  set: WorkoutSet;
  index: number;
  name: string;
  previous?: string;
  previousDate?: string;
  onFocus?: () => void;
  onChange: (s: WorkoutSet) => void;
  onRemove: () => void;
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
  const label = `${name} set ${index + 1}`;
  const timed = set.measure === "seconds";
  const displayedBodyWeight = bodyWeightForSet(set, bodyWeightKg);
  const extraWeight = hasExtraWeight(set);
  const issues = getSetIssues(set);
  const errorId = `set-errors-${set.id}`;
  const lockId = `set-locked-${set.id}`;
  const showLock = set.done && lockedAttempt;
  const visibleIssues = Object.entries(issues)
    .filter(
      ([field]) =>
        getSetInputText(set, field as "weight" | "reps") !== undefined ||
        (field === "weight" ? set.weight !== null : set.reps !== null),
    )
    .map(([, issue]) => issue);
  if (set.done && !validSet(set) && !visibleIssues.length)
    visibleIssues.push("Uncheck this set to correct its missing values.");
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
  const sectionSelect = (
    <select
      className="set-type"
      aria-label={`${label} type`}
      value={set.section}
      disabled={set.done}
      onChange={(e) =>
        !set.done &&
        onChange({ ...set, section: e.target.value as WorkoutSet["section"] })
      }
    >
      <option value="warmup">Warm-up</option>
      <option value="working">Working set</option>
      <option value="winddown">Cool-down</option>
    </select>
  );
  return (
    <div
      data-set-id={set.id}
      onFocusCapture={onFocus}
      className={`set-block${compact ? " set-compact" : ""}${set.done ? " set-done" : ""}${next && !compact ? " set-next" : ""}${checkedNow ? " set-just-checked" : ""}`}
    >
      <div className="set-row">
        {compact ? (
          reorderHandle
        ) : (
          <span
            className="set-number"
            aria-label={
              next ? `Set ${index + 1}, next set` : `Set ${index + 1}`
            }
          >
            {index + 1}
          </span>
        )}
        {set.load === "bodyweight" && !extraWeight ? (
          <span
            className={`bodyweight-value${displayedBodyWeight !== null ? " with-weight" : ""}`}
            aria-label={
              displayedBodyWeight === null
                ? "Bodyweight"
                : `Bodyweight ${displayedBodyWeight} kilograms`
            }
          >
            {displayedBodyWeight ?? "BW"}
            {displayedBodyWeight !== null && <small>kg BW</small>}
          </span>
        ) : (
          <SetNumberInput
            aria-label={`${label} ${extraWeight ? "added weight" : set.load === "assisted" ? "assistance" : "weight"} kg`}
            aria-invalid={
              !!issues.weight &&
              (set.weight !== null ||
                getSetInputText(set, "weight") !== undefined)
            }
            aria-describedby={
              [
                visibleIssues.length && issues.weight ? errorId : "",
                showLock ? lockId : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            inputMode="decimal"
            min="0"
            max="10000"
            step="any"
            placeholder={extraWeight ? "+ kg" : "kg"}
            value={set.weight}
            inputText={getSetInputText(set, "weight")}
            readOnly={set.done}
            onLockedAttempt={() => setLockedAttempt(true)}
            onValueChange={(value, text) => updateNumber("weight", value, text)}
          />
        )}
        <SetNumberInput
          aria-label={`${label} ${timed ? "seconds" : "reps"}`}
          aria-invalid={
            !!issues.reps &&
            (set.reps !== null || getSetInputText(set, "reps") !== undefined)
          }
          aria-describedby={
            [
              visibleIssues.length && issues.reps ? errorId : "",
              showLock ? lockId : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
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
        <button
          className={`done-button${set.done ? " checked" : ""}${showLock ? " unlock-highlight" : ""}`}
          aria-label={`${set.done ? "Uncheck" : "Complete"} ${label}`}
          aria-pressed={set.done}
          aria-describedby={
            showLock ? lockId : visibleIssues.length ? errorId : undefined
          }
          disabled={!set.done && !validSet(set)}
          onClick={() => {
            setLockedAttempt(false);
            onChange(toggleSetCompletion(set, bodyWeightKg));
          }}
        >
          <Check size={21} />
        </button>
        {compact && sectionSelect}
        <button
          className="icon-button subtle remove-set"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <Minus size={18} />
        </button>
      </div>
      {(extraWeight || showProfile) && (
        <p className="set-extra-load">
          {extraWeight
            ? "BW + added kg"
            : set.load === "bodyweight"
              ? "BW"
              : set.load === "assisted"
                ? "Assist kg"
                : "kg"}
          {showProfile ? (timed ? " · Seconds" : " · Reps") : ""}
          {extraWeight && displayedBodyWeight !== null
            ? ` · ${displayedBodyWeight} kg BW`
            : ""}
        </p>
      )}
      {!compact && (
        <div className="set-meta">
          <span className="set-previous">
            {previous ? (
              <>
                <span>
                  Last
                  {previousDate && (
                    <>
                      :{" "}
                      <time
                        dateTime={previousDate}
                        title={localizedDate(previousDate)}
                        aria-label={localizedDate(previousDate)}
                      >
                        {localizedDate(previousDate, {
                          day: "numeric",
                          month: "numeric",
                          year: "2-digit",
                        })}
                      </time>
                    </>
                  )}
                </span>
                <span>{previous}</span>
              </>
            ) : index === 0 ? (
              "No previous log"
            ) : (
              ""
            )}
          </span>
          {sectionSelect}
        </div>
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
