import ExerciseAvatar from "@/components/items/ExerciseAvatar";
import { memo, useCallback, useContext, useId, useRef, useState } from "react";
import { ChevronDown, MoreHorizontal, Plus, Target, Timer } from "lucide-react";
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
  countHeading,
  defaultLoadKey,
  exerciseMeasure,
  loadHeading,
  loadMarker,
  prefixedLoad,
  withLoadKey,
} from "@/lib/load-keys";
import { improvedSetIds } from "@/data/set-improvement";
import {
  quietRecord,
  rankedKindsLabel,
  type RecordKind,
} from "@/data/record-rank";
import { fillFrom, shortSetText, type FillSource } from "@/lib/set-target";
import {
  plannedPlaceholders,
  plannedSetChange,
  shownPlannedSet,
} from "@/lib/routine-targets";
import { repRangeLabel } from "@/lib/routine-preview";
import { withRir } from "@/lib/rir";
import { exerciseDisplayName } from "@/lib/exercise-name";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import {
  type CardioFields,
  type CardioMetric,
  cardioGridStyle,
  cardioTotals,
  defaultCardioFields,
  isCardioSet,
  paceUnit,
  totalsLabel,
} from "@/lib/cardio";
import {
  type CountChoice,
  countChoice,
  withoutHiddenHolds,
} from "@/lib/rep-hold";
import { useKeepAboveSheet } from "@/hooks/useKeepAboveSheet";
import { useStableCallback } from "@/hooks/useStableCallback";
import SetLine from "@/components/workout/SetLine";
import { NumberPadContext } from "@/components/workout/number-pad-context";
import { padFields } from "@/lib/number-pad";
import { padFieldUnder } from "@/components/workout/pad-hit";
import SetSwipeRow from "@/components/gestures/SetSwipeRow";
import { motionMs } from "@/lib/slow-motion";
import SetSheet from "@/components/workout/SetSheet";
import ExerciseMenuSheet from "@/components/workout/ExerciseMenuSheet";
import ReorderSetsSheet from "@/components/workout/ReorderSetsSheet";
import CardioFieldsSheet from "@/components/workout/CardioFieldsSheet";
import RepRangeSheet from "@/components/workout/RepRangeSheet";
import ChoiceSheet from "@/components/ui/ChoiceSheet";
import { RestSheet } from "@/components/settings/PreferenceSheets";
import { restLabel } from "@/lib/preferences";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import type { WeightUnit } from "@/lib/units";
import { useT } from "@/i18n/useT";

export type ExerciseCardProps = {
  exercise: Exercise;
  /**
   * "plan" is a routine's exercise: no checks, rest or next set, and its sets
   * are never checked. Its kg and reps fields show only a typed target; last
   * time's result is the Förra column and the fields' grey placeholders
   * (routine-targets.ts). Its menu has a rep range.
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
  /**
   * Opens Reorder exercises from this card's menu. Left out while there is
   * only one exercise.
   */
  onReorderExercises?: (exercise: Exercise) => void;
  onRemove: (exercise: Exercise) => void;
  /** Opens the shared "Swap exercise" picker for this card. */
  onChangeExercise: (exercise: Exercise) => void;
  /** Called with the exercise's id when a set is newly checked as done. */
  onSetDone?: (exerciseId: string) => void;
  /**
   * The records the workout's checked sets hold so far, by set id, strongest
   * kind first (liveRankedRecords: one set per exercise). The same Map while
   * nothing changes, so memoised cards skip a render.
   */
  records?: ReadonlyMap<string, readonly RecordKind[]>;
  /**
   * Each set's target (double progression) by set id: the text under
   * Previous ("Target 87.5 × 5") and what a tap on it fills in.
   */
  targets?: ReadonlyMap<
    string,
    { text: string; source: FillSource; label?: string }
  >;
  /** An open lift goal for the exercise: a small mark by the name ("110 × 1"). */
  goalMark?: { text: string; label: string };
  /** The workout is in a plan's deload week: a Deload tag by the name. */
  deload?: boolean;
  /** After a set is checked, offer its reps in reserve for a few seconds. */
  askRir?: boolean;
  /** Shows the rest chip at the left of the card's foot: a live workout. */
  restChip?: boolean;
  /**
   * A cardio exercise's chosen fields (useCardioFields). Without them the
   * exercise's defaults show and "Fields…" is not offered.
   */
  cardioFields?: CardioFields;
  /** Saves the fields chosen with "Fields…" for this exercise. */
  onCardioFields?: (exerciseId: string, fields: CardioFields) => void;
  /** The exercise counts "Reps + hold" (useRepHold): sets show a hold field. */
  repHold?: boolean;
  /** Saves the count's hold choice for this exercise. Without it, "Reps + hold" is not offered. */
  onRepHold?: (exerciseId: string, on: boolean) => void;
  /**
   * The exercise's weight unit (useWeightUnits): its own, else the default.
   * Its weights show and are typed in it; they are stored in kg.
   */
  weightUnit?: WeightUnit;
  /** The default unit from Settings, marked in the unit sheet. */
  defaultWeightUnit?: WeightUnit;
  /**
   * Saves this exercise's unit from its kg or lb heading. Without it the
   * heading's sheet changes the default unit.
   */
  onWeightUnit?: (exerciseId: string, unit: WeightUnit) => void;
};

