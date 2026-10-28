import { newWorkout } from "@/data/start";
import { routines } from "@/data/selectors";
import { errorMessage } from "@/lib/errors";
import { toastWithUndo } from "@/lib/undo-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useRef, useState } from "react";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { Plus, Play, Trash2, Pencil } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { type Exercise, type Routine } from "@/data/model";
import { initialSet, hasLoggedExercise } from "@/data/workouts";
import { draftKey, parseRoutineDraft } from "@/lib/drafts";
import { useRetainedDraft } from "@/hooks/useRetainedDraft";
import ExercisePicker from "@/components/ExercisePicker";
import RoutinePlan from "@/components/RoutinePlan";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function Routines() {
  const { state, save, deleteRecord } = useData();
  const { account } = useAuth();
  const workoutStart = useStartWorkout();
  const draft = useRetainedDraft(
    draftKey(account, "routine"),
    parseRoutineDraft,
  );
  const edit = draft.value;
  const setEdit = draft.replace;
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Exercise | null>(null);
  const removeExercise = (exercise: Exercise) => {
    if (edit)
      setEdit({
        ...edit,
        data: {
          ...edit.data,
          exercises: edit.data.exercises.filter(
            (item) => item.id !== exercise.id,
          ),
        },
      });
    setRemoving(null);
  };
  const lock = useRef(false);
  const records = routines(state.records);
  const update = (exercise: Exercise) => {
    if (edit)
      setEdit({
        ...edit,
        data: {
          ...edit.data,
          exercises: edit.data.exercises.map((ex) =>
            ex.id === exercise.id ? exercise : ex,
          ),
        },
      });
  };
  const moveExercise = (id: string, direction: -1 | 1) => {
    if (!edit) return;
    const exercises = [...edit.data.exercises];
    const index = exercises.findIndex((ex) => ex.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= exercises.length) return;
    [exercises[index], exercises[target]] = [
      exercises[target],
      exercises[index],
    ];
    setEdit({ ...edit, data: { ...edit.data, exercises } });
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      const message = errorMessage(
        cause,
        "Could not save. Retry; your draft is still here.",
      );
      setError(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const startEdit = (id: string, data: Routine) => {
    if (edit && edit.id !== id) {
      toast("Resume or discard the existing routine draft first.");
      setOpen(true);
      return;
    }
    if (!edit) setEdit({ id, data: structuredClone(data) });
    setError(null);
    setOpen(true);
  };
  return (
    <div className="stack">
      {workoutStart.confirmation}
      <h1>Routines</h1>
      <button
        className="primary"
        onClick={() => {
          if (!edit)
            setEdit({
              id: crypto.randomUUID(),
              data: { name: "", exercises: [] },
            });
          setError(null);
          setOpen(true);
        }}
      >
        <Plus size={20} />
        {edit ? "Resume routine draft" : "Create routine"}
      </button>
      {edit && !open && (
        <p className="draft-receipt" role="status">
          Unfinished routine: {edit.data.name || "Untitled routine"}.{" "}
          {draft.retained
            ? "Kept on this phone."
            : "Keep this page open; storage is unavailable."}
        </p>
      )}
      {!records.length && !edit && (
        <p className="empty">
          Plan your usual exercises and sets once, then start them together.
        </p>
      )}
      {records.map((r) => (
        <div className="routine-card" key={r.id}>
          <h2>{r.payload.name}</h2>
          <p className="muted">
            {r.payload.exercises
              .map(
                (ex) =>
                  `${ex.name} · ${ex.sets.length} ${ex.sets.length === 1 ? "set" : "sets"}`,
              )
              .join(" / ")}
          </p>
          <div className="button-row">
            <button
              className="primary"
              disabled={busy || workoutStart.busy}
              onClick={() =>
                void workoutStart.start(
                  newWorkout(Object.values(state.records), { routine: r }),
                )
              }
            >
              <Play size={18} />
              Start
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => startEdit(r.id, r.payload)}
            >
              <Pencil size={18} />
              Edit
            </button>
            <button
              className="icon-button danger"
              disabled={busy}
              aria-label={"Delete " + r.payload.name}
              onClick={() =>
                void run(async () => {
                  await deleteRecord(r.id);
                  toastWithUndo(
                    "Routine deleted",
                    () => save(r.id, "routine", r.payload),
                    "Could not restore the routine. Retry from a backup.",
                  );
                })
              }
            >
              <Trash2 size={19} />
            </button>
          </div>
        </div>
      ))}
      <Dialog
        open={open && !!edit}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            if (!value) setPicker(false);
          }
        }}
      >
        <DialogContent className="detail-dialog routine-dialog">
          <DialogHeader>
            <DialogTitle>
              {edit && state.records[edit.id]
                ? "Edit routine"
                : "Create routine"}
            </DialogTitle>
            <DialogDescription>
              Plan sets, load and set types. Your unfinished work is kept on
              this phone when you close this form.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <>
              <label>
                Routine name
                <input
                  value={edit.data.name}
                  maxLength={100}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, name: e.target.value },
                    })
                  }
                />
              </label>
              {edit.data.exercises.map((ex, index) => (
                <RoutinePlan
                  key={ex.id}
                  exercise={ex}
                  isFirst={index === 0}
                  isLast={index === edit.data.exercises.length - 1}
                  onChange={update}
                  onMove={(step) => moveExercise(ex.id, step)}
                  onRemove={() =>
                    hasLoggedExercise(ex) ? setRemoving(ex) : removeExercise(ex)
                  }
                />
              ))}
              <button
                className="secondary"
                onClick={() => setPicker(true)}
                disabled={busy}
              >
                <Plus size={18} />
                Add exercises
              </button>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              {!draft.retained && (
                <p className="field-error" role="alert">
                  Storage is unavailable. Keep this form open and save before
                  leaving.
                </p>
              )}
              <button
                className="primary"
                disabled={
                  busy || !edit.data.name.trim() || !edit.data.exercises.length
                }
                onClick={() =>
                  void run(async () => {
                    await save(edit.id, "routine", edit.data);
                    setEdit(null);
                    setOpen(false);
                    toast.success("Routine saved");
                  })
                }
              >
                {busy ? "Saving…" : "Save routine"}
              </button>
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Close and keep draft
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => {
                    setEdit(null);
                    setOpen(false);
                  }}
                >
                  Discard draft
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onAdd={(items) => {
          if (edit)
            setEdit({
              ...edit,
              data: {
                ...edit.data,
                exercises: [
                  ...edit.data.exercises,
                  ...items.map((item) => ({
                    id: crypto.randomUUID(),
                    exerciseId: item.id,
                    name: item.name,
                    sets: [initialSet(item.id)],
                  })),
                ],
              },
            });
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title={<>Remove {removing?.name}?</>}
        description="This exercise contains entered values. Removing it deletes its planned sets from this routine."
        cancelLabel="Keep exercise"
        confirmLabel="Remove exercise"
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && removeExercise(removing)}
      />
    </div>
  );
}
