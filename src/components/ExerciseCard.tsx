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
  workingSetChange,
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
  prefixedLoad,
  withLoadKey,
} from "@/lib/load-keys";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import {
  type CardioFields,
  type CardioMetric,
  cardioGridColumns,
  cardioTotals,
  defaultCardioFields,
  isCardioSet,
  paceUnit,
  totalsLabel,
} from "@/lib/cardio";
import { useKeepAboveSheet } from "@/hooks/useKeepAboveSheet";
import { useStableCallback } from "@/hooks/useStableCallback";
import SetLine from "@/components/workout/SetLine";
import SetSheet from "@/components/workout/SetSheet";
import LoadCountSheet from "@/components/workout/LoadCountSheet";
import ExerciseMenuSheet from "@/components/workout/ExerciseMenuSheet";
import ReorderSetsSheet from "@/components/workout/ReorderSetsSheet";
import CardioFieldsSheet from "@/components/workout/CardioFieldsSheet";
import ChoiceSheet from "@/components/ui/ChoiceSheet";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import type { WeightUnit } from "@/lib/units";
import { useT } from "@/i18n/useT";

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
  /** What the plan set for this exercise: "Plan week 3: 85 kg" or "Deload week". */
  planNote?: string;
  // Callbacks take the card's exercise, so a parent can pass one stable
  // function to every card and memoised cards skip unchanged renders.
  onChange: (exercise: Exercise) => void;
  onMove: (exercise: Exercise, step: -1 | 1) => void;
  onRemove: (exercise: Exercise) => void;
  /** Opens the shared "Swap exercise" picker for this card. */
  onChangeExercise: (exercise: Exercise) => void;
  /** Called when a set is newly checked as done. */
  onSetDone?: () => void;
  /**
   * A cardio exercise's chosen fields (useCardioFields). Without them the
   * exercise's defaults show and "Fields…" is not offered.
   */
  cardioFields?: CardioFields;
  /** Saves the fields chosen with "Fields…" for this exercise. */
  onCardioFields?: (exerciseId: string, fields: CardioFields) => void;
};

/** The one sheet this card has open: a set's, or the exercise's own. */
type OpenSheet =
  | { kind: "set"; setId: string }
  | { kind: "loadCount" }
  | { kind: "unit" }
  | { kind: "count" }
  | { kind: "menu" }
  | { kind: "reorder" }
  | { kind: "fields" }
  | null;

/** One exercise in the workout editor: its sets, one line each, and its sheets. */
/**
 * Previous wraps in the narrow column, so tie the words that belong together
 * ("12.5 kg", "× 8") with no-break spaces: "BW + 12.5 kg" / "× 12" rather than
 * "BW + 12.5" / "kg × 12".
 */
