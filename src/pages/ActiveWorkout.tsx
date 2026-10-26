import { useEffect, useReducer, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
  Crosshair,
  ListOrdered,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import {
  type Workout,
  type Exercise,
  type WorkoutSet,
  newSet,
  today,
  validSet,
  labelSet,
  validate,
  isFromNewerApp,
} from "@/data/model";
import {
  priorWorkouts,
  setProfileOrdinal,
  initialSet,
  hasLoggedExercise,
  previousSetFor,
} from "@/data/workouts";
import { finishWorkout } from "@/lib/workout-editor";
import { selectInputValue } from "@/lib/set-editing";
import { changeExerciseOptions } from "@/lib/exercise-options";
import {
  changeSetLoad,
  changeSetMeasure,
  changeExtraWeight,
  hasExtraWeight,
} from "@/lib/set-load";
import {
  draftKey,
  readDraft,
  writeDraft,
  parseWorkoutDraft,
} from "@/lib/drafts";
import { trainingHaptic } from "@/lib/preferences";
import { requestPersistenceOnce } from "@/lib/persistence";
import { local } from "@/lib/storage";
import { useRestTimer } from "@/hooks/useRestTimer";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import ExercisePicker from "@/components/ExercisePicker";
import SetRow from "@/components/SetRow";
import SortableSetList from "@/components/SortableSetList";
import "@/styles/set-editing.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
      initial={doc.payload as Workout}
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
  const editing = initial.status === "completed";
  const recoveryKey = draftKey(account, "workout", id);
  const [recovered] = useState(() =>
    editing ? null : readDraft(local, recoveryKey, parseWorkoutDraft),
  );
  const [w, setW] = useState<Workout>(recovered ?? initial);
  const [picker, setPicker] = useState(false);
  const [finish, setFinish] = useState(false);
  const [saved, setSaved] = useState(!recovered);
  const [error, setError] = useState<string | null>(
    recovered
      ? "Recovered unsaved entries. Correct any errors, then retry saving."
      : null,
  );
  const [menu, changeOptions] = useReducer(changeExerciseOptions, null);
  const [routine, setRoutine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [discardChanges, setDiscardChanges] = useState(false);
  const [removeExercise, setRemoveExercise] = useState<Exercise | null>(null);
  const [focusedSetId, setFocusedSetId] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());
  const version = useRef(0);
  const actionLocked = useRef(false);
  const lastSaved = useRef(initial);
  const editorRef = useRef<HTMLDivElement>(null);
  const openExerciseId = menu?.id;
  useEffect(() => {
    if (!openExerciseId) return;
    const card = editorRef.current?.querySelector<HTMLElement>(
      "[data-options-open]",
    );
    if (!card) return;
    let pointerActivation = false;
    const beginPointer = () => {
      pointerActivation = true;
    };
    const cancelPointer = () => {
      pointerActivation = false;
    };
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !card.contains(event.target))
        changeOptions({ type: "close", id: openExerciseId });
    };
    const closeAfterClick = (event: MouseEvent) => {
      pointerActivation = false;
      closeOutside(event);
    };
    const closeOnFocus = (event: FocusEvent) => {
      // Keep the layout still until a pointer's target has received its click.
      if (!pointerActivation) closeOutside(event);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      pointerActivation = false;
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      card.querySelector<HTMLButtonElement>(".exercise-heading button")?.focus({
        preventScroll: true,
      });
      changeOptions({ type: "close", id: openExerciseId });
    };
    document.addEventListener("pointerdown", beginPointer, true);
    document.addEventListener("pointercancel", cancelPointer, true);
    document.addEventListener("click", closeAfterClick);
    document.addEventListener("focusin", closeOnFocus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", beginPointer, true);
      document.removeEventListener("pointercancel", cancelPointer, true);
      document.removeEventListener("click", closeAfterClick);
      document.removeEventListener("focusin", closeOnFocus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openExerciseId]);
  const rest = useRestTimer(account, id);
  const dirty = JSON.stringify(w) !== JSON.stringify(initial);
  const completed = w.exercises.reduce(
    (n, ex) => n + ex.sets.filter((s) => s.done && validSet(s)).length,
    0,
  );
  const total = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const invalidChecked = w.exercises.some((ex) =>
    ex.sets.some((s) => s.done && !validSet(s)),
  );
  const unfinished = w.exercises
    .flatMap((ex) => ex.sets)
    .filter((s) => !s.done);
  const nextSet =
    unfinished.find((s) => s.id === focusedSetId) ?? unfinished[0];
  const fromRoutine = !!w.routineId;
  const message = (cause: unknown) =>
    cause instanceof Error
      ? cause.message
      : "Could not save. Retry to keep your changes.";

  function change(next: Workout) {
    if (actionLocked.current) return;
    const value = { ...next, status: initial.status };
    setW(value);
    setSaved(false);
    setError(null);
    const current = ++version.current;
    if (editing) return;
    const retained = writeDraft(local, recoveryKey, value);
    try {
      validate("workout", value);
    } catch (cause) {
      setError(
        message(cause) +
          (retained
            ? " Unsaved entries are kept on this phone."
            : " Keep this screen open until corrected."),
      );
      return;
    }
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        await save(id, "workout", value);
        lastSaved.current = value;
        if (current === version.current) {
          setSaved(true);
          setError(null);
          writeDraft(local, recoveryKey, null);
        }
      })
      .catch((cause) => {
        if (current === version.current)
          setError(
            message(cause) +
              (retained
                ? " Unsaved entries are kept on this phone. Retry saving."
                : " Keep this screen open and retry saving."),
          );
      });
  }
  const history = priorWorkouts(
    Object.values(state.records),
    { ...state.records[id], payload: initial },
    w.date,
  );
  const last = (exerciseId: string) =>
    history
      .flatMap((r) => (r.payload as Workout).exercises)
      .find(
        (ex) =>
          ex.exerciseId === exerciseId &&
          ex.sets.some((s) => s.done && validSet(s)),
      );
  const add = (items: { id: string; name: string }[]) =>
    change({
      ...w,
      exercises: [
        ...w.exercises,
        ...items.map((item) => {
          const prior = last(item.id)?.sets.filter(
            (s) => s.done && validSet(s),
          );
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
    else navigate(editing ? "/history?workout=" + id : "/");
  };
  const complete = async () => {
    if (actionLocked.current) return;
    actionLocked.current = true;
    setBusy(true);
    try {
      await queue.current;
      const next = finishWorkout(w);
      await save(id, "workout", next);
      writeDraft(local, recoveryKey, null);
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
        editing ? "Changes saved on this phone" : "Workout saved on this phone",
      );
      navigate("/history?workout=" + id);
    } catch (cause) {
      setError(message(cause));
      toast.error(
        editing
          ? "Changes could not be saved. Your original workout is unchanged."
          : "Could not finish. Your draft is still here.",
      );
    } finally {
      actionLocked.current = false;
      setBusy(false);
    }
  };
  const abandonWorkout = async () => {
    if (actionLocked.current) return;
    actionLocked.current = true;
    setBusy(true);
    try {
      await queue.current;
      await deleteRecord(id);
      writeDraft(local, recoveryKey, null);
      rest.skip();
      navigate("/");
      toast("Workout abandoned", {
        action: {
          label: "Undo",
          onClick: () => {
            void restoreWorkout(id).catch((cause) =>
              toast.error(
                cause instanceof Error
                  ? cause.message
                  : "Could not restore the workout. Try importing a backup.",
              ),
            );
          },
        },
      });
    } catch (cause) {
      setError(message(cause));
      toast.error("Could not abandon. The workout is still here; retry.");
    } finally {
      actionLocked.current = false;
      setBusy(false);
    }
  };

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
      {w.exercises.map((ex, ei) => {
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
        const optionsOpen = menu?.id === ex.id;
        const organizing = optionsOpen && menu.editing;
        return (
          <section
            className="exercise-card"
            key={ex.id}
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
                    optionsOpen
                      ? { type: "close" }
                      : { type: "open", id: ex.id },
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
                  disabled={ei === 0}
                  onClick={() => move(ei, -1)}
                >
                  <ArrowUp size={17} />
                  Up
                </button>
                <button
                  className="text-button"
                  disabled={ei === w.exercises.length - 1}
                  onClick={() => move(ei, 1)}
                >
                  <ArrowDown size={17} />
                  Down
                </button>
                <button
                  className="text-button danger"
                  onClick={() =>
                    hasLoggedExercise(ex) ? setRemoveExercise(ex) : remove(ex)
                  }
                >
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
                    update({
                      ...ex,
                      sets: ex.sets.map((s) =>
                        changeSetLoad(s, e.target.value as WorkoutSet["load"]),
                      ),
                    })
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
                    update({
                      ...ex,
                      sets: ex.sets.map((s) =>
                        changeSetMeasure(
                          s,
                          e.target.value as "reps" | "seconds",
                        ),
                      ),
                    })
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
                      update({
                        ...ex,
                        sets: ex.sets.map((s) =>
                          changeExtraWeight(s, event.target.checked),
                        ),
                      })
                    }
                  />
                  Extra weight
                </label>
              )}
            </div>
            <div
              className={`set-labels${organizing ? " set-compact-labels" : ""}`}
            >
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
              <span>
                {mixedMeasures ? "Reps / sec" : timed ? "Seconds" : "Reps"}
              </span>
              {organizing && <span className="set-type-label">Type</span>}
              <span>Done</span>
              <span />
            </div>
            <SortableSetList
              key={organizing ? "organizing" : "logging"}
              sets={ex.sets}
              name={ex.name}
              onReorder={(sets) => update({ ...ex, sets })}
            >
              {(s, i, handle) => {
                const previous = previousSetFor(
                  last(ex.exerciseId)?.sets ?? [],
                  s,
                  setProfileOrdinal(ex.sets, i),
                );
                const priorRecord = history.find((record) =>
                  (record.payload as Workout).exercises.some(
                    (item) =>
                      item.exerciseId === ex.exerciseId &&
                      item.sets.some((set) => set.done && validSet(set)),
                  ),
                );
                const previousLabel = previous ? labelSet(previous) : undefined;
                return (
                  <SetRow
                    compact={organizing}
                    showProfile={mixedProfiles}
                    reorderHandle={handle}
                    bodyWeightKg={bodyWeightKg}
                    next={nextSet?.id === s.id}
                    key={s.id}
                    set={s}
                    index={i}
                    name={ex.name}
                    previous={previousLabel}
                    previousDate={
                      previous && priorRecord
                        ? (priorRecord.payload as Workout).date
                        : undefined
                    }
                    onFocus={() => setFocusedSetId(s.id)}
                    onChange={(next) => {
                      update({
                        ...ex,
                        sets: ex.sets.map((x) => (x.id === s.id ? next : x)),
                      });
                      if (!s.done && next.done && !editing) {
                        rest.start();
                        trainingHaptic(rest.preferences.haptics);
                      }
                    }}
                    onRemove={() =>
                      update({
                        ...ex,
                        sets: ex.sets.filter((x) => x.id !== s.id),
                      })
                    }
                  />
                );
              }}
            </SortableSetList>
            <button
              className="add-set"
              onClick={() =>
                update({
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
      })}
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
            (!editing && (!saved || !!error)) ||
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
      <Dialog
        open={!!removeExercise}
        onOpenChange={(open) => {
          if (!open) setRemoveExercise(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeExercise?.name}?</DialogTitle>
            <DialogDescription>
              This exercise contains entered values or completed sets. Removing
              it deletes all of those sets from this workout.
            </DialogDescription>
          </DialogHeader>
          <button className="secondary" onClick={() => setRemoveExercise(null)}>
            Keep exercise
          </button>
          <button
            className="secondary danger"
            onClick={() => removeExercise && remove(removeExercise)}
          >
            Remove exercise
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={abandon}
        onOpenChange={(open) => {
          if (!busy) setAbandon(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abandon this workout?</DialogTitle>
            <DialogDescription>
              This removes the draft from your log. You can undo immediately
              afterwards.
            </DialogDescription>
          </DialogHeader>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setAbandon(false)}
          >
            Keep workout
          </button>
          <button
            className="secondary danger"
            disabled={busy}
            onClick={() => void abandonWorkout()}
          >
            {busy ? "Abandoning…" : "Abandon workout"}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={discardChanges} onOpenChange={setDiscardChanges}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>
              Your saved workout will stay as it was before editing.
            </DialogDescription>
          </DialogHeader>
          <button
            className="secondary"
            onClick={() => setDiscardChanges(false)}
          >
            Keep editing
          </button>
          <button
            className="secondary danger"
            onClick={() => navigate("/history?workout=" + id)}
          >
            Discard changes
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={finish}
        onOpenChange={(open) => {
          if (!busy) setFinish(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Save changes to " : "Finish "}
              {w.name}?
            </DialogTitle>
            <DialogDescription>
              {countLabel(completed, "completed set")} will be saved.
              {total > completed ? " Unchecked sets will be left out." : ""}
            </DialogDescription>
          </DialogHeader>
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
          <button
            className="primary"
            disabled={busy || !completed || invalidChecked}
            onClick={() => void complete()}
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Save workout"}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setFinish(false)}
          >
            {editing ? "Keep editing" : "Keep logging"}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
