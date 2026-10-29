import { useId, useRef, useState } from "react";
import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import {
  type Exercise,
  type WorkoutSet,
  labelSet,
  validSet,
} from "@/data/model";
import { type LastSession, previousResult } from "@/data/workouts";
import {
  addDrop,
  changeSection,
  dropGroup,
  isDrop,
  removeSetOrDrop,
  setBadge,
} from "@/data/drops";
import {
  type ExerciseTarget,
  appendSet,
  changeDiscardsSets,
  changeExercise,
  groupComplete,
  loggedSetCount,
  toggleGroupCompletion,
} from "@/lib/workout-editor";
import {
  applyExerciseCount,
  applyExerciseLoad,
  countHeading,
  defaultLoadKey,
  exerciseMeasure,
  loadHeading,
  loadMarker,
  withLoadKey,
} from "@/lib/load-keys";
import { localizedDate } from "@/lib/dates";
import { cardioTotals, isCardioSet, totalsLabel } from "@/lib/cardio";
import { useData } from "@/contexts/useData";
import { customExercises } from "@/data/selectors";
import { toastWithUndo } from "@/lib/undo-toast";
import { useKeepAboveSheet } from "@/hooks/useKeepAboveSheet";
import SetLine from "@/components/workout/SetLine";
import SetSheet from "@/components/workout/SetSheet";
import LoadCountSheet from "@/components/workout/LoadCountSheet";
import ExercisePicker from "@/components/ExercisePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import ExerciseMenuSheet from "@/components/workout/ExerciseMenuSheet";
import ReorderSetsSheet from "@/components/workout/ReorderSetsSheet";

type Props = {
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
  /**
   * "plan" is a routine's exercise: no previous results, checks, rest or next
   * set, and its sets are never checked.
   */
  mode?: "log" | "plan";
  /** The last session with this exercise, for previous-result hints. */
  lastSession?: LastSession;
  bodyWeightKg?: number | null;
  nextSetId?: string;
  onChange: (exercise: Exercise) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
  /** Called when a set is newly checked as done. */
  onSetDone?: () => void;
};

/** The one sheet this card has open: a set's, or the exercise's own. */
type OpenSheet =
  | { kind: "set"; setId: string }
  | { kind: "loadCount" }
  | { kind: "menu" }
  | { kind: "reorder" }
  | { kind: "change" }
  | null;

/** One exercise in the workout editor: its sets, one line each, and its sheets. */
/**
 * Previous wraps in the narrow column, so tie the words that belong together
 * ("12.5 kg", "× 8") with no-break spaces: "BW + 12.5 kg" / "× 12" rather than
 * "BW + 12.5" / "kg × 12".
 */
const keepTogether = (label: string) =>
  label
    .replace(/BW \+ /, "BW +\u00a0")
    .replace(/(\d) kg/, "$1\u00a0kg")
    .replace(/× (\d)/, "×\u00a0$1");