const keepTogether = (label: string) =>
  label
    .replace(/(\S) \+ /, "$1 +\u00a0")
    .replace(/(\d) (kg|lb)/, "$1\u00a0$2")
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
  planNote,
  onChange,
  onMove,
  onRemove,
  onChangeExercise,
  onSetDone,
  cardioFields: chosenFields,
  onCardioFields,
}: ExerciseCardProps) {
  const ex = mode === "plan" ? withoutChecks(planned) : planned;
  const { sets } = ex;
  const headingId = useId();
  const { t } = useT();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  // The unit is the device's; the kg heading switches it for every screen.
  const [{ weightUnit }, setPreferences] = useTrainingPreferences();
  const setSheetRef = useRef<HTMLDivElement>(null);
  const openSetId = sheet?.kind === "set" ? sheet.setId : null;
  useKeepAboveSheet(openSetId, setSheetRef);
  // The Set sheet keeps its set while it slides out, after `sheet` is cleared.
  const shownSetId = useRef<string | null>(null);
  if (openSetId) shownSetId.current = openSetId;
  const shownIndex = sets.findIndex((s) => s.id === shownSetId.current);
  const shown = shownIndex >= 0 ? sets[shownIndex] : undefined;

  const cardio = sets.some(isCardioSet);
  const cardioFields = chosenFields ?? defaultCardioFields(ex.exerciseId);
  const unit = cardioFields.distanceUnit;
  const heading = (metric: CardioMetric) =>
    metric === "time"
      ? t("exercise.colTime")
      : metric === "distance"
        ? unit
        : metric === "pace"
          ? paceUnit(unit)
          : metric === "level"
            ? t("exercise.colLevel")
            : metric === "incline"
              ? t("exercise.colIncline")
              : metric === "calories"
                ? "kcal"
                : t("exercise.colHeartRate");
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
  const setChange = mode === "log" ? workingSetChange(sets, lastSession) : null;
  const previousOf = (index: number) => {
    const result = previousResult(lastSession?.sets ?? [], sets, index);
    return result ? keepTogether(labelSet(result)) : undefined;
  };

  return (
    <section
      className="card ex-card"
      aria-labelledby={headingId}
      data-unit={weightUnit}
    >
      <div className="ex-head">
        <div className="ex-titles">
          <h2 id={headingId} className="ex-title">
            {ex.name}
          </h2>
          {mode === "log" && lastSession && (
            <p className="ex-last">
              {t("exercise.last")}{" "}
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
          {planNote && mode === "log" && (
            <p className="ex-last ex-plan-note">{planNote}</p>
          )}
          {setChange && (
            <p className="ex-last ex-set-change">
              {t("exercise.workingSetsNote", {
                sets: countLabel(setChange.now, "working set"),
                last: setChange.last,
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("exercise.options", { name: ex.name })}
          aria-haspopup="dialog"
          onClick={() => setSheet({ kind: "menu" })}
        >
          <MoreHorizontal size={23} aria-hidden="true" />
        </button>
      </div>
      {cardio ? (
        <div className="set-columns" data-mode={mode} data-kind="cardio">
          <span>{t("exercise.colSet")}</span>
          <span
            className="cardio-fields"
            style={{
              gridTemplateColumns: cardioGridColumns(
                cardioFields.fields.length,
              ),
            }}
          >
            {cardioFields.fields.map((metric) => (
              <span key={metric}>{heading(metric)}</span>
            ))}
          </span>
          {mode === "log" && <span>{t("exercise.colDone")}</span>}
        </div>
      ) : (
        <div
          className={`set-columns${prefixedLoad(defaultKey) ? " load-prefix" : ""}`}
          data-mode={mode}
        >
          <span>{t("exercise.colSet")}</span>
          {mode === "log" && (
            <span className="set-previous-heading">
              {t("exercise.colPrevious")}
            </span>
          )}
          {/* The headings pick the unit and the count; the rest of Load and
              count is in the exercise's menu. */}
          <button
            type="button"
            className="set-heading-btn"
            aria-haspopup="dialog"
            aria-label={`${loadHeading(defaultKey)}, ${t("unit.title")}`}
            onClick={() => setSheet({ kind: "unit" })}
          >
            {loadHeading(defaultKey)}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="set-heading-btn"
            aria-haspopup="dialog"
            aria-label={`${countHeading(sets)}, ${t("load.count")}`}
            onClick={() => setSheet({ kind: "count" })}
          >
            {countHeading(sets)}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {mode === "log" && <span>{t("exercise.colDone")}</span>}
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
          weightUnit={weightUnit}
          cardioFields={cardio ? cardioFields : undefined}
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
        {t("exercise.addSet")}
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
      {!cardio && (
        <ChoiceSheet<WeightUnit>
          open={sheet?.kind === "unit"}
          onClose={close}
          title={t("unit.title")}
          value={weightUnit}
          options={[
            { value: "kg", label: t("unit.kg") },
            { value: "lb", label: t("unit.lb") },
          ]}
          hint={t("unit.note")}
          onChoose={(unit) => setPreferences({ weightUnit: unit })}
        />
      )}
      {!cardio && (
        <ChoiceSheet<"reps" | "seconds">
          open={sheet?.kind === "count"}
          onClose={close}
          title={t("load.count")}
          value={exerciseMeasure(sets)}
          options={[
            { value: "reps", label: t("load.reps") },
            { value: "seconds", label: t("load.hold") },
          ]}
          hint={t("load.appliesUnchecked")}
          onChoose={(measure) => changeSets(applyExerciseCount(sets, measure))}
        />
      )}
      <ExerciseMenuSheet
        open={sheet?.kind === "menu"}
        onClose={close}
        name={ex.name}
        hint={
          cardio
            ? undefined
            : `${loadHeading(defaultKey)} · ${countHeading(sets).toLocaleLowerCase()}`
        }
        canMoveUp={!isFirst}
        canMoveDown={!isLast}
        onLoadAndCount={
          cardio ? undefined : () => setSheet({ kind: "loadCount" })
        }
        fieldsHint={
          cardio ? cardioFields.fields.map(heading).join(" · ") : undefined
        }
        onFields={
          cardio && onCardioFields
            ? () => setSheet({ kind: "fields" })
            : undefined
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
      {cardio && onCardioFields && (
        <CardioFieldsSheet
          open={sheet?.kind === "fields"}
          onClose={close}
          name={ex.name}
          value={cardioFields}
          onChange={(fields) => onCardioFields(ex.exerciseId, fields)}
        />
      )}
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
