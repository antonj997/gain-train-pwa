import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import {
  type Workout,
  type Exercise,
  validSet,
  isFromNewerApp,
} from "@/data/model";
import { doneSetCount, setCount } from "@/data/selectors";
import { hasLoggedExercise } from "@/data/workouts";
import { addExercises, type ExerciseTarget } from "@/lib/workout-editor";
import { trainingHaptic } from "@/lib/preferences";
import { historyPath } from "@/lib/routes";
import { usePreviousResults } from "@/hooks/usePreviousResults";
import { useRestTimer } from "@/hooks/useRestTimer";
import { useStableCallback } from "@/hooks/useStableCallback";
import { useWorkoutActions } from "@/hooks/useWorkoutActions";
import { useWorkoutAutosave } from "@/hooks/useWorkoutAutosave";
import ExercisePicker from "@/components/ExercisePicker";
import ExerciseCard from "@/components/ExerciseCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import ChangeExercisePicker from "@/components/workout/ChangeExercisePicker";
import EditSaveDialog from "@/components/workout/EditSaveDialog";
import FinishSheet from "@/components/workout/FinishSheet";
import NextSetChip from "@/components/workout/NextSetChip";
import RestBar from "@/components/workout/RestBar";
import WorkoutBanners from "@/components/workout/WorkoutBanners";
import WorkoutDetailsSheet from "@/components/workout/WorkoutDetailsSheet";
import WorkoutTopBar from "@/components/workout/WorkoutTopBar";
import "@/styles/workout.css";

export default function ActiveWorkout() {
  const { id } = useParams();
  const { state } = useData();
  const { account } = useAuth();
  const doc = id ? state.records[id] : null;
  if (!doc || doc.deleted || doc.kind !== "workout")
    return (
      <div className="empty">
        <h1>Workout not found</h1>
        <Link to="/">Back to workouts</Link>
      </div>
    );
  if (isFromNewerApp(doc.payload))
    return (
      <div className="empty">
        <h1>Update Gain Train to edit this workout</h1>
        <p>
          It was saved by a newer version of the app. Close and reopen Gain
          Train to update; your workout is safe in the meantime.
        </p>
        <Link to="/">Back to workouts</Link>
      </div>
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
  const autosave = useWorkoutAutosave(id, account, initial);
  const { workout: w, change, changeWith, editing, saved, error } = autosave;
  // Starting from a planned day type opens the picker on its categories.
  const location = useLocation();
  const [suggested] = useState(
    () => (location.state as { suggest?: string[] } | null)?.suggest,
  );
  const [picker, setPicker] = useState(() => !!suggested?.length);
  useEffect(() => {
    if (suggested?.length)
      navigate(location.pathname, { replace: true, state: null });
    // Only the first render reads the state; it is cleared so a reload starts plain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [finish, setFinish] = useState(false);
  const [routine, setRoutine] = useState(false);
  const [details, setDetails] = useState(false);
  const [discardChanges, setDiscardChanges] = useState(false);
  const [removeExercise, setRemoveExercise] = useState<Exercise | null>(null);
  const [changing, setChanging] = useState<Exercise | null>(null);
  const rest = useRestTimer(account, id);
  const { busy, complete, abandon } = useWorkoutActions(id, autosave, rest);
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
  const fromRoutine = !!w.routineId;
  const { previous, defaults } = usePreviousResults(
    state.records,
    id,
    initial,
    w.date,
  );

  const add = (items: ExerciseTarget[]) =>
    change(addExercises(w, items, previous));
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
  const move = useCallback(
    (ex: Exercise, step: number) =>
      changeWith((current) => {
        const index = current.exercises.findIndex((e) => e.id === ex.id);
        const target = index + step;
        if (index < 0 || target < 0 || target >= current.exercises.length)
          return current;
        const exercises = [...current.exercises];
        [exercises[index], exercises[target]] = [
          exercises[target],
          exercises[index],
        ];
        return { ...current, exercises };
      }),
    [changeWith],
  );
  const requestRemove = useStableCallback((ex: Exercise) =>
    hasLoggedExercise(ex) ? setRemoveExercise(ex) : remove(ex),
  );
  const setDone = useStableCallback(() => {
    if (editing) return;
    rest.start();
    trainingHaptic(rest.preferences.haptics);
  });
  const leave = () => {
    if (editing && dirty) setDiscardChanges(true);
    else navigate(editing ? historyPath(id) : "/");
  };
  const save = () => void complete(routine && !fromRoutine);

  // Checked values are editable while editing, so say why Save is off.
  const saveStatus = editing
    ? invalidChecked
      ? "Fix marked sets"
      : dirty
        ? "Unsaved"
        : "Saved"
    : error
      ? "Needs attention"
      : saved
        ? "Saved"
        : "Saving…";

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
        onFinish={() => setFinish(true)}
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
      {w.exercises.map((ex, ei) => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          isFirst={ei === 0}
          isLast={ei === w.exercises.length - 1}
          lastSession={previous.get(ex.exerciseId)}
          bodyWeightKg={bodyWeightKg}
          // Only the card holding the next set needs to know which it is.
          nextSetId={
            ex.sets.some((s) => s.id === nextSet?.id) ? nextSet?.id : undefined
          }
          unlockChecked={editing}
          defaults={defaults.get(ex.exerciseId)}
          onChange={update}
          onMove={move}
          onRemove={requestRemove}
          onChangeExercise={setChanging}
          onSetDone={setDone}
        />
      ))}
      <ChangeExercisePicker
        exercise={changing}
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
          Add exercise
        </button>
      ) : (
        <button
          type="button"
          className="btn-primary add-first"
          onClick={() => setPicker(true)}
          disabled={busy}
        >
          <Plus size={21} aria-hidden="true" />
          Add your first exercise
        </button>
      )}
      <div className="float-stack">
        <NextSetChip setId={nextSet?.id} />
        {!editing && <RestBar rest={rest} />}
      </div>
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
        title={<>Remove {removeExercise?.name}?</>}
        description="This exercise contains entered values or completed sets. Removing it deletes all of those sets from this workout."
        cancelLabel="Keep exercise"
        confirmLabel="Remove exercise"
        onCancel={() => setRemoveExercise(null)}
        onConfirm={() => removeExercise && remove(removeExercise)}
      />
      <ConfirmDialog
        open={discardChanges}
        title="Discard your changes?"
        description="Your saved workout will stay as it was before editing."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => setDiscardChanges(false)}
        onConfirm={() => {
          autosave.discard();
          navigate(historyPath(id));
        }}
      />
      {editing ? (
        <EditSaveDialog
          open={finish}
          name={w.name}
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
