import type { Dispatch } from "react";
import {
  Plus,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
  ListOrdered,
  Check,
} from "lucide-react";
import { type Exercise, type WorkoutSet, labelSet, newSet } from "@/data/model";
import {
  initialSet,
  previousSetFor,
  setProfileOrdinal,
  type LastSession,
} from "@/data/workouts";
import type { ExerciseOptions, OptionsAction } from "@/lib/exercise-options";
import {
  changeSetLoad,
  changeSetMeasure,
  changeExtraWeight,
  hasExtraWeight,
} from "@/lib/set-load";
import SetRow from "@/components/SetRow";
import SortableSetList from "@/components/SortableSetList";

type Props = {
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
  options: ExerciseOptions;
  changeOptions: Dispatch<OptionsAction>;
  /** The last session with this exercise, for previous-result hints. */
  lastSession?: LastSession;
  bodyWeightKg: number | null;
  nextSetId?: string;
  onFocusSet: (setId: string) => void;
  onChange: (exercise: Exercise) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
  /** Called when a set is newly checked as done. */
  onSetDone: () => void;
};

/** One exercise in the workout editor: its options, load controls and sets. */
export default function ExerciseCard({
  exercise: ex,
  isFirst,
  isLast,
  options,
  changeOptions,
  lastSession,
  bodyWeightKg,
  nextSetId,
  onFocusSet,
  onChange,
  onMove,
  onRemove,
  onSetDone,
}: Props) {
  const editableSet = ex.sets.find((s) => !s.done) ?? ex.sets[0];
  const hasEditableSets = ex.sets.some((s) => !s.done);
  const timed = editableSet?.measure === "seconds";
  const mixedProfiles =
    new Set(
      ex.sets.map(
        (s) => `${s.load}:${hasExtraWeight(s)}:${s.measure ?? "reps"}`,
      ),
    ).size > 1;
  const mixedMeasures =
    new Set(ex.sets.map((s) => s.measure ?? "reps")).size > 1;
  const optionsOpen = options?.id === ex.id;
  const organizing = optionsOpen && options.editing;
  const changeSets = (change: (set: WorkoutSet) => WorkoutSet) =>
    onChange({ ...ex, sets: ex.sets.map(change) });
  return (
    <section
      className="exercise-card"
      data-options-open={optionsOpen ? "" : undefined}
    >
      <div className="exercise-heading">
        <h2>{ex.name}</h2>
        <button
          className="icon-button"
          aria-label={"Options for " + ex.name}
          aria-expanded={optionsOpen}
          aria-controls={`exercise-options-${ex.id}`}
          onClick={() =>
            changeOptions(
              optionsOpen ? { type: "close" } : { type: "open", id: ex.id },
            )
          }
        >
          <MoreHorizontal size={23} />
        </button>
      </div>
      {optionsOpen && (
        <div
          className="exercise-actions"
          id={`exercise-options-${ex.id}`}
          role="group"
          aria-label={`Options for ${ex.name}`}
        >
          <button
            type="button"
            className="text-button set-edit-menu-toggle"
            role="switch"
            aria-label={`Edit sets for ${ex.name}`}
            aria-checked={organizing}
            onClick={() => changeOptions({ type: "edit", id: ex.id })}
          >
            <ListOrdered size={17} aria-hidden="true" />
            Edit sets
            <span className="set-edit-switch-track" aria-hidden="true">
              <span className="set-edit-switch-thumb">
                {organizing && <Check size={12} />}
              </span>
            </span>
            <span className="set-edit-switch-state" aria-hidden="true">
              {organizing ? "On" : "Off"}
            </span>
          </button>
          <button
            className="text-button"
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={17} />
            Up
          </button>
          <button
            className="text-button"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={17} />
            Down
          </button>
          <button className="text-button danger" onClick={onRemove}>
            <Trash2 size={17} />
            Remove exercise
          </button>
        </div>
      )}
      <div className="exercise-load-controls">
        <label>
          Load
          <select
            aria-label={ex.name + " load type"}
            value={editableSet?.load ?? "weight"}
            disabled={timed || !hasEditableSets}
            onChange={(e) =>
              changeSets((s) =>
                changeSetLoad(s, e.target.value as WorkoutSet["load"]),
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
            aria-label={ex.name + " measure"}
            value={timed ? "seconds" : "reps"}
            disabled={!hasEditableSets}
            onChange={(e) =>
              changeSets((s) =>
                changeSetMeasure(s, e.target.value as "reps" | "seconds"),
              )
            }
          >
            <option value="reps">Reps</option>
            <option value="seconds">Seconds</option>
          </select>
        </label>
        {editableSet?.load === "bodyweight" && (
          <label className="check-label extra-weight-toggle">
            <input
              type="checkbox"
              role="switch"
              aria-label={`${ex.name} extra weight`}
              checked={hasExtraWeight(editableSet)}
              disabled={!hasEditableSets}
              onChange={(event) =>
                changeSets((s) => changeExtraWeight(s, event.target.checked))
              }
            />
            Extra weight
          </label>
        )}
      </div>
      <div className={`set-labels${organizing ? " set-compact-labels" : ""}`}>
        <span>Set</span>
        <span>
          {mixedProfiles
            ? "Load"
            : editableSet?.load === "bodyweight"
              ? hasExtraWeight(editableSet)
                ? "BW + kg"
                : "Load"
              : editableSet?.load === "assisted"
                ? "Assist kg"
                : "kg"}
        </span>
        <span>{mixedMeasures ? "Reps / sec" : timed ? "Seconds" : "Reps"}</span>
        {organizing && <span className="set-type-label">Type</span>}
        <span>Done</span>
        <span />
      </div>
      <SortableSetList
        key={organizing ? "organizing" : "logging"}
        sets={ex.sets}
        name={ex.name}
        onReorder={(sets) => onChange({ ...ex, sets })}
      >
        {(s, i, handle) => {
          const previous = previousSetFor(
            lastSession?.sets ?? [],
            s,
            setProfileOrdinal(ex.sets, i),
          );
          return (
            <SetRow
              compact={organizing}
              showProfile={mixedProfiles}
              reorderHandle={handle}
              bodyWeightKg={bodyWeightKg}
              next={nextSetId === s.id}
              key={s.id}
              set={s}
              index={i}
              name={ex.name}
              previous={previous ? labelSet(previous) : undefined}
              previousDate={previous ? lastSession?.date : undefined}
              onFocus={() => onFocusSet(s.id)}
              onChange={(next) => {
                changeSets((x) => (x.id === s.id ? next : x));
                if (!s.done && next.done) onSetDone();
              }}
              onRemove={() =>
                onChange({ ...ex, sets: ex.sets.filter((x) => x.id !== s.id) })
              }
            />
          );
        }}
      </SortableSetList>
      <button
        className="add-set"
        onClick={() =>
          onChange({
            ...ex,
            sets: [
              ...ex.sets,
              ex.sets.length
                ? newSet(ex.sets.at(-1))
                : initialSet(ex.exerciseId),
            ],
          })
        }
      >
        <Plus size={18} />
        Add set
      </button>
    </section>
  );
}
