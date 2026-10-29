import { memo, useCallback, useId, useRef, useState } from "react";
import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import {
  type Exercise,
  type WorkoutSet,
  labelSet,
  validSet,
} from "@/data/model";
import {
  type ExerciseDefaults,
  type LastSession,
  previousResult,
} from "@/data/workouts";
import {
  addDrop,
  changeSection,
  dropGroup,
  isDrop,
  removeSetOrDrop,
  setBadge,
} from "@/data/drops";
import {
  appendSet,
  checkHintFor,
  groupComplete,
  toggleGroupCompletion,
  withoutChecks,
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
import { useKeepAboveSheet } from "@/hooks/useKeepAboveSheet";
import { useStableCallback } from "@/hooks/useStableCallback";
import SetLine from "@/components/workout/SetLine";
import SetSheet from "@/components/workout/SetSheet";
import LoadCountSheet from "@/components/workout/LoadCountSheet";
import ExerciseMenuSheet from "@/components/workout/ExerciseMenuSheet";
import ReorderSetsSheet from "@/components/workout/ReorderSetsSheet";

export type ExerciseCardProps = {
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
  /** Checked sets' values can be edited in place: editing a finished workout. */
  unlockChecked?: boolean;
  /** A custom exercise's saved defaults, for a set added from scratch. */
  defaults?: ExerciseDefaults;
  // Callbacks take the card's exercise, so a parent can pass one stable
  // function to every card and memoised cards skip unchanged renders.
  onChange: (exercise: Exercise) => void;
  onMove: (exercise: Exercise, step: -1 | 1) => void;
  onRemove: (exercise: Exercise) => void;
  /** Opens the shared "Change exercise" picker for this card. */
  onChangeExercise: (exercise: Exercise) => void;
  /** Called when a set is newly checked as done. */
  onSetDone?: () => void;
};

/** The one sheet this card has open: a set's, or the exercise's own. */
type OpenSheet =
  | { kind: "set"; setId: string }
  | { kind: "loadCount" }
  | { kind: "menu" }
  | { kind: "reorder" }
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

/** SetLine skips a render when nothing it shows changed; its callbacks are stable. */
const SetLineMemo = memo(SetLine, (a, b) => {
  for (const key of Object.keys(b) as (keyof typeof b)[])
    if (key !== "badge" && a[key] !== b[key]) return false;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    a.badge.text === b.badge.text &&
    a.badge.tone === b.badge.tone &&
    a.badge.label === b.badge.label &&
    a.badge.title === b.badge.title &&
    a.badge.name === b.badge.name
  );
});

function ExerciseCard({
  exercise: planned,
  isFirst,
  isLast,
  mode = "log",
  lastSession,
  bodyWeightKg = null,
  nextSetId,
  unlockChecked = false,
  defaults,
  onChange,
  onMove,
  onRemove,
  onChangeExercise,
  onSetDone,
}: ExerciseCardProps) {
  const ex = mode === "plan" ? withoutChecks(planned) : planned;
  const { sets } = ex;
  const headingId = useId();
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
  const close = useCallback(() => setSheet(null), []);
  const changeSets = (next: WorkoutSet[]) => onChange({ ...ex, sets: next });
  // Stable for SetLine: they always act on this render's sets.
  const updateSet = useStableCallback((next: WorkoutSet) =>
    changeSets(sets.map((s) => (s.id === next.id ? next : s))),
  );
  const toggleDone = useStableCallback((setId: string) => {
    const next = toggleGroupCompletion(sets, setId, bodyWeightKg);
    if (next === sets) return;
    changeSets(next);
    const was = sets.find((s) => s.id === setId);
    const now = next.find((s) => s.id === setId);
    if (was && !was.done && now?.done) onSetDone?.();
  });
  const openSet = useCallback(
    (setId: string) => setSheet({ kind: "set", setId }),
    [],
  );
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
        <SetLineMemo
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
          unlocked={unlockChecked}
          canCheck={groupComplete(sets, i)}
          checkHint={checkHintFor(sets, i)}
          onOpenSheet={openSet}
          onChange={updateSet}
          onToggleDone={toggleDone}
        />
      ))}
      <button
        type="button"
        className="btn-quiet ex-add-set"
        onClick={() => onChange(appendSet(ex, defaults))}
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
        onChangeExercise={() => {
          close();
          onChangeExercise(planned);
        }}
        onReorder={() => setSheet({ kind: "reorder" })}
        onMoveUp={() => onMove(planned, -1)}
        onMoveDown={() => onMove(planned, 1)}
        onRemove={() => {
          close();
          onRemove(planned);
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

export default memo(ExerciseCard);