/** The one sheet this card has open: a set's, or the exercise's own. */
type OpenSheet =
  | { kind: "set"; setId: string }
  | { kind: "unit" }
  | { kind: "count" }
  | { kind: "menu" }
  | { kind: "reorder" }
  | { kind: "fields" }
  | { kind: "rest" }
  | { kind: "range" }
  | null;

/** One exercise in the workout editor: its sets, one line each, and its sheets. */
/**
 * Previous wraps in the narrow column, so tie the words that belong together
 * ("12.5 kg", "× 8") with no-break spaces: "BW + 12.5 kg" / "× 12" rather than
 * "BW + 12.5" / "kg × 12". With a hold the column is narrower (down to about
 * 44px at 360px in lb), so the number and its unit may part there: "275.6" /
 * "lb × 5" / "· 2 s" rather than breaking inside "lb".
 */
const keepTogether = (label: string, narrow = false) =>
  label
    .replace(/(\S) \+ /, "$1 +\u00a0")
    .replace(/(\d) (kg|lb)/, narrow ? "$1 $2" : "$1\u00a0$2")
    .replace(/× (\d)/, "×\u00a0$1")
    .replace(/· (\d+) s$/, "·\u00a0$1\u00a0s");

/** The record mark's screen reader label, or nothing. */
const recordLabel = (kinds: readonly RecordKind[] | undefined) =>
  kinds?.length ? rankedKindsLabel(kinds) : undefined;
