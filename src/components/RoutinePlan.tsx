import { type Exercise, type WorkoutSet } from "@/data/model";
import { resizePlannedSets } from "@/lib/workout-editor";

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
  const changeAll = (patch: Partial<WorkoutSet>) =>
    onChange({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set, ...patch, done: false })),
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
              changeAll({
                load: e.target.value as WorkoutSet["load"],
                ...(e.target.value === "bodyweight" ? { weight: null } : {}),
              })
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
              changeAll({
                measure: e.target.value as "reps" | "seconds",
                reps: null,
                ...(e.target.value === "seconds"
                  ? { load: "bodyweight", weight: null }
                  : {}),
              })
            }
          >
            <option value="reps">Reps</option>
            <option value="seconds">Seconds</option>
          </select>
        </label>
      </div>
      {exercise.sets.map((set, index) => (
        <div className="routine-planned-set" key={set.id}>
          <span>Set {index + 1}</span>
          {set.load !== "bodyweight" && (
            <label>
              {set.load === "assisted" ? "Assist kg" : "kg"}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="10000"
                step="any"
                placeholder="Optional"
                aria-label={`${exercise.name} planned set ${index + 1} kg`}
                value={set.weight ?? ""}
                onChange={(e) =>
                  onChange({
                    ...exercise,
                    sets: exercise.sets.map((s) =>
                      s.id === set.id
                        ? {
                            ...s,
                            weight:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          }
                        : s,
                    ),
                  })
                }
              />
            </label>
          )}
          <label>
            {timed ? "Seconds" : "Reps"}
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="10000"
              step="1"
              placeholder="Optional"
              aria-label={`${exercise.name} planned set ${index + 1} ${timed ? "seconds" : "reps"}`}
              value={set.reps ?? ""}
              onChange={(e) =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.map((s) =>
                    s.id === set.id
                      ? {
                          ...s,
                          reps:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }
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
              <option value="working">Working</option>
              <option value="warmup">Warm-up</option>
              <option value="winddown">Cool-down</option>
            </select>
          </label>
        </div>
      ))}
    </div>
  );
}
