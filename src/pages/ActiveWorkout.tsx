import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import {
  type Workout,
  type Exercise,
  newSet,
  validSet,
  isFromNewerApp,
} from "@/data/model";
import { doneSetCount, setCount } from "@/data/selectors";
import {
  priorWorkouts,
  initialSet,
  hasLoggedExercise,
  lastSessions,
} from "@/data/workouts";
import { finishWorkout } from "@/lib/workout-editor";
import { trainingHaptic } from "@/lib/preferences";
import { requestPersistenceOnce } from "@/lib/persistence";
import { errorMessage } from "@/lib/errors";
import { countLabel, durationLabel } from "@/lib/labels";
import { localizedDate } from "@/lib/dates";
import { historyPath } from "@/lib/routes";
import { toastWithUndo } from "@/lib/undo-toast";
import { useRestTimer } from "@/hooks/useRestTimer";
import { useWorkoutAutosave } from "@/hooks/useWorkoutAutosave";
import ExercisePicker from "@/components/ExercisePicker";
import ExerciseCard from "@/components/ExerciseCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import FinishSheet from "@/components/workout/FinishSheet";
import WorkoutDetailsSheet from "@/components/workout/WorkoutDetailsSheet";
import RestBar from "@/components/workout/RestBar";
import NextSetChip from "@/components/workout/NextSetChip";
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
  const { state, save, deleteRecord, restoreWorkout } = useData();
  const { bodyWeightKg } = useProfile();
  const navigate = useNavigate();
  const autosave = useWorkoutAutosave(id, account, initial);
  const { workout: w, change, editing, saved, error, setError } = autosave;
  const [picker, setPicker] = useState(false);
  const [finish, setFinish] = useState(false);
  const [routine, setRoutine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [discardChanges, setDiscardChanges] = useState(false);
  const [removeExercise, setRemoveExercise] = useState<Exercise | null>(null);
  const rest = useRestTimer(account, id);
  const dirty = JSON.stringify(w) !== JSON.stringify(initial);
  const completed = doneSetCount(w);
  const total = setCount(w);
  const invalidChecked = w.exercises.some((ex) =>
    ex.sets.some((s) => s.done && !validSet(s)),
  );
  const unfinished = w.exercises
    .flatMap((ex) => ex.sets)
    .filter((s) => !s.done);
  const nextSet = unfinished[0];
  const fromRoutine = !!w.routineId;
  // A live timer for a running workout, refreshed every 30 s and on return.
  const [now, setNow] = useState(Date.now);
  const timed = !editing && !!w.startedAt;
  useEffect(() => {
    if (!timed) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timed]);
  // Previous results per exercise, rebuilt only when the log or date changes.
  const previous = useMemo(
    () =>
      lastSessions(
        priorWorkouts(
          Object.values(state.records),
          { ...state.records[id], kind: "workout", payload: initial },
          w.date,
        ),
      ),
    [state.records, id, initial, w.date],
  );

  const add = (items: { id: string; name: string; category?: string }[]) =>
    change({
      ...w,
      exercises: [
        ...w.exercises,
        ...items.map((item) => {
          const prior = previous
            .get(item.id)
            ?.sets.filter((s) => s.done && validSet(s));
          return {
            id: crypto.randomUUID(),
            exerciseId: item.id,
            name: item.name,
            sets: prior?.length
              ? prior.map((s) => newSet(s))
              : [initialSet(item.id, item.category)],
          };
        }),
      ],
    });
  const update = (ex: Exercise) =>
    change({
      ...w,
      exercises: w.exercises.map((e) => (e.id === ex.id ? ex : e)),
    });
  const remove = (ex: Exercise) => {
    change({ ...w, exercises: w.exercises.filter((e) => e.id !== ex.id) });
    setRemoveExercise(null);
  };
  const move = (index: number, step: number) => {
    const target = index + step;
    if (target < 0 || target >= w.exercises.length) return;
    const exercises = [...w.exercises];
    [exercises[index], exercises[target]] = [
      exercises[target],
      exercises[index],
    ];
    change({ ...w, exercises });
  };
  const leave = () => {
    if (editing && dirty) setDiscardChanges(true);
    else navigate(editing ? historyPath(id) : "/");
  };
  // Finishing and abandoning lock the editor so no keystroke saves underneath.
  const actionLocked = useRef(false);
  const runLocked = async (action: () => Promise<void>, failure: string) => {
    // A ref, not `busy`: a double tap arrives before the re-render disables buttons.
    if (actionLocked.current) return;
    actionLocked.current = true;
    autosave.lock();
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      setError(
        errorMessage(cause, "Could not save. Retry to keep your changes."),
      );
      toast.error(failure);
    } finally {
      actionLocked.current = false;
      autosave.unlock();
      setBusy(false);
    }
  };
  const complete = () =>
    runLocked(
      async () => {
        const next = finishWorkout(w);
        await autosave.saveNow(next);
        rest.skip();
        if (!editing) requestPersistenceOnce();
        if (routine && !fromRoutine) {
          try {
            await save(crypto.randomUUID(), "routine", {
              name: next.name,
              exercises: next.exercises.map((ex) => ({
                ...ex,
                sets: ex.sets.map((s) => ({ ...s, done: false })),
              })),
            });
          } catch {
            toast.error(
              "Workout saved. The routine could not be saved; create it from History.",
            );
          }
        }
        toast.success(
          editing
            ? "Changes saved on this phone"
            : "Workout saved on this phone",
        );
        navigate(historyPath(id));
      },
      editing
        ? "Changes could not be saved. Your original workout is unchanged."
        : "Could not finish. Your draft is still here.",
    );
  const abandonWorkout = () =>
    runLocked(async () => {
      await autosave.flush();
      await deleteRecord(id);
      rest.skip();
      navigate("/");
      toastWithUndo(
        "Workout abandoned",
        () => restoreWorkout(id),
        "Could not restore the workout. Try importing a backup.",
      );
    }, "Could not abandon. The workout is still here; retry.");

  const saveStatus = editing
    ? dirty
      ? "Unsaved"
      : "Saved"
    : error
      ? "Needs attention"
      : saved
        ? "Saved"
        : "Saving…";
  const status = [
    timed ? (
      <span key="time">
        {durationLabel(
          Math.max(0, Math.floor((now - (w.startedAt ?? now)) / 60000)),
        )}
      </span>
    ) : (
      <button
        key="date"
        type="button"
        className="date-chip"
        aria-haspopup="dialog"
        aria-label={`Date ${localizedDate(w.date)}. Edit workout details`}
        disabled={busy}
        onClick={() => setDetails(true)}
      >
        {localizedDate(w.date, { day: "numeric", month: "short" })}
      </button>
    ),
    <span key="sets">
      {completed} of {total} sets
    </span>,
    <span
      key="save"
      role="status"
      className={error && !editing ? "is-error" : undefined}
    >
      {saveStatus}
    </span>,
  ];

  return (
    <div className="workout-editor" aria-busy={busy}>
      <div className="top-bar" data-top-bar>
        <button
          type="button"
          className="icon-btn"
          aria-label={editing ? "Back to history" : "Leave workout"}
          onClick={leave}
          disabled={busy}
        >
          <ArrowLeft size={23} aria-hidden="true" />
        </button>
        <div className="top-bar-text">
          <h1 className="top-bar-title">
            <button
              type="button"
              aria-haspopup="dialog"
              disabled={busy}
              onClick={() => setDetails(true)}
            >
              {editing ? "Edit " : ""}
              {w.name || "Workout"}
            </button>
          </h1>
          <p className="top-bar-status">
            {status.map((part, index) => (
              <Fragment key={part.key}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                {part}
              </Fragment>
            ))}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={
            busy ||
            invalidChecked ||
            (!editing && !!error) ||
            (editing && !dirty)
          }
          onClick={() => setFinish(true)}
        >
          {editing ? "Save" : "Finish"}
        </button>
      </div>
      {autosave.changedElsewhere && !busy && (
        <div className="banner workout-banner" role="alert">
          <p>This workout was changed in another tab or on another device.</p>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={autosave.loadLatest}
            >
              Load the latest version
            </button>
            <button
              type="button"
              className="btn-quiet"
              onClick={autosave.keepMine}
            >
              Keep my entries
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="banner banner-danger workout-banner" role="alert">
          <p>{error}</p>
          {!editing && (
            <div className="banner-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => change(w)}
              >
                Retry saving
              </button>
            </div>
          )}
        </div>
      )}
      {w.exercises.map((ex, ei) => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          isFirst={ei === 0}
          isLast={ei === w.exercises.length - 1}
          lastSession={previous.get(ex.exerciseId)}
          bodyWeightKg={bodyWeightKg}
          nextSetId={nextSet?.id}
          onChange={update}
          onMove={(step) => move(ei, step)}
          onRemove={() =>
            hasLoggedExercise(ex) ? setRemoveExercise(ex) : remove(ex)
          }
          onSetDone={() => {
            if (editing) return;
            rest.start();
            trainingHaptic(rest.preferences.haptics);
          }}
        />
      ))}
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
        onConfirm={() => navigate(historyPath(id))}
      />
      {editing ? (
        <ConfirmDialog
          open={finish}
          tone="primary"
          title={<>Save changes to {w.name}?</>}
          description={
            <>
              {countLabel(completed, "completed set")} will be saved.
              {total > completed ? " Unchecked sets will be left out." : ""}
            </>
          }
          cancelLabel="Keep editing"
          confirmLabel={busy ? "Saving…" : "Save changes"}
          busy={busy}
          confirmDisabled={!completed || invalidChecked}
          onCancel={() => setFinish(false)}
          onConfirm={() => void complete()}
        >
          {completed < total && (
            <p className="completion-warning" role="alert">
              {countLabel(total - completed, "unchecked set")} will be left out.
            </p>
          )}
          {!completed && (
            <p className="completion-warning">
              Complete at least one set before saving.
            </p>
          )}
        </ConfirmDialog>
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
          onSave={() => void complete()}
          onKeepLogging={() => setFinish(false)}
          onAbandon={() => void abandonWorkout()}
        />
      )}
    </div>
  );
}
