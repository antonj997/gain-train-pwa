import { suggestedExercises } from "@/data/start";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Play, Trash2, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { type Routine, newSet, repeatExercises, today } from "@/data/model";
import ExercisePicker from "@/components/ExercisePicker";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export default function Routines() {
  const { state, save } = useData(),
    navigate = useNavigate();
  const [edit, setEdit] = useState<{ id: string; data: Routine } | null>(null),
    [picker, setPicker] = useState(false);
  const records = Object.values(state.records).filter(
    (r) => r.kind === "routine" && !r.deleted,
  );
  const moveExercise = (id: string, direction: -1 | 1) => {
    setEdit((current) => {
      if (!current) return current;
      const exercises = [...current.data.exercises];
      const index = exercises.findIndex((exercise) => exercise.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= exercises.length) return current;
      [exercises[index], exercises[target]] = [
        exercises[target],
        exercises[index],
      ];
      return { ...current, data: { ...current.data, exercises } };
    });
  };
  return (
    <div className="stack">
      <h1>Routines</h1>
      <button
        className="primary"
        onClick={() =>
          setEdit({
            id: crypto.randomUUID(),
            data: { name: "", exercises: [] },
          })
        }
      >
        <Plus size={20} />
        Create routine
      </button>
      {records.map((r) => (
        <div className="routine-card" key={r.id}>
          <h2>{r.payload.name}</h2>
          <p className="muted">
            {(r.payload as Routine).exercises.map((e) => e.name).join(" · ")}
          </p>
          <div className="button-row">
            <button
              className="primary"
              onClick={async () => {
                const id = crypto.randomUUID();
                await save(id, "workout", {
                  ...(r.payload as Routine),
                  date: today(),
                  duration: null,
                  startedAt: Date.now(),
                  status: "draft",
                  exercises: suggestedExercises(
                    (r.payload as Routine).exercises,
                    Object.values(state.records),
                  ),
                });
                navigate("/workout/" + id);
              }}
            >
              <Play size={18} />
              Start
            </button>
            <button
              className="secondary"
              onClick={() => setEdit({ id: r.id, data: r.payload as Routine })}
            >
              <Pencil size={18} />
              Edit
            </button>
            <button
              className="icon-button danger"
              aria-label={"Delete " + r.payload.name}
              onClick={async () => {
                await save(r.id, "routine", r.payload, true);
                toast("Routine deleted", {
                  action: {
                    label: "Undo",
                    onClick: () => void save(r.id, "routine", r.payload),
                  },
                });
              }}
            >
              <Trash2 size={19} />
            </button>
          </div>
        </div>
      ))}
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>Edit routine</DialogTitle>
            <DialogDescription>
              Choose exercises and use the arrows to change their order. Your
              last weights and reps are available while logging.
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
                <div className="routine-exercise" key={ex.id}>
                  <strong>{ex.name}</strong>
                  <div className="routine-exercise-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Move " + ex.name + " up"}
                      disabled={index === 0}
                      onClick={() => moveExercise(ex.id, -1)}
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Move " + ex.name + " down"}
                      disabled={index === edit.data.exercises.length - 1}
                      onClick={() => moveExercise(ex.id, 1)}
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={"Remove " + ex.name}
                      onClick={() =>
                        setEdit({
                          ...edit,
                          data: {
                            ...edit.data,
                            exercises: edit.data.exercises.filter(
                              (e) => e.id !== ex.id,
                            ),
                          },
                        })
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              <button className="secondary" onClick={() => setPicker(true)}>
                Add exercises
              </button>
              <button
                className="primary"
                disabled={!edit.data.name.trim() || !edit.data.exercises.length}
                onClick={async () => {
                  await save(edit.id, "routine", edit.data);
                  setEdit(null);
                  toast.success("Routine saved");
                }}
              >
                Save routine
              </button>
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
                  ...items.map((e) => ({
                    id: crypto.randomUUID(),
                    exerciseId: e.id,
                    name: e.name,
                    sets: [newSet()],
                  })),
                ],
              },
            });
        }}
      />
    </div>
  );
}