/** A rep record or estimated 1RM: a quieter mark than the heaviest weight. */
const quietMark = (kinds: readonly RecordKind[] | undefined) =>
  !!kinds?.length && quietRecord(kinds);

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
  mode = "log",
  lastSession,
  bodyWeightKg = null,
  nextSetId,
  unlockChecked = false,
  defaults,
  planNote,
  onChange,
  onReorderExercises,
  onRemove,
  onChangeExercise,
  onSetDone,
  records,
  targets,
  goalMark,
  deload = false,
  askRir = false,
  restChip = false,
  cardioFields: chosenFields,
  onCardioFields,
  repHold = false,
  onRepHold,
  weightUnit: ownUnit,
  defaultWeightUnit,
  onWeightUnit,
}: ExerciseCardProps) {
  const ex = mode === "plan" ? withoutChecks(planned) : planned;
  const { sets } = ex;
  const headingId = useId();
  const { t } = useT();
  // The name as shown (Swedish for a built-in in Swedish); the record keeps its own.
  const exerciseName = exerciseDisplayName(ex.exerciseId, ex.name);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  // The exercise's own unit, picked from its kg or lb heading; the device's
  // default (Settings) when it has none.
  const [preferences, setPreferences] = useTrainingPreferences();
  const defaultUnit = defaultWeightUnit ?? preferences.weightUnit;
  const weightUnit = ownUnit ?? preferences.weightUnit;
  const setSheetRef = useRef<HTMLDivElement>(null);
  const openSetId = sheet?.kind === "set" ? sheet.setId : null;
  useKeepAboveSheet(openSetId, setSheetRef);
  // The Set sheet keeps its set while it slides out, after `sheet` is cleared.
  const shownSetId = useRef<string | null>(null);
  if (openSetId) shownSetId.current = openSetId;
  const shownIndex = sets.findIndex((s) => s.id === shownSetId.current);
  const shown = shownIndex >= 0 ? sets[shownIndex] : undefined;

  const cardio = sets.some(isCardioSet);
  // An exercise timed in seconds has no hold to show.
  const hold = repHold && !cardio && exerciseMeasure(sets) === "reps";
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
  // A routine's row edits what it shows (shownPlannedSet): typed numbers
  // become the set's target, anything else keeps its stored values.
  const updatePlannedLine = useStableCallback((next: WorkoutSet) => {
    const stored = sets.find((s) => s.id === next.id);
    if (!stored) return;
    updateSet(plannedSetChange(stored, shownPlannedSet(stored), next));
  });
  const toggleDone = useStableCallback((setId: string) => {
    let next = toggleGroupCompletion(sets, setId, bodyWeightKg);
    if (next === sets) return;
    // A hidden hold is not logged: the set is saved as its row reads.
    if (!hold) next = withoutHiddenHolds(sets, next);
    changeSets(next);
    const was = sets.find((s) => s.id === setId);
    const now = next.find((s) => s.id === setId);
    if (was && !was.done && now?.done) onSetDone?.(ex.id);
  });
  // Swipe left on a set (or Delete in its sheet) removes it with its drops.
  const deleteSet = useStableCallback((setId: string) =>
    changeSets(removeSetOrDrop(sets, setId)),
  );
  const deleters = useRef(new Map<string, () => void>());
  const registerDelete = useCallback(
    (setId: string, play: (() => void) | null) => {
      if (play) deleters.current.set(setId, play);
      else deleters.current.delete(setId);
    },
    [],
  );
  const dropIds = (index: number) =>
    isDrop(sets[index])
      ? []
      : sets.slice(index + 1, dropGroup(sets, index).end).map((x) => x.id);
  // The one-time swipe tip goes on the first set of a live workout.
  const tips = mode === "log";
  const openSet = useCallback(
    (setId: string) => setSheet({ kind: "set", setId }),
    [],
  );
  // Add set: the new row grows in, then its first field takes the number
  // pad (a live workout) or just comes into view.
  const pad = useContext(NumberPadContext);
  const [entering, setEntering] = useState<string | null>(null);
  const addSet = () => {
    let next = appendSet(ex, defaults);
    // A routine's new set copies the target of the set before it.
    const prior = sets.filter((s) => !isDrop(s)).at(-1);
    if (mode === "plan" && prior?.target)
      next = {
        ...next,
        sets: next.sets.map((s, i) =>
          i === next.sets.length - 1 ? { ...s, target: true } : s,
        ),
      };
    setEntering(next.sets[next.sets.length - 1].id);
    onChange(next);
  };
  const latestSets = useRef(sets);
  latestSets.current = sets;
  const entered = useCallback(
    (setId: string) => {
      setEntering((current) => (current === setId ? null : current));
      const added = latestSets.current.find((s) => s.id === setId);
      const fields = added && mode === "log" ? padFields(added) : [];
      if (pad && fields.length) pad.open(setId, fields[0]);
      else
        document
          .querySelector(`[data-set-id="${CSS.escape(setId)}"]`)
          ?.scrollIntoView({
            block: "nearest",
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
          });
    },
    [pad, mode],
  );
  // A tap on a set's load or reps while the Set sheet is open closes the
  // sheet and opens the pad on that field in the same tap; the field keeps
  // focus (with a mouse) instead of the badge getting it back.
  const toPad = useRef(false);
  const sheetPressOutside = (
    event: CustomEvent<{ originalEvent: PointerEvent }>,
  ) => {
    if (!pad) return;
    const hit = padFieldUnder(event.detail.originalEvent);
    if (!hit) return;
    toPad.current = true;
    close();
    pad.open(hit.setId, hit.field);
  };
  const setChange = mode === "log" ? workingSetChange(sets, lastSession) : null;
  // "Reps + hold" changes the count to reps and is remembered for the exercise.
  const chooseCount = (choice: CountChoice) => {
    changeSets(
      applyExerciseCount(sets, choice === "seconds" ? "seconds" : "reps"),
    );
    onRepHold?.(ex.exerciseId, choice === "repsHold");
  };
  // Checked sets that beat the same set last time get a small up arrow.
  const improved =
    mode === "log" && !cardio
      ? improvedSetIds(sets, lastSession?.sets)
      : undefined;
  const previousOf = (index: number) => {
    const result = previousResult(lastSession?.sets ?? [], sets, index);
    if (!result) return undefined;
    // A hold reads short, as its target does: "+10 · 60 s".
    if (result.measure === "seconds")
      return shortSetText(result, result, weightUnit)
        .replace(/ · /g, "\u00a0·\u00a0")
        .replace(/(\d) s$/, "$1\u00a0s");
    return keepTogether(labelSet(result, true, weightUnit), hold);
  };
  // A tap on Previous fills the set in one go with what it shows: the next
  // set's target, else last time's result.
  const fillSet = useStableCallback((setId: string) => {
    const index = sets.findIndex((s) => s.id === setId);
    if (index < 0) return;
    const source =
      (setId === nextSetId ? targets?.get(setId)?.source : undefined) ??
      previousResult(lastSession?.sets ?? [], sets, index);
    if (!source) return;
    const next = fillFrom(sets[index], source);
    if (next !== sets[index]) updateSet(next);
  });
  /** The target in the Set sheet's words: "87.5 kg × 5". */
  const targetOf = (index: number) => {
    const found = sets[index] && targets?.get(sets[index].id);
    return found
      ? (found.label ??
          labelSet(
            { ...sets[index], ...found.source } as WorkoutSet,
            false,
            weightUnit,
          ))
      : undefined;
  };

  return (
    <section
      className="card ex-card"
      aria-labelledby={headingId}
      data-unit={weightUnit}
    >
      <div className="ex-head">
        <ExerciseAvatar exerciseId={ex.exerciseId} />
        <div className="ex-titles">
          <div className="ex-title-row">
            <h2 id={headingId} className="ex-title">
              {exerciseName}
            </h2>
            {goalMark && mode === "log" && (
              <span
                className="ex-goal"
                role="img"
                aria-label={goalMark.label}
                title={goalMark.label}
              >
                <Target size={13} strokeWidth={2.4} aria-hidden="true" />
                <span className="ex-goal-text" aria-hidden="true">
                  {goalMark.text}
                </span>
              </span>
            )}
            {deload && mode === "log" && (
              <span className="ex-tag" title={t("workout.deloadTagSr")}>
                <span aria-hidden="true">{t("workout.deloadTag")}</span>
                <span className="sr-only">{t("workout.deloadTagSr")}</span>
              </span>
            )}
          </div>
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
                    unit,
                  )
                : localizedDate(lastSession.date, {
                    day: "numeric",
                    month: "short",
                  })}
            </p>
          )}
          {mode === "plan" && ex.repRange && (
            <p className="ex-last">
              {repRangeLabel(ex.repRange, exerciseMeasure(sets) === "seconds")}
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
          aria-label={t("exercise.options", { name: exerciseName })}
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
            style={cardioGridStyle(cardioFields.fields)}
          >
            {cardioFields.fields.map((metric) => (
              <span key={metric}>{heading(metric)}</span>
            ))}
          </span>
          {mode === "log" && <span>{t("exercise.colDone")}</span>}
        </div>
      ) : (
        <div
          className={`set-columns${prefixedLoad(defaultKey) ? " load-prefix" : ""}${hold ? " has-hold" : ""}`}
          data-mode={mode}
        >
          <span>{t("exercise.colSet")}</span>
          <span className="set-previous-heading">
            {t("exercise.colPrevious")}
          </span>
          {/* Over the arrow and record column. */}
          {mode === "log" && <span aria-hidden="true" />}
          {/* The headings pick the unit and the count; the rest of Load and
              count is in the exercise's menu. */}
          <button
            type="button"
            className="set-heading-btn"
            aria-haspopup="dialog"
            aria-label={`${loadHeading(defaultKey, weightUnit)}, ${t("unit.title")}`}
            onClick={() => setSheet({ kind: "unit" })}
          >
            {loadHeading(defaultKey, weightUnit)}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="set-heading-btn"
            aria-haspopup="dialog"
            aria-label={`${countHeading(sets, hold)}, ${t("load.count")}`}
            onClick={() => setSheet({ kind: "count" })}
          >
            {countHeading(sets, hold)}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {mode === "log" && <span>{t("exercise.colDone")}</span>}
        </div>
      )}
      {sets.map((s, i) => (
        <SetSwipeRow
          key={s.id}
          setId={s.id}
          companions={dropIds(i)}
          onDelete={deleteSet}
          register={registerDelete}
          tip={tips && i === 0}
          entering={entering === s.id}
          onEntered={entered}
          // A live workout's checked set asks before its first swipe-delete.
          checked={mode === "log" && !unlockChecked && s.done}
        >
          <SetLineMemo
            set={mode === "plan" ? shownPlannedSet(s) : s}
            placeholders={
              mode === "plan"
                ? plannedPlaceholders(
                    s,
                    previousResult(lastSession?.sets ?? [], sets, i),
                    weightUnit,
                  )
                : undefined
            }
            hold={hold}
            mode={mode}
            name={exerciseName}
            badge={setBadge(sets, i)}
            previous={previousOf(i)}
            improved={improved?.has(s.id) ?? false}
            record={recordLabel(records?.get(s.id))}
            recordQuiet={quietMark(records?.get(s.id))}
            // Only the next set shows its target, as the mockup does; a
            // narrow Previous column has no room for one on every set.
            target={
              mode === "log" && !s.done && nextSetId === s.id
                ? targets?.get(s.id)?.text
                : undefined
            }
            onFill={mode === "log" ? fillSet : undefined}
            askRir={askRir && mode === "log"}
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
            onChange={mode === "plan" ? updatePlannedLine : updateSet}
            onToggleDone={toggleDone}
          />
        </SetSwipeRow>
      ))}
      {/* Add set on the right, in thumb reach; the rest chip on the left. */}
      <div className="ex-foot">
        {restChip && mode === "log" && (
          <button
            type="button"
            className="rest-chip"
            data-off={preferences.restSeconds > 0 ? undefined : ""}
            aria-haspopup="dialog"
            aria-label={t("exercise.restChip", {
              time: restLabel(preferences.restSeconds),
            })}
            onClick={() => setSheet({ kind: "rest" })}
          >
            <Timer size={16} aria-hidden="true" />
            {restLabel(preferences.restSeconds)}
          </button>
        )}
        <button type="button" className="ex-add-set" onClick={addSet}>
          <Plus size={18} aria-hidden="true" />
          {t("exercise.addSet")}
        </button>
      </div>
      {shown && (
        <SetSheet
          open={openSetId !== null}
          onClose={close}
          contentRef={setSheetRef}
          onPointerDownOutside={sheetPressOutside}
          onCloseAutoFocus={(event) => {
            if (!toPad.current) return;
            toPad.current = false;
            event.preventDefault();
          }}
          badge={setBadge(sets, shownIndex)}
          previous={previousOf(shownIndex)}
          target={mode === "log" ? targetOf(shownIndex) : undefined}
          set={shown}
          dropCount={
            isDrop(shown) ? 0 : dropGroup(sets, shownIndex).end - shownIndex - 1
          }
          cardio={isCardioSet(shown)}
          weightUnit={weightUnit}
          onSection={(section) =>
            changeSets(changeSection(sets, shown.id, section))
          }
          onLoadKey={(key) => updateSet(withLoadKey(shown, key))}
          onRir={
            mode === "log" ? (rir) => updateSet(withRir(shown, rir)) : undefined
          }
          onAddDrop={() => {
            changeSets(addDrop(sets, shown.id));
            close();
          }}
          onDelete={() => {
            const id = shown.id;
            close();
            // The row plays the same bubble as a swipe once the sheet is
            // on its way down; it removes the set when the bubble is gone.
            const play = deleters.current.get(id);
            if (play) window.setTimeout(play, motionMs(120));
            else deleteSet(id);
          }}
        />
      )}
      {!cardio && (
        <ChoiceSheet<WeightUnit>
          open={sheet?.kind === "unit"}
          onClose={close}
          title={t("unit.title")}
          value={weightUnit}
          options={(["kg", "lb"] as const).map((unit) => ({
            value: unit,
            label: t(unit === "kg" ? "unit.kg" : "unit.lb"),
            detail: unit === defaultUnit ? t("unit.default") : undefined,
          }))}
          // Only this exercise's unit changes; Settings has the default.
          hint={
            onWeightUnit
              ? t("unit.exerciseNote", { name: exerciseName })
              : t("unit.defaultNote")
          }
          onChoose={(unit) =>
            onWeightUnit
              ? onWeightUnit(ex.exerciseId, unit)
              : setPreferences({ weightUnit: unit })
          }
        />
      )}
      {!cardio && (
        <ChoiceSheet<CountChoice>
          open={sheet?.kind === "count"}
          onClose={close}
          title={t("load.count")}
          value={countChoice(exerciseMeasure(sets), hold)}
          options={[
            { value: "reps", label: t("load.reps") },
            ...(onRepHold
              ? [{ value: "repsHold" as const, label: t("load.repsHold") }]
              : []),
            { value: "seconds", label: t("load.hold") },
          ]}
          hint={t("load.appliesUnchecked")}
          onChoose={chooseCount}
        />
      )}
      <ExerciseMenuSheet
        open={sheet?.kind === "menu"}
        onClose={close}
        name={exerciseName}
        fieldsHint={
          cardio ? cardioFields.fields.map(heading).join(" · ") : undefined
        }
        onFields={
          cardio && onCardioFields
            ? () => setSheet({ kind: "fields" })
            : undefined
        }
        onRepRange={
          mode === "plan" && !cardio
            ? () => setSheet({ kind: "range" })
            : undefined
        }
        repRangeHint={repRangeLabel(
          ex.repRange,
          exerciseMeasure(sets) === "seconds",
        )}
        onChangeExercise={() => {
          close();
          onChangeExercise(planned);
        }}
        onReorder={() => setSheet({ kind: "reorder" })}
        onReorderExercises={
          onReorderExercises
            ? () => {
                close();
                onReorderExercises(planned);
              }
            : undefined
        }
        onRemove={() => {
          close();
          onRemove(planned);
        }}
      />
      {cardio && onCardioFields && (
        <CardioFieldsSheet
          open={sheet?.kind === "fields"}
          onClose={close}
          name={exerciseName}
          value={cardioFields}
          onChange={(fields) => onCardioFields(ex.exerciseId, fields)}
        />
      )}
      {restChip && mode === "log" && (
        <RestSheet
          open={sheet?.kind === "rest"}
          onClose={close}
          preferences={preferences}
          onChange={setPreferences}
        />
      )}
      {mode === "plan" && (
        <RepRangeSheet
          open={sheet?.kind === "range"}
          name={exerciseName}
          value={ex.repRange}
          onClose={close}
          onChange={(range) => {
            const { repRange: _old, ...rest } = ex;
            onChange(range ? { ...rest, repRange: range } : rest);
          }}
        />
      )}
      <ReorderSetsSheet
        open={sheet?.kind === "reorder"}
        exercise={ex}
        onReorder={changeSets}
        onClose={close}
        weightUnit={weightUnit}
      />
    </section>
  );
}

export default memo(ExerciseCard);
