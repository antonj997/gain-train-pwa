import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import {
  type Workout,
  type Exercise,
  type WorkoutSet,
  newSet,
  today,
  validSet,
  labelSet,
} from "@/data/model";
import ExercisePicker from "@/components/ExercisePicker";
import SetRow from "@/components/SetRow";
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
  const doc = id ? state.records[id] : null;
  if (!doc || doc.deleted)
    return (
      <div className="empty">
        <h1>Workout not found</h1>
        <Link to="/">Back to workouts</Link>
      </div>
    );
  return <Editor key={id} id={id!} initial={doc.payload as Workout} />;
}
function Editor({ id, initial }: { id: string; initial: Workout }) {
  const { state, save } = useData(),
    navigate = useNavigate();
  const [w, setW] = useState(initial),
    [picker, setPicker] = useState(false),
    [finish, setFinish] = useState(false),
    [saved, setSaved] = useState(true),
    [failed, setFailed] = useState(false),
    [menu, setMenu] = useState<string | null>(null),
    [routine, setRoutine] = useState(false),
    [finishing, setFinishing] = useState(false),
    [discard, setDiscard] = useState(false);
  const queue = useRef(Promise.resolve()),
    count = useRef(0);
  const completed = w.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done && validSet(s)).length,
    0,
  );
  const total = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  function persist(next: Workout) {
    setW(next);
    setSaved(false);
    setFailed(false);
    const version = ++count.current;
    queue.current = queue.current
      .catch(() => {})
      .then(() => save(id, "workout", next))
      .then(() => {
        if (version === count.current) setSaved(true);
      })
      .catch(() => {
        setFailed(true);
      });
  }
  function change(next: Workout) {
    persist({ ...next, status: initial.status });
  }
  const history = Object.values(state.records)
    .filter(
      (r) =>
        r.id !== id &&
        !r.deleted &&
        r.kind === "workout" &&
        (r.payload as Workout).status === "completed" &&
        (r.payload as Workout).date <= w.date,
    )
    .sort((a, b) =>
      (b.payload as Workout).date.localeCompare((a.payload as Workout).date),
    );
  const last = (exerciseId: string) =>
    history
      .flatMap((r) => (r.payload as Workout).exercises)
      .find((e) => e.exerciseId === exerciseId);
  const add = (items: { id: string; name: string }[]) => {
    change({
      ...w,
      exercises: [
        ...w.exercises,
        ...items.map((item) => {
          const prev = last(item.id);
          return {
            id: crypto.randomUUID(),
            exerciseId: item.id,
            name: item.name,
            sets: prev?.sets.filter((s) => s.done).map((s) => newSet(s)) || [
              newSet(),
            ],
          };
        }),
      ],
    });
  };
  const update = (ex: Exercise) =>
    change({
      ...w,
      exercises: w.exercises.map((e) => (e.id === ex.id ? ex : e)),
    });
  const remove = (ex: Exercise) => {
    const old = w.exercises;
    change({ ...w, exercises: old.filter((e) => e.id !== ex.id) });
    setMenu(null);
    toast("Exercise removed", {
      action: {
        label: "Undo",
        onClick: () => change({ ...w, exercises: old }),
      },
    });
  };
  const move = (index: number, step: number) => {
    const items = [...w.exercises];
    [items[index], items[index + step]] = [items[index + step], items[index]];
    change({ ...w, exercises: items });
  };
  const complete = async () => {
    if (finishing) return;
    setFinishing(true);
    await queue.current;
    if (failed) {
      setFinishing(false);
      return;
    }
    const next: Workout = {
      ...w,
      status: "completed",
      duration:
        w.duration ??
        (w.startedAt
          ? Math.min(
              1440,
              Math.max(0, Math.floor((Date.now() - w.startedAt) / 60000)),
            )
          : null),
      exercises: w.exercises
        .map((e) => ({
          ...e,
          sets: e.sets.filter((s) => s.done && validSet(s)),
        }))
        .filter((e) => e.sets.length),
    };
    try {
      await save(id, "workout", next);
      if (routine)
        try {
          await save(crypto.randomUUID(), "routine", {
            name: next.name,
            exercises: next.exercises.map((e) => ({
              ...e,
              sets: e.sets.map((s) => ({ ...s, done: false })),
            })),
          });
        } catch {
          toast.error(
            "Workout saved, but the routine could not be saved. Create it from History later.",
          );
        }
      toast.success("Workout saved on this phone");
      navigate("/history?workout=" + id);
    } catch {
      toast.error("Could not finish. Your draft is still here.");
    } finally {
      setFinishing(false);
    }
  };
  return (
    <div className="workout-editor stack">
      <div className="editor-heading">
        <Link
          to="/"
          className="icon-button"
          aria-label="Save and leave workout"
        >
          <ArrowLeft size={23} />
        </Link>
        <div>
          <h1>{w.name}</h1>
          <span className={failed ? "error-text" : "muted"} role="status">
            {failed
              ? "Not saved. Keep this screen open."
              : saved
                ? initial.status === "completed"
                  ? "Changes saved on this phone"
                  : "Draft saved on this phone"
                : "Saving…"}
          </span>
        </div>
      </div>
      <details
        className="workout-details"
        open={w.startedAt === null || undefined}
      >
        <summary>Workout details · {w.date}</summary>
        <div className="details-grid">
          <label>
            Name
            <input
              value={w.name}
              maxLength={100}
              onChange={(e) => {
                const name = e.target.value;
                setW({ ...w, name });
                if (name.trim()) change({ ...w, name });
              }}
              onBlur={() => {
                if (!w.name.trim()) change({ ...w, name: "Workout" });
              }}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={w.date}
              max={today()}
              onChange={(e) => {
                if (e.target.value) change({ ...w, date: e.target.value });
              }}
            />
          </label>
          <label>
            Duration (optional, minutes)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="1440"
              placeholder={w.startedAt ? "Automatic timer" : "Not recorded"}
              value={w.duration ?? ""}
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
      {w.exercises.map((ex, ei) => (
        <section className="exercise-card" key={ex.id}>
          <div className="exercise-heading">
            <div>
              <span className="eyebrow">EXERCISE {ei + 1}</span>
              <h2>{ex.name}</h2>
            </div>
            <button
              className="icon-button"
              aria-label={"Options for " + ex.name}
              onClick={() => setMenu(menu === ex.id ? null : ex.id)}
            >
              <MoreHorizontal size={23} />
            </button>
          </div>
          {menu === ex.id && (
            <div className="exercise-actions">
              <button
                className="secondary"
                disabled={ei === 0}
                onClick={() => move(ei, -1)}
              >
                <ArrowUp size={17} />
                Up
              </button>
              <button
                className="secondary"
                disabled={ei === w.exercises.length - 1}
                onClick={() => move(ei, 1)}
              >
                <ArrowDown size={17} />
                Down
              </button>
              <button className="secondary danger" onClick={() => remove(ex)}>
                <Trash2 size={17} />
                Remove
              </button>
            </div>
          )}
          <label className="load-label">
            Load type
            <select
              value={ex.sets[0]?.load || "weight"}
              onChange={(e) =>
                update({
                  ...ex,
                  sets: ex.sets.map((s) => ({
                    ...s,
                    load: e.target.value as WorkoutSet["load"],
                    done: false,
                  })),
                })
              }
            >
              <option value="weight">Weight (kg)</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="assisted">Assisted (kg)</option>
            </select>
          </label>
          <div className="set-labels">
            <span>Set</span>
            <span>{ex.sets[0]?.load === "assisted" ? "Assist kg" : "kg"}</span>
            <span>Reps</span>
            <span>Done</span>
            <span />
          </div>
          {ex.sets.map((s, i) => (
            <SetRow
              editing={initial.status === "completed"}
              key={s.id}
              set={s}
              index={i}
              name={ex.name}
              previous={
                last(ex.exerciseId)?.sets[i]
                  ? labelSet(last(ex.exerciseId)!.sets[i])
                  : undefined
              }
              onChange={(next) =>
                update({
                  ...ex,
                  sets: ex.sets.map((x) => (x.id === s.id ? next : x)),
                })
              }
              onRemove={() => {
                const old = ex;
                update({ ...ex, sets: ex.sets.filter((x) => x.id !== s.id) });
                toast("Set removed", {
                  action: { label: "Undo", onClick: () => update(old) },
                });
              }}
            />
          ))}
          <button
            className="add-set"
            onClick={() =>
              update({ ...ex, sets: [...ex.sets, newSet(ex.sets.at(-1))] })
            }
          >
            <Plus size={18} />
            Add set
          </button>
        </section>
      ))}
      {!w.exercises.length && (
        <div className="empty-card">
          <h2>
            {w.startedAt ? "Let's log your first set" : "What did you train?"}
          </h2>
          <p>
            Add your exercises. Previous weights and reps will be suggested when
            available.
          </p>
        </div>
      )}
      <button className="secondary large" onClick={() => setPicker(true)}>
        <Plus size={21} />
        Add exercises
      </button>
      <button className="text-button danger" onClick={() => setDiscard(true)}>
        Discard workout
      </button>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this workout?</DialogTitle>
            <DialogDescription>
              This removes the workout from your log. You can undo it
              immediately afterwards.
            </DialogDescription>
          </DialogHeader>
          <button className="secondary" onClick={() => setDiscard(false)}>
            Keep workout
          </button>
          <button
            className="secondary danger"
            onClick={async () => {
              await queue.current;
              await save(id, "workout", w, true);
              navigate("/");
              toast("Workout discarded", {
                action: {
                  label: "Undo",
                  onClick: () => void save(id, "workout", w),
                },
              });
            }}
          >
            Discard workout
          </button>
        </DialogContent>
      </Dialog>
      <div className="workout-footer">
        <span>
          {completed} of {total} sets done
        </span>
        <button
          className="primary"
          disabled={!completed || !saved || failed}
          onClick={() => setFinish(true)}
        >
          {initial.status === "completed" ? "Save changes" : "Finish workout"}
        </button>
      </div>
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onAdd={add}
      />
      <Dialog open={finish} onOpenChange={setFinish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish {w.name}?</DialogTitle>
            <DialogDescription>
              {completed} completed sets will be saved.
              {total > completed ? " Unchecked sets will be left out." : ""}
            </DialogDescription>
          </DialogHeader>
          <label className="check-label">
            <input
              type="checkbox"
              checked={routine}
              onChange={(e) => setRoutine(e.target.checked)}
            />
            Save as a routine for next time
          </label>
          <button
            className="primary"
            disabled={finishing}
            onClick={() => void complete()}
          >
            {finishing ? "Saving…" : "Save workout"}
          </button>
          <button className="secondary" onClick={() => setFinish(false)}>
            Keep logging
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
