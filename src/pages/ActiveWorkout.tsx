import { useMemo, useReducer, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Plus, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import {
  type Workout,
  type Exercise,
  newSet,
  today,
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
import { selectInputValue } from "@/lib/set-editing";
import { changeExerciseOptions } from "@/lib/exercise-options";
import { trainingHaptic } from "@/lib/preferences";
import { requestPersistenceOnce } from "@/lib/persistence";
import { errorMessage } from "@/lib/errors";
import { countLabel } from "@/lib/labels";
import { historyPath } from "@/lib/routes";
import { toastWithUndo } from "@/lib/undo-toast";
import { useRestTimer } from "@/hooks/useRestTimer";
import { useWorkoutAutosave } from "@/hooks/useWorkoutAutosave";
import { useCloseOptionsOutside } from "@/hooks/useCloseOptionsOutside";
import ExercisePicker from "@/components/ExercisePicker";
import ExerciseCard from "@/components/ExerciseCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import "@/styles/set-editing.css";

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
  const [menu, changeOptions] = useReducer(changeExerciseOptions, null);
  const [routine, setRoutine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [discardChanges, setDiscardChanges] = useState(false);
  const [removeExercise, setRemoveExercise] = useState<Exercise | null>(null);
  const [focusedSetId, setFocusedSetId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  useCloseOptionsOutside(editorRef, menu?.id, changeOptions);
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
  const nextSet =
    unfinished.find((s) => s.id === focusedSetId) ?? unfinished[0];
  const fromRoutine = !!w.routineId;
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

  const add = (items: { id: string; name: string }[]) =>
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
              : [initialSet(item.id)],
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
    changeOptions({ type: "close" });
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
  const focusNext = () => {
    if (!nextSet) return;
    const input = editorRef.current?.querySelector<HTMLInputElement>(
      `[data-set-id="${nextSet.id}"] input:not(:disabled)`,
    );
    input?.focus();
    input?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
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

  return (
    <div ref={editorRef} className="workout-editor stack" aria-busy={busy}>
      <div className="editor-heading editor-toolbar">
        <button
          className="icon-button"
          aria-label={editing ? "Back to history" : "Leave workout"}
          onClick={leave}
          disabled={busy}
        >
          <ArrowLeft size={23} />
        </button>
        <div className="editor-title">
          <h1>
            {editing ? "Edit " : ""}
            {w.name || "Workout"}
          </h1>
          <span
            className={error ? "error-text save-state" : "muted save-state"}
            role="status"
          >
            {editing
              ? dirty
                ? "Unsaved changes"
                : "Save changes when ready"
              : error
                ? "Draft needs attention"
                : saved
                  ? "Draft saved on this phone"
                  : "Saving…"}
          </span>
        </div>
        {editing ? (
          <button
            className="text-button"
            onClick={() => setDiscardChanges(true)}
            disabled={busy || !dirty}
          >
            Discard changes
          </button>
        ) : (
          <button
            className="text-button danger"
            onClick={() => setAbandon(true)}
            disabled={busy}
          >
            Abandon
          </button>
        )}
      </div>
      {autosave.changedElsewhere && !busy && (
        <div className="save-error" role="alert">
          <p>This workout was changed in another tab or on another device.</p>
          <button className="secondary" onClick={autosave.loadLatest}>
            Load the latest version
          </button>
          <button className="text-button" onClick={autosave.keepMine}>
            Keep my entries
          </button>
        </div>
      )}
      {error && (
        <div className="save-error" role="alert">
          <p>{error}</p>
          {!editing && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => change(w)}
            >
              Retry saving
            </button>
          )}
        </div>
      )}
      <details className="workout-details" open={!w.startedAt || editing}>
        <summary className="session-summary">
          Workout details
          <ChevronDown size={18} />
        </summary>
        <div className="details-grid">
          <label>
            Name
            <input
              value={w.name}
              maxLength={100}
              aria-invalid={!w.name.trim()}
              onChange={(e) => change({ ...w, name: e.target.value })}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={w.date}
              max={today()}
              onChange={(e) => change({ ...w, date: e.target.value })}
            />
          </label>
          <label>
            Duration (optional, minutes)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="1440"
              step="1"
              placeholder={w.startedAt ? "Automatic timer" : "Not recorded"}
              value={w.duration ?? ""}
              onFocus={selectInputValue}
              onClick={selectInputValue}
              onChange={(e) =>
                change({
                  ...w,
                  duration:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      </details>
      {!editing && (rest.remaining > 0 || rest.elapsed) && (
        <div className="rest-timer">
          <span role="timer" aria-label="Rest time remaining">
            {rest.elapsed
              ? "Rest complete"
              : `Rest ${Math.floor(rest.remaining / 60)}:${String(rest.remaining % 60).padStart(2, "0")}`}
          </span>
          <button className="text-button" onClick={rest.extend}>
            +30 seconds
          </button>
          <button className="text-button" onClick={rest.skip}>
            {rest.elapsed ? "Dismiss" : "Skip rest"}
          </button>
        </div>
      )}
      {w.exercises.map((ex, ei) => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          isFirst={ei === 0}
          isLast={ei === w.exercises.length - 1}
          options={menu}
          changeOptions={changeOptions}
          lastSession={previous.get(ex.exerciseId)}
          bodyWeightKg={bodyWeightKg}
          nextSetId={nextSet?.id}
          onFocusSet={setFocusedSetId}
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
      {!w.exercises.length && (
        <div className="empty-card">
          <h2>{w.startedAt ? "Log your first set" : "What did you train?"}</h2>
          <p>
            Add exercises. Previous results will be suggested when available.
          </p>
        </div>
      )}
      <button
        className="secondary large"
        onClick={() => setPicker(true)}
        disabled={busy}
      >
        <Plus size={21} />
        Add exercises
      </button>
      {nextSet && (
        <button className="text-button next-set-action" onClick={focusNext}>
          <Crosshair size={18} />
          Go to active set
        </button>
      )}
      <div className="workout-footer">
        <span>
          {completed} of {total} sets done
        </span>
        <button
          className={
            completed > 0 && completed === total
              ? "primary finish-ready"
              : "secondary finish-pending"
          }
          disabled={
            busy ||
            invalidChecked ||
            (!editing && !!error) ||
            (editing && !dirty)
          }
          onClick={() => setFinish(true)}
        >
          {editing ? "Save changes" : "Finish workout"}
        </button>
      </div>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onAdd={add}
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
        open={abandon}
        title="Abandon this workout?"
        description="This removes the draft from your log. You can undo immediately afterwards."
        cancelLabel="Keep workout"
        confirmLabel={busy ? "Abandoning…" : "Abandon workout"}
        busy={busy}
        onCancel={() => setAbandon(false)}
        onConfirm={() => void abandonWorkout()}
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
      <ConfirmDialog
        open={finish}
        tone="primary"
        title={
          <>
            {editing ? "Save changes to " : "Finish "}
            {w.name}?
          </>
        }
        description={
          <>
            {countLabel(completed, "completed set")} will be saved.
            {total > completed ? " Unchecked sets will be left out." : ""}
          </>
        }
        cancelLabel={editing ? "Keep editing" : "Keep logging"}
        confirmLabel={
          busy ? "Saving…" : editing ? "Save changes" : "Save workout"
        }
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
        {!editing && !fromRoutine && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={routine}
              onChange={(e) => setRoutine(e.target.checked)}
            />
            Save as a routine for next time
          </label>
        )}
      </ConfirmDialog>
    </div>
  );
}
