import { type Exercise, type WorkoutSet } from "@/data/model";
import { resizePlannedSets } from "@/lib/workout-editor";
import {
  changeSetLoad,
  changeSetMeasure,
  changeExtraWeight,
  hasExtraWeight,
} from "@/lib/set-load";
import SetNumberInput from "@/components/SetNumberInput";
import {
  changeSetNumber,
  getSetInputText,
  hasSetInputText,
} from "@/lib/set-input";
import SortableSetList from "@/components/SortableSetList";
import "@/styles/set-editing.css";

export default function RoutinePlan({
  exercise,
  onChange,
}: {
  exercise: Exercise;
  onChange: (exercise: Exercise) => void;
}) {
  const first = exercise.sets[0];
  const timed = first?.measure === "seconds";
  const countOptions = Array.from({ length: 20 }, (_, i) => i + 1);
  if (exercise.sets.length > 20) countOptions.push(exercise.sets.length);
  const changeAll = (change: (set: WorkoutSet) => WorkoutSet) =>
    onChange({
      ...exercise,
      sets: exercise.sets.map((set) =>
        change({
          ...set,
          bodyWeightKg: undefined,
          done: false,
        }),
      ),
    });
  return (
    <div className="routine-plan">
      <div className="routine-plan-controls">
        <label>
          Sets
          <select
            aria-label={`${exercise.name} planned set count`}
            value={exercise.sets.length}
            onChange={(e) =>
              onChange(resizePlannedSets(exercise, Number(e.target.value)))
            }
          >
            {countOptions.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <label>
          Load
          <select
            aria-label={`${exercise.name} planned load`}
            value={first?.load ?? "weight"}
            disabled={timed}
            onChange={(e) =>
              changeAll((set) =>
                changeSetLoad(set, e.target.value as WorkoutSet["load"]),
              )
            }
          >
            <option value="weight">Weight (kg)</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="assisted">Assisted (kg)</option>
          </select>
        </label>
        <label>
          Measure
          <select
            aria-label={`${exercise.name} planned measure`}
            value={timed ? "seconds" : "reps"}
            onChange={(e) =>
              changeAll((set) =>
                changeSetMeasure(set, e.target.value as "reps" | "seconds"),
              )
            }
          >
            <option value="reps">Reps</option>
            <option value="seconds">Seconds</option>
          </select>
        </label>
      </div>
      {first?.load === "bodyweight" && (
        <label className="check-label extra-weight-toggle">
          <input
            type="checkbox"
            role="switch"
            aria-label={`${exercise.name} planned extra weight`}
            checked={hasExtraWeight(first)}
            onChange={(event) =>
              changeAll((set) => changeExtraWeight(set, event.target.checked))
            }
          />
          Extra weight
        </label>
      )}
      <SortableSetList
        sets={exercise.sets}
        name={exercise.name}
        onReorder={(sets) => onChange({ ...exercise, sets })}
      >
        {(set, index, handle) => (
          <div className="routine-planned-set" key={set.id}>
            {handle}
            {(set.load !== "bodyweight" || hasExtraWeight(set)) && (
              <label>
                {hasExtraWeight(set)
                  ? "BW + kg"
                  : set.load === "assisted"
                    ? "Assist kg"
                    : "kg"}
                <SetNumberInput
                  inputMode="decimal"
                  min="0"
                  max="10000"
                  step="any"
                  placeholder="Optional"
                  aria-label={`${exercise.name} planned set ${index + 1} ${hasExtraWeight(set) ? "added " : ""}kg`}
                  value={set.weight}
                  inputText={getSetInputText(set, "weight")}
                  aria-invalid={getSetInputText(set, "weight") !== undefined}
                  onValueChange={(value, text) =>
                    onChange({
                      ...exercise,
                      sets: exercise.sets.map((s) =>
                        s.id === set.id
                          ? changeSetNumber(
                              { ...s, done: false },
                              "weight",
                              value,
                              text,
                            )
                          : s,
                      ),
                    })
                  }
                />
              </label>
            )}
            <label>
              {timed ? "Seconds" : "Reps"}
              <SetNumberInput
                inputMode="numeric"
                min="1"
                max="10000"
                step="1"
                placeholder="Optional"
                aria-label={`${exercise.name} planned set ${index + 1} ${timed ? "seconds" : "reps"}`}
                value={set.reps}
                inputText={getSetInputText(set, "reps")}
                aria-invalid={getSetInputText(set, "reps") !== undefined}
                onValueChange={(value, text) =>
                  onChange({
                    ...exercise,
                    sets: exercise.sets.map((s) =>
                      s.id === set.id
                        ? changeSetNumber(
                            { ...s, done: false },
                            "reps",
                            value,
                            text,
                          )
                        : s,
                    ),
                  })
                }
              />
            </label>
            <label>
              Type
              <select
                aria-label={`${exercise.name} planned set ${index + 1} type`}
                value={set.section}
                onChange={(e) =>
                  onChange({
                    ...exercise,
                    sets: exercise.sets.map((s) =>
                      s.id === set.id
                        ? {
                            ...s,
                            section: e.target.value as WorkoutSet["section"],
                          }
                        : s,
                    ),
                  })
                }
              >
                <option value="warmup">Warm-up</option>
                <option value="working">Working set</option>
                <option value="winddown">Cool-down</option>
              </select>
            </label>
            {hasSetInputText(set) && (
              <p className="field-error routine-set-error">
                Enter numeric set values before saving.
              </p>
            )}
          </div>
        )}
      </SortableSetList>
    </div>
  );
}
