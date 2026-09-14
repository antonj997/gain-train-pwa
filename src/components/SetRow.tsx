import { Check, Minus } from "lucide-react";
import { type WorkoutSet, validSet } from "@/data/model";
export default function SetRow({
  editing = false,
  showOptions = false,
  set,
  index,
  name,
  previous,
  onChange,
  onRemove,
}: {
  editing?: boolean;
  showOptions?: boolean;
  set: WorkoutSet;
  index: number;
  name: string;
  previous?: string;
  onChange: (s: WorkoutSet) => void;
  onRemove: () => void;
}) {
  return (
    <div className={"set-block " + (set.done ? "set-done" : "")}>
      <div className="set-row">
        <span className="set-number">{index + 1}</span>
        <input
          aria-label={name + " set " + (index + 1) + " weight"}
          type="number"
          inputMode="decimal"
          min="0"
          max="10000"
          step="0.5"
          placeholder={set.load === "bodyweight" ? "BW" : "kg"}
          disabled={set.load === "bodyweight"}
          value={set.load === "bodyweight" ? "" : (set.weight ?? "")}
          onChange={(e) =>
            onChange({
              ...set,
              weight: e.target.value === "" ? null : Number(e.target.value),
              done: editing ? set.done : false,
            })
          }
        />
        <input
          aria-label={name + " set " + (index + 1) + " reps"}
          type="number"
          inputMode="numeric"
          min="1"
          max="10000"
          placeholder="reps"
          value={set.reps ?? ""}
          onChange={(e) =>
            onChange({
              ...set,
              reps: e.target.value === "" ? null : Number(e.target.value),
              done: editing ? set.done : false,
            })
          }
        />
        <button
          className={"done-button " + (set.done ? "checked" : "")}
          aria-label={
            (set.done ? "Uncheck" : "Complete") +
            " " +
            name +
            " set " +
            (index + 1)
          }
          aria-pressed={set.done}
          disabled={!validSet(set)}
          onClick={() => onChange({ ...set, done: !set.done })}
        >
          <Check size={21} />
        </button>
        <button
          className="icon-button subtle"
          aria-label={"Remove " + name + " set " + (index + 1)}
          onClick={onRemove}
        >
          <Minus size={18} />
        </button>
      </div>
      <div className="set-meta">
        <span>{previous ? "Last: " + previous : "No previous set"}</span>
        {showOptions ? (
          <select
            aria-label={name + " set " + (index + 1) + " type"}
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
        ) : (
          <span>
            {set.section === "warmup"
              ? "Warm-up"
              : set.section === "winddown"
                ? "Cool-down"
                : "Working set"}
          </span>
        )}
      </div>
    </div>
  );
}