export default function ExerciseCard({
  exercise: planned,
  isFirst,
  isLast,
  mode = "log",
  lastSession,
  bodyWeightKg = null,
  nextSetId,
  onChange,
  onMove,
  onRemove,
  onSetDone,
}: Props) {
  // A planned set is never checked, even in a routine saved that way earlier.
  const ex =
    mode === "plan" && planned.sets.some((s) => s.done)
      ? {
          ...planned,
          sets: planned.sets.map((s) =>
            s.done ? { ...s, done: false, bodyWeightKg: undefined } : s,
          ),
        }
      : planned;
  const { sets } = ex;
  const headingId = useId();
  const { state } = useData();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const setSheetRef = useRef<HTMLDivElement>(null);
  const openSetId = sheet?.kind === "set" ? sheet.setId : null;
  useKeepAboveSheet(openSetId, setSheetRef);
  // The Set sheet keeps its set while it slides out, after `sheet` is cleared.
  const shownSetId = useRef<string | null>(null);
  if (openSetId) shownSetId.current = openSetId;
  const shownIndex = sets.findIndex((s) => s.id === shownSetId.current);
  const shown = shownIndex >= 0 ? sets[shownIndex] : undefined;

  const cardio = sets.some(isCardioSet);
  const defaultKey = defaultLoadKey(sets);
  const close = () => setSheet(null);
  // The Undo toast outlives this render; it must change the latest workout.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [pendingTarget, setPendingTarget] = useState<ExerciseTarget | null>(
    null,
  );
  const applyChange = (target: ExerciseTarget) => {
    const before = planned;
    onChange(changeExercise(ex, target));
    toastWithUndo(
      `Changed to ${target.name}`,
      async () => onChangeRef.current(before),
      "Could not undo the change.",
    );
  };
  const chooseExercise = (items: ExerciseTarget[]) => {
    const target = items[0];
    if (!target) return;
    if (changeDiscardsSets(ex, target) && loggedSetCount(ex) > 0)
      setPendingTarget(target);
    else applyChange(target);
  };
  const changeSets = (next: WorkoutSet[]) => onChange({ ...ex, sets: next });
  const updateSet = (next: WorkoutSet) =>
    changeSets(sets.map((s) => (s.id === next.id ? next : s)));
  const toggleDone = (setId: string) => {
    const next = toggleGroupCompletion(sets, setId, bodyWeightKg);
    if (next === sets) return;
    changeSets(next);
    const was = sets.find((s) => s.id === setId);
    const now = next.find((s) => s.id === setId);
    if (was && !was.done && now?.done) onSetDone?.();
  };
  const previousOf = (index: number) => {
    const result = previousResult(lastSession?.sets ?? [], sets, index);
    return result ? keepTogether(labelSet(result)) : undefined;
  };

  return (
    <section className="card ex-card" aria-labelledby={headingId}>
      <div className="ex-head">
        <div className="ex-titles">
          <h2 id={headingId} className="ex-title">
            {ex.name}
          </h2>
          {mode === "log" && lastSession && (
            <p className="ex-last">
              Last:{" "}
              {cardio
                ? totalsLabel(
                    cardioTotals(
                      lastSession.sets.filter(
                        (set) => isCardioSet(set) && set.done && validSet(set),
                      ),
                    ),
                  )
                : localizedDate(lastSession.date, {
                    day: "numeric",
                    month: "short",
                  })}
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${ex.name} options`}
          aria-haspopup="dialog"
          onClick={() => setSheet({ kind: "menu" })}
        >
          <MoreHorizontal size={23} aria-hidden="true" />
        </button>
      </div>
      {cardio ? (
        <div className="set-columns" data-mode={mode} data-kind="cardio">
          <span>Set</span>
          <span>Time</span>
          <span>km</span>
          <span>Level</span>
          <span>kcal</span>
          {mode === "log" && <span>Done</span>}
        </div>
      ) : (
        <div className="set-columns" data-mode={mode}>
          <span>Set</span>
          {mode === "log" && (
            <span className="set-previous-heading">Previous</span>
          )}
          <button
            type="button"
            className="set-heading-btn"
            aria-haspopup="dialog"
            onClick={() => setSheet({ kind: "loadCount" })}
          >
            {loadHeading(defaultKey)}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="set-heading-btn"
            aria-haspopup="dialog"
            onClick={() => setSheet({ kind: "loadCount" })}
          >
            {countHeading(sets)}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {mode === "log" && <span>Done</span>}
        </div>
      )}
      {sets.map((s, i) => (
        <SetLine
          key={s.id}
          set={s}
          mode={mode}
          name={ex.name}
          badge={setBadge(sets, i)}
          previous={previousOf(i)}
          marker={loadMarker(s, defaultKey)}
          bodyWeightKg={mode === "log" ? bodyWeightKg : null}
          next={nextSetId === s.id}
          editing={openSetId === s.id}
          canCheck={groupComplete(sets, i)}
          checkHint={
            validSet(s) && !groupComplete(sets, i)
              ? "Fill in or delete its drops to check this set."
              : undefined
          }
          onOpenSheet={() => setSheet({ kind: "set", setId: s.id })}
          onChange={updateSet}
          onToggleDone={() => toggleDone(s.id)}
        />
      ))}
      <button
        type="button"
        className="btn-quiet ex-add-set"
        onClick={() =>
          onChange(
            appendSet(
              ex,
              customExercises(state.records).find((r) => r.id === ex.exerciseId)
                ?.payload.category,
            ),
          )
        }
      >
        <Plus size={18} aria-hidden="true" />
        Add set
      </button>
      {shown && (
        <SetSheet
          open={openSetId !== null}
          onClose={close}
          contentRef={setSheetRef}
          badge={setBadge(sets, shownIndex)}
          previous={previousOf(shownIndex)}
          set={shown}
          dropCount={
            isDrop(shown) ? 0 : dropGroup(sets, shownIndex).end - shownIndex - 1
          }
          exerciseDefault={defaultKey}
          cardio={isCardioSet(shown)}
          onSection={(section) =>
            changeSets(changeSection(sets, shown.id, section))
          }
          onLoadKey={(key) => updateSet(withLoadKey(shown, key))}
          onAddDrop={() => {
            changeSets(addDrop(sets, shown.id));
            close();
          }}
          onDelete={() => {
            changeSets(removeSetOrDrop(sets, shown.id));
            close();
          }}
        />
      )}
      {!cardio && (
        <LoadCountSheet
          open={sheet?.kind === "loadCount"}
          onClose={close}
          loadKey={defaultKey}
          measure={exerciseMeasure(sets)}
          onLoadKey={(key) => changeSets(applyExerciseLoad(sets, key))}
          onMeasure={(measure) => changeSets(applyExerciseCount(sets, measure))}
          onDone={close}
        />
      )}
      <ExerciseMenuSheet
        open={sheet?.kind === "menu"}
        onClose={close}
        name={ex.name}
        hint={
          cardio
            ? undefined
            : `${loadHeading(defaultKey)} · ${countHeading(sets).toLowerCase()}`
        }
        canMoveUp={!isFirst}
        canMoveDown={!isLast}
        onLoadAndCount={
          cardio ? undefined : () => setSheet({ kind: "loadCount" })
        }
        onChangeExercise={() => setSheet({ kind: "change" })}
        onReorder={() => setSheet({ kind: "reorder" })}
        onMoveUp={() => onMove(-1)}
        onMoveDown={() => onMove(1)}
        onRemove={() => {
          close();
          onRemove();
        }}
      />
      <ExercisePicker
        single
        title="Change exercise"
        excludeId={ex.exerciseId}
        open={sheet?.kind === "change"}
        onClose={close}
        onAdd={chooseExercise}
      />
      <ConfirmDialog
        open={!!pendingTarget}
        title={<>Change to {pendingTarget?.name}?</>}
        description={`Your ${loggedSetCount(ex)} logged ${loggedSetCount(ex) === 1 ? "set doesn't" : "sets don't"} fit a ${cardio ? "strength" : "cardio"} exercise and will be cleared.`}
        cancelLabel="Keep exercise"
        confirmLabel="Change exercise"
        onCancel={() => setPendingTarget(null)}
        onConfirm={() => {
          const target = pendingTarget;
          setPendingTarget(null);
          if (target) applyChange(target);
        }}
      />
      <ReorderSetsSheet
        open={sheet?.kind === "reorder"}
        exercise={ex}
        onReorder={changeSets}
        onClose={close}
      />
    </section>
  );
}
