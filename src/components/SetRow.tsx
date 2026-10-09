import { useEffect, useRef, useState } from "react";
import { Check, Minus } from "lucide-react";
import { type WorkoutSet, validSet } from "@/data/model";
import { getSetIssues } from "@/lib/workout-editor";
import { localizedDate } from "@/lib/dates";

export default function SetRow({
  editing = false,
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
  const issues = getSetIssues(set);
  const invalidEntry =
    set.done ||
    (set.weight !== null && !!issues.weight) ||
    (set.reps !== null && !!issues.reps);
  const errorId = `set-errors-${set.id}`;
  const updateNumber = (field: "weight" | "reps", value: string) => {
    if (set.done && !editing) setEditedAfterCompletion(true);
    onChange({
      ...set,
      [field]: value === "" ? null : Number(value),
      done: editing ? set.done : false,
    });
  };
  return (
    <div
      data-set-id={set.id}
      onFocusCapture={onFocus}
      className={`set-block${set.done ? " set-done" : ""}${next ? " set-next" : ""}${checkedNow ? " set-just-checked" : ""}`}
    >
      <div className="set-row">
        <span
          className="set-number"
          aria-label={next ? `Set ${index + 1}, next set` : `Set ${index + 1}`}
        >
          {index + 1}
        </span>
        {set.load === "bodyweight" ? (
          <span className="bodyweight-value" aria-label="Bodyweight">
            BW
          </span>
        ) : (
          <input
            aria-label={`${label} ${set.load === "assisted" ? "assistance" : "weight"} kg`}
            aria-invalid={set.weight !== null && !!issues.weight}
            aria-describedby={issues.weight ? errorId : undefined}
            type="number"
            inputMode="decimal"
            min="0"
            max="10000"
            step="any"
            placeholder="kg"
            value={set.weight ?? ""}
            onChange={(e) => updateNumber("weight", e.target.value)}
          />
        )}
        <input
          aria-label={`${label} ${timed ? "seconds" : "reps"}`}
          aria-invalid={set.reps !== null && !!issues.reps}
          aria-describedby={issues.reps ? errorId : undefined}
          type="number"
          inputMode="numeric"
          min="1"
          max="10000"
          step="1"
          placeholder={timed ? "sec" : "reps"}
          value={set.reps ?? ""}
          onChange={(e) => updateNumber("reps", e.target.value)}
        />
        <button
          className={`done-button${set.done ? " checked" : ""}`}
          aria-label={`${set.done ? "Uncheck" : "Complete"} ${label}`}
          aria-pressed={set.done}
          aria-describedby={!validSet(set) ? errorId : undefined}
          disabled={!set.done && !validSet(set)}
          onClick={() => {
            setEditedAfterCompletion(false);
            onChange({ ...set, done: !set.done });
          }}
        >
          <Check size={21} />
        </button>
        <button
          className="icon-button subtle remove-set"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <Minus size={18} />
        </button>
      </div>
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
        <select
          aria-label={`${label} type`}
          value={set.section}
          onChange={(e) =>
            onChange({
              ...set,
              section: e.target.value as WorkoutSet["section"],
            })
          }
        >
          <option value="working">Working set</option>
          <option value="warmup">Warm-up</option>
          <option value="winddown">Cool-down</option>
        </select>
      </div>
      {!!Object.keys(issues).length && (
        <p
          id={errorId}
          className={`set-errors ${invalidEntry ? "field-error" : "set-hint"}`}
        >
          {Object.values(issues).join(" ")}
        </p>
      )}
      {editedAfterCompletion && !set.done && !Object.keys(issues).length && (
        <p className="set-errors set-hint">Edited · check to confirm</p>
      )}
    </div>
  );
}
