import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import {
  type Workout,
  type Exercise,
  type WorkoutSet,
  validSet,
  isFromNewerApp,
} from "@/data/model";
import { doneSetCount, setCount } from "@/data/selectors";
import { hasLoggedExercise } from "@/data/workouts";
import { liveWorkoutPrs } from "@/data/exercise-records";
import { recordKindsLabel } from "@/lib/record-labels";
import { addExercises, type ExerciseTarget } from "@/lib/workout-editor";
import { trainingHaptic } from "@/lib/preferences";
import { historyPath } from "@/lib/routes";
import { usePreviousResults } from "@/hooks/usePreviousResults";
import { useRestTimer } from "@/hooks/useRestTimer";
import { useCardioFields } from "@/hooks/useCardioFields";
import { useRepHold } from "@/hooks/useRepHold";
import { useStableCallback } from "@/hooks/useStableCallback";
import { useWorkoutActions } from "@/hooks/useWorkoutActions";
import { useWorkoutAutosave } from "@/hooks/useWorkoutAutosave";
import ExercisePicker from "@/components/ExercisePicker";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/ui/BackButton";
import { usePageBack } from "@/hooks/usePageTransitions";
import ExerciseCard from "@/components/ExerciseCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import ChangeExercisePicker from "@/components/workout/ChangeExercisePicker";
import ReorderExercisesSheet from "@/components/workout/ReorderExercisesSheet";
import { reorderByIds } from "@/lib/exercise-order";
import { notify } from "@/lib/message-store";
import EditSaveDialog from "@/components/workout/EditSaveDialog";
import FinishSheet from "@/components/workout/FinishSheet";
import NextSetChip from "@/components/workout/NextSetChip";
import WorkoutDock from "@/components/workout/WorkoutDock";
import { NumberPadContext } from "@/components/workout/number-pad-context";
import type { DockNext } from "@/components/workout/RestDock";
import type { PadField, PadTarget } from "@/lib/number-pad";
import { setBadge } from "@/data/drops";
import { labelSet } from "@/data/model";
import { durationLabel } from "@/lib/labels";
import { primeRestSound } from "@/lib/rest-sound";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import WorkoutBanners from "@/components/workout/WorkoutBanners";
import WorkoutDetailsSheet from "@/components/workout/WorkoutDetailsSheet";
import WorkoutTopBar from "@/components/workout/WorkoutTopBar";
import "@/styles/workout.css";
import { useT } from "@/i18n/useT";
import { workoutTitle } from "@/lib/workout-name";
import { planNote } from "@/lib/plan-note";

export default function ActiveWorkout() {
  const { id } = useParams();
  const { state } = useData();
  const { account } = useAuth();
  const { t } = useT();
  const doc = id ? state.records[id] : null;
  if (!doc || doc.deleted || doc.kind !== "workout")
    return (
      <WorkoutUnavailable title={t("workout.notFound")}>
        <p>{t("workout.notFoundText")}</p>
      </WorkoutUnavailable>
    );
  if (isFromNewerApp(doc.payload))
    return (
      <WorkoutUnavailable title={t("workout.newerTitle")}>
        <p>{t("workout.newerText")}</p>
      </WorkoutUnavailable>
    );
  return (
    <Editor
      key={`${account}:${id}`}
      id={id!}
      account={account}
      initial={doc.payload}
    />
  );
}

/** A workout that cannot open here: the shared page header and a way back. */
function WorkoutUnavailable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { t } = useT();
  const back = usePageBack("/");
  return (
    <div className="page">
      <PageHeader
        eyebrow={t("workout.eyebrow")}
        title={title}
        notices={false}
        leading={<BackButton onClick={back} />}
      />
      <div className="empty-card" role="status">
        {children}
        <Link to="/" className="btn-secondary">
          {t("workout.backToWorkouts")}
        </Link>
      </div>
    </div>
  );
}

