import ExerciseAvatar from "@/components/items/ExerciseAvatar";
import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MoreHorizontal, Plus, Timer } from "lucide-react";
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
import SetSwipeRow from "@/components/gestures/SetSwipeRow";
import { useTipTarget } from "@/hooks/useTipTarget";
import { motionMs } from "@/lib/slow-motion";
import SetSheet from "@/components/workout/SetSheet";
import ExerciseMenuSheet from "@/components/workout/ExerciseMenuSheet";
import ReorderSetsSheet from "@/components/workout/ReorderSetsSheet";
import CardioFieldsSheet from "@/components/workout/CardioFieldsSheet";
import ChoiceSheet from "@/components/ui/ChoiceSheet";
import { RestSheet } from "@/components/settings/PreferenceSheets";
import { restLabel } from "@/lib/preferences";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import type { WeightUnit } from "@/lib/units";
import { useT } from "@/i18n/useT";

export type ExerciseCardProps = {
  exercise: Exercise;
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
  /**
   * Opens Reorder exercises from this card's menu. Left out while there is
   * only one exercise.
   */
  onReorderExercises?: (exercise: Exercise) => void;
  onRemove: (exercise: Exercise) => void;
  /** Opens the shared "Swap exercise" picker for this card. */
  onChangeExercise: (exercise: Exercise) => void;
  /** Called when a set is newly checked as done. */
  onSetDone?: () => void;
  /**
   * The records the workout's checked sets hold so far, by set id, as the
   * label a screen reader hears (liveWorkoutPrs). The same Map while nothing
   * changes, so memoised cards skip a render.
   */
  records?: ReadonlyMap<string, string>;
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
  restChip = false,
  cardioFields: chosenFields,
  onCardioFields,
  repHold = false,
  onRepHold,
}: ExerciseCardProps) {
  const ex = mode === "plan" ? withoutChecks(planned) : planned;
  const { sets } = ex;
  const headingId = useId();
  const { t } = useT();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  // The unit is the device's; the kg heading switches it for every screen.
  const [preferences, setPreferences] = useTrainingPreferences();
  const { weightUnit } = preferences;
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
  const toggleDone = useStableCallback((setId: string) => {
    let next = toggleGroupCompletion(sets, setId, bodyWeightKg);
    if (next === sets) return;
    // A hidden hold is not logged: the set is saved as its row reads.
    if (!hold) next = withoutHiddenHolds(sets, next);
    changeSets(next);
    const was = sets.find((s) => s.id === setId);
    const now = next.find((s) => s.id === setId);
    if (was && !was.done && now?.done) onSetDone?.();
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
  // One-time tips, pointed at the headings and the first set's badge.
  const tips = mode === "log";
  const unitTip = useTipTarget<HTMLButtonElement>(tips && "unitHeader", {
    tap: true,
  });
  const repsTip = useTipTarget<HTMLButtonElement>(tips && "repsHeader", {
    tap: true,
  });
  const [badgeEl, setBadgeEl] = useState<HTMLElement | null>(null);
  const badgeTip = useTipTarget<HTMLElement>(tips && "setBadge", { tap: true });
  useEffect(() => badgeTip(badgeEl), [badgeEl, badgeTip]);
  const card = useCallback((node: HTMLElement | null) => {
    setBadgeEl(node?.querySelector<HTMLElement>(".set-badge") ?? null);
  }, []);
  const openSet = useCallback(
    (setId: string) => setSheet({ kind: "set", setId }),
    [],
  );
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
    return result ? keepTogether(labelSet(result), hold) : undefined;
  };

  return (
    <section
      ref={card}
      className="card ex-card"
      aria-labelledby={headingId}
      data-unit={weightUnit}
    >
      <div className="ex-head">
        <ExerciseAvatar exerciseId={ex.exerciseId} />
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
                    unit,
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
          {mode === "log" && (
            <span className="set-previous-heading">
              {t("exercise.colPrevious")}
            </span>
          )}
          {/* Over the arrow and record column. */}
          {mode === "log" && <span aria-hidden="true" />}
          {/* The headings pick the unit and the count; the rest of Load and
              count is in the exercise's menu. */}
          <button
            ref={unitTip}
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
            ref={repsTip}
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
        >
          <SetLineMemo
            set={s}
            hold={hold}
            mode={mode}
            name={ex.name}
            badge={setBadge(sets, i)}
            previous={previousOf(i)}
            improved={improved?.has(s.id) ?? false}
            record={records?.get(s.id)}
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
        <button
          type="button"
          className="ex-add-set"
          onClick={() => onChange(appendSet(ex, defaults))}
        >
          <Plus size={18} aria-hidden="true" />
          {t("exercise.addSet")}
        </button>
      </div>
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
          options={[
            { value: "kg", label: t("unit.kg") },
            { value: "lb", label: t("unit.lb") },
          ]}
          hint={t("unit.note")}
          onChoose={(unit) => setPreferences({ weightUnit: unit })}
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
        name={ex.name}
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
          name={ex.name}
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
