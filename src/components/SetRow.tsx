import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { type WorkoutSet, validSet } from "@/data/model";
import { getSetIssues } from "@/lib/workout-editor";
import { localizedDate } from "@/lib/dates";
import {
  bodyWeightForSet,
  selectInputValue,
  toggleSetCompletion,
} from "@/lib/set-editing";
import "@/styles/set-editing.css";

export default function SetRow({
  editing = false,
  compact = false,
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
  editing?: boolean;
  compact?: boolean;
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
  const [editedAfterCompletion, setEditedAfterCompletion] = useState(false);
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
  const issues = getSetIssues(set);
  const invalidEntry =
    set.done ||
    (set.weight !== null && !!issues.weight) ||
    (set.reps !== null && !!issues.reps);
  const errorId = `set-errors-${set.id}`;
  const visibleIssues = compact
    ? Object.entries(issues)
        .filter(
          ([field]) =>
            set.done ||
            (field === "weight" ? set.weight !== null : set.reps !== null),
        )
        .map(([, issue]) => issue)
    : Object.values(issues);
  const updateNumber = (field: "weight" | "reps", value: string) => {
    if (set.done && !editing) setEditedAfterCompletion(true);
    onChange({
      ...set,
      [field]: value === "" ? null : Number(value),
      done: editing ? set.done : false,
    });
  };
  const sectionSelect = (
    <select
      className="set-type"
      aria-label={`${label} type`}
      value={set.section}
      onChange={(e) =>
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
        {set.load === "bodyweight" ? (
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
          <input
            aria-label={`${label} ${set.load === "assisted" ? "assistance" : "weight"} kg`}
            aria-invalid={set.weight !== null && !!issues.weight}
            aria-describedby={
              visibleIssues.length && issues.weight ? errorId : undefined
            }
            type="number"
            inputMode="decimal"
            min="0"
            max="10000"
            step="any"
            placeholder="kg"
            value={set.weight ?? ""}
            onFocus={selectInputValue}
            onClick={selectInputValue}
            onChange={(e) => updateNumber("weight", e.target.value)}
          />
        )}
        <input
          aria-label={`${label} ${timed ? "seconds" : "reps"}`}
          aria-invalid={set.reps !== null && !!issues.reps}
          aria-describedby={
            visibleIssues.length && issues.reps ? errorId : undefined
          }
          type="number"
          inputMode="numeric"
          min="1"
          max="10000"
          step="1"
          placeholder={timed ? "sec" : "reps"}
          value={set.reps ?? ""}
          onFocus={selectInputValue}
          onClick={selectInputValue}
          onChange={(e) => updateNumber("reps", e.target.value)}
        />
        {!compact && (
          <button
            className={`done-button${set.done ? " checked" : ""}`}
            aria-label={`${set.done ? "Uncheck" : "Complete"} ${label}`}
            aria-pressed={set.done}
            aria-describedby={!validSet(set) ? errorId : undefined}
            disabled={!set.done && !validSet(set)}
            onClick={() => {
              setEditedAfterCompletion(false);
              onChange(toggleSetCompletion(set, bodyWeightKg));
            }}
          >
            <Check size={21} />
          </button>
        )}
        {compact && sectionSelect}
        <button
          className="icon-button subtle remove-set"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <Minus size={18} />
        </button>
      </div>
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
        <p
          id={errorId}
          className={`set-errors ${invalidEntry ? "field-error" : "set-hint"}`}
        >
          {visibleIssues.join(" ")}
        </p>
      )}
      {!compact &&
        editedAfterCompletion &&
        !set.done &&
        !Object.keys(issues).length && (
          <p className="set-errors set-hint">Edited · check to confirm</p>
        )}
    </div>
  );
}