function Editor({
  id,
  account,
  initial,
}: {
  id: string;
  account: string;
  initial: Workout;
}) {
  const { state } = useData();
  const { bodyWeightKg } = useProfile();
  const navigate = useNavigate();
  const { t } = useT();
  const autosave = useWorkoutAutosave(id, account, initial);
  const { workout: w, change, changeWith, editing, saved, error } = autosave;
  // Starting from a planned day type opens the picker on its categories, and
  // logging a past workout opens its details sheet to pick the date.
  const location = useLocation();
  const [startState] = useState(
    () =>
      location.state as {
        suggest?: string[];
        details?: boolean;
        /** Added from a long-press menu elsewhere (Library, Progress). */
        add?: ExerciseTarget[];
      } | null,
  );
  const suggested = startState?.suggest;
  const [picker, setPicker] = useState(() => !!suggested?.length);
  useEffect(() => {
    if (startState) navigate(location.pathname, { replace: true, state: null });
    // Only the first render reads the state; it is cleared so a reload starts plain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [finish, setFinish] = useState(false);
  const [routine, setRoutine] = useState(false);
  const [details, setDetails] = useState(() => !!startState?.details);
  const [discardChanges, setDiscardChanges] = useState(false);
  const [removeExercise, setRemoveExercise] = useState<Exercise | null>(null);
  const [changing, setChanging] = useState<Exercise | null>(null);
  const rest = useRestTimer(account, id);
  const { busy, complete, abandon, discardEmpty } = useWorkoutActions(
    id,
    autosave,
    rest,
  );
  // Only an edit of a finished workout has unsaved changes to compare.
  const dirty = useMemo(
    () => editing && JSON.stringify(w) !== JSON.stringify(initial),
    [editing, w, initial],
  );
  const completed = doneSetCount(w);
  const total = setCount(w);
  const invalidChecked = w.exercises.some((ex) =>
    ex.sets.some((s) => s.done && !validSet(s)),
  );
  const nextSet = w.exercises.flatMap((ex) => ex.sets).find((s) => !s.done);
  // The record marks the checked sets earn so far, as if finished now.
  const liveRecords = useMemo(
    () => liveWorkoutPrs(state.records, { id, payload: w }),
    [state.records, id, w],
  );
  const recordsKey = [...liveRecords]
    .map(([setId, kinds]) => `${setId}:${kinds.join(",")}`)
    .join("|");
  const recordLabels = useMemo(
    () =>
      new Map(
        [...liveRecords].map(([setId, kinds]) => [
          setId,
          recordKindsLabel(kinds),
        ]),
      ),
    // A new Map only when a mark changes, so unchanged cards skip a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recordsKey],
  );
  const fromRoutine = !!w.routineId;
  const { previous, defaults } = usePreviousResults(
    state.records,
    id,
    initial,
    w.date,
  );

  const cardioFields = useCardioFields();
  const repHold = useRepHold();
  const add = (items: ExerciseTarget[]) =>
    change(addExercises(w, items, previous));
  // An exercise added from another screen's long-press menu: once, on arrival.
  const addedOnArrival = useRef(false);
  useEffect(() => {
    const items = startState?.add;
    if (!items?.length || addedOnArrival.current) return;
    addedOnArrival.current = true;
    add(items);
    notify.success(
      t("menu.addedToWorkout", { name: items.map((i) => i.name).join(", ") }),
    );
    // Only the first render's state counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // One identity each for the editor's lifetime, so memoised cards only
  // re-render when their own exercise changes.
  const update = useCallback(
    (ex: Exercise) =>
      changeWith((current) => ({
        ...current,
        exercises: current.exercises.map((e) => (e.id === ex.id ? ex : e)),
      })),
    [changeWith],
  );
  const remove = (ex: Exercise) => {
    changeWith((current) => ({
      ...current,
      exercises: current.exercises.filter((e) => e.id !== ex.id),
    }));
    setRemoveExercise(null);
  };
  // Reorder exercises: the card whose menu opened it stays marked while the
  // sheet slides out.
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderFrom, setReorderFrom] = useState<string | null>(null);
  const openReorder = useStableCallback((ex: Exercise) => {
    setReorderFrom(ex.id);
    setReorderOpen(true);
  });
  // The new order shows at once and the top bar says Saved; reordering is
  // its own undo.
  const saveOrder = (ids: string[]) =>
    changeWith((current) => ({
      ...current,
      exercises: reorderByIds(current.exercises, ids),
    }));
  const requestRemove = useStableCallback((ex: Exercise) =>
    hasLoggedExercise(ex) ? setRemoveExercise(ex) : remove(ex),
  );
  // The exercise of the set checked last: the dock names the next set's
  // exercise only when it is another one.
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const setDone = useStableCallback((exerciseId: string) => {
    if (editing) return;
    // The tap that checks a set lets the rest's tone play later.
    primeRestSound();
    rest.start();
    trainingHaptic(rest.preferences.haptics);
    setLastChecked(exerciseId);
  });
  // Every set checked: no rest, the dock is Finish workout.
  const allChecked = total > 0 && completed === total;
  useEffect(() => {
    if (allChecked && !editing) rest.skip();
    // Only when the last set is checked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChecked]);
  // The screen stays on through a running workout.
  useWakeLock(!editing);
  // The number pad of a live workout (NumberPad.tsx).
  const [padTarget, setPadTarget] = useState<PadTarget | null>(null);
  const padApi = useMemo(
    () => ({
      open: (setId: string, field: PadField) =>
        setPadTarget((current) =>
          current?.setId === setId && current.field === field
            ? current
            : { setId, field },
        ),
      coarse:
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches,
    }),
    [],
  );
  const changeSet = useCallback(
    (setId: string, edit: (set: WorkoutSet) => WorkoutSet) =>
      changeWith((current) => ({
        ...current,
        exercises: current.exercises.map((ex) =>
          ex.sets.some((s) => s.id === setId)
            ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? edit(s) : s)) }
            : ex,
        ),
      })),
    [changeWith],
  );
  const [{ weightUnit }] = useTrainingPreferences();
  const dockNext = useMemo((): DockNext | null => {
    for (const ex of w.exercises) {
      const index = ex.sets.findIndex((s) => !s.done);
      if (index < 0) continue;
      const set = ex.sets[index];
      const title = setBadge(ex.sets, index).name;
      const what = validSet(set) ? `${title} · ${labelSet(set)}` : title;
      return {
        setId: set.id,
        title,
        label: lastChecked && lastChecked !== ex.id ? `${ex.name} · ${what}` : what,
      };
    }
    return null;
    // The unit changes the label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.exercises, lastChecked, weightUnit]);
  const leave = () => {
    if (editing && dirty) setDiscardChanges(true);
    else navigate(editing ? historyPath(id) : "/");
  };
  const save = () => void complete(routine && !fromRoutine);

  // Checked values are editable while editing, so say why Save is off.
  const saveStatus = editing
    ? invalidChecked
      ? t("workout.fixMarked")
      : dirty
        ? t("workout.unsaved")
        : t("workout.saved")
    : error
      ? t("workout.needsAttention")
      : saved
        ? t("workout.saved")
        : t("workout.saving");

  return (
    <div className="workout-editor" aria-busy={busy}>
      <WorkoutTopBar
        workout={w}
        editing={editing}
        busy={busy}
        completed={completed}
        total={total}
        saveStatus={saveStatus}
        saveError={editing ? invalidChecked : !!error}
        finishDisabled={
          busy || invalidChecked || (!editing && !!error) || (editing && !dirty)
        }
        onLeave={leave}
        onDetails={() => setDetails(true)}
        // A workout with nothing checked has nothing to save: it goes at
        // once, like a deleted one, and Train says so.
        onFinish={() =>
          !editing && completed === 0 ? void discardEmpty() : setFinish(true)
        }
      />
      <WorkoutBanners
        changedElsewhere={autosave.changedElsewhere}
        error={error}
        editing={editing}
        busy={busy}
        onLoadLatest={autosave.loadLatest}
        onKeepMine={autosave.keepMine}
        onRetry={() => change(w)}
      />
      <NumberPadContext.Provider value={editing ? null : padApi}>
      {w.exercises.map((ex) => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          lastSession={previous.get(ex.exerciseId)}
          bodyWeightKg={bodyWeightKg}
          // Only the card holding the next set needs to know which it is.
          nextSetId={
            ex.sets.some((s) => s.id === nextSet?.id) ? nextSet?.id : undefined
          }
          unlockChecked={editing}
          defaults={defaults.get(ex.exerciseId)}
          planNote={planNote(w.plan, ex.exerciseId)}
          onChange={update}
          onReorderExercises={w.exercises.length > 1 ? openReorder : undefined}
          onRemove={requestRemove}
          onChangeExercise={setChanging}
          onSetDone={setDone}
          records={recordLabels}
          restChip={!editing}
          cardioFields={cardioFields.fieldsFor(ex.exerciseId)}
          onCardioFields={cardioFields.setFields}
          repHold={repHold.holdFor(ex.exerciseId)}
          onRepHold={repHold.setHold}
        />
      ))}
      </NumberPadContext.Provider>
      <ReorderExercisesSheet
        open={reorderOpen}
        exercises={w.exercises}
        currentId={reorderFrom}
        onSave={saveOrder}
        onClose={() => setReorderOpen(false)}
      />
      <ChangeExercisePicker
        exercise={changing}
        defaults={defaults}
        onClose={() => setChanging(null)}
        onChange={update}
      />
      {w.exercises.length ? (
        <button
          type="button"
          className="add-exercise"
          onClick={() => setPicker(true)}
          disabled={busy}
        >
          <Plus size={18} aria-hidden="true" />
          {t("workout.addExercise")}
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary add-first"
          onClick={() => setPicker(true)}
          disabled={busy}
        >
          <Plus size={21} aria-hidden="true" />
          {t("workout.addFirst")}
        </button>
      )}
      <div className="float-stack">
        {!padTarget && <NextSetChip setId={nextSet?.id} />}
      </div>
      {!editing && (
        <WorkoutDock
          rest={{
            rest,
            allChecked,
            next: dockNext,
            totalSets: total,
            minutes: durationLabel(
              Math.max(
                0,
                Math.floor((Date.now() - (w.startedAt ?? Date.now())) / 60000),
              ),
            ),
            finishDisabled: busy || !!error,
            onFinish: () => setFinish(true),
          }}
          pad={{
            target: padTarget,
            setTarget: setPadTarget,
            workout: w,
            previous,
            unit: weightUnit,
            changeSet,
          }}
        />
      )}
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onAdd={add}
        suggested={suggested}
      />
      <WorkoutDetailsSheet
        open={details}
        onClose={() => setDetails(false)}
        workout={w}
        onChange={change}
      />
      <ConfirmDialog
        open={!!removeExercise}
        title={t("workout.removeTitle", { name: removeExercise?.name ?? "" })}
        description={t("workout.removeText")}
        cancelLabel={t("workout.keepExercise")}
        confirmLabel={t("workout.removeExercise")}
        onCancel={() => setRemoveExercise(null)}
        onConfirm={() => removeExercise && remove(removeExercise)}
      />
      <ConfirmDialog
        open={discardChanges}
        title={t("workout.discardTitle")}
        description={t("workout.discardText")}
        cancelLabel={t("workout.keepEditing")}
        confirmLabel={t("workout.discardChanges")}
        onCancel={() => setDiscardChanges(false)}
        onConfirm={() => {
          autosave.discard();
          navigate(historyPath(id));
        }}
      />
      {editing ? (
        <EditSaveDialog
          open={finish}
          name={workoutTitle(w.name)}
          completed={completed}
          total={total}
          invalidChecked={invalidChecked}
          busy={busy}
          onCancel={() => setFinish(false)}
          onConfirm={save}
        />
      ) : (
        <FinishSheet
          open={finish}
          onClose={() => setFinish(false)}
          completed={completed}
          unchecked={total - completed}
          showRoutineSwitch={!fromRoutine}
          saveRoutine={routine}
          busy={busy}
          onSaveRoutine={setRoutine}
          onSave={save}
          onKeepLogging={() => setFinish(false)}
          onAbandon={() => void abandon()}
        />
      )}
    </div>
  );
}
