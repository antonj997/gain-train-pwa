import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Repeat,
  ChevronRight,
  Trash2,
  Pencil,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { type Workout, today, repeatExercises, labelSet } from "@/data/model";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export default function History() {
  const { state, save } = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState("");
  const records = Object.values(state.records)
    .filter(
      (r) =>
        r.kind === "workout" &&
        !r.deleted &&
        (r.payload as Workout).status === "completed",
    )
    .sort((a, b) =>
      (b.payload as Workout).date.localeCompare((a.payload as Workout).date),
    );
  const selected = records.find((r) => r.id === params.get("workout"));
  const w = selected?.payload as Workout | undefined;
  const repeat = async () => {
    if (!w) return;
    const id = crypto.randomUUID();
    await save(id, "workout", {
      ...w,
      date: today(),
      duration: null,
      startedAt: Date.now(),
      status: "draft",
      exercises: repeatExercises(w.exercises),
    });
    navigate("/workout/" + id);
  };
  const remove = async () => {
    if (
      !selected ||
      !window.confirm(
        "Delete this workout? You can undo immediately afterwards.",
      )
    )
      return;
    await save(selected.id, "workout", selected.payload, true);
    setParams({});
    toast("Workout deleted", {
      action: {
        label: "Undo",
        onClick: () => void save(selected.id, "workout", selected.payload),
      },
    });
  };
  return (
    <div className="stack">
      <div className="section-heading">
        <h1>History</h1>
        <span className="muted">{records.length} workouts</span>
      </div>
      <label>
        Month{" "}
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      {month && (
        <button className="text-button" onClick={() => setMonth("")}>
          Show all workouts
        </button>
      )}
      {records
        .filter((r) => !month || (r.payload as Workout).date.startsWith(month))
        .map((r) => {
          const w = r.payload as Workout;
          return (
            <button
              className="list-card"
              key={r.id}
              onClick={() => setParams({ workout: r.id })}
            >
              <span>
                <small>
                  {new Date(w.date + "T12:00:00").toLocaleDateString(
                    undefined,
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                </small>
                <strong>{w.name}</strong>
                <small>
                  {w.exercises.length} exercises ·{" "}
                  {w.exercises.reduce(
                    (n, e) => n + e.sets.filter((s) => s.done).length,
                    0,
                  )}{" "}
                  sets
                  {w.duration !== null
                    ? " · " + (w.duration === 0 ? "<1" : w.duration) + " min"
                    : ""}
                </small>
              </span>
              <ChevronRight size={20} />
            </button>
          );
        })}
      {!records.filter(
        (r) => !month || (r.payload as Workout).date.startsWith(month),
      ).length && (
        <div className="empty-card">
          <CalendarDays size={30} />
          <h2>
            {month
              ? "No workouts this month"
              : "Your story starts with one workout"}
          </h2>
          <p>Completed workouts appear here, ready to repeat or edit.</p>
          <Link className="primary" to="/">
            Log a workout
          </Link>
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setParams({});
        }}
      >
        <DialogContent className="detail-dialog">
          <DialogHeader>
            <DialogTitle>{w?.name}</DialogTitle>
            <DialogDescription>
              {w?.date}
              {w?.duration !== null && w?.duration !== undefined
                ? " · " + (w.duration === 0 ? "<1" : w.duration) + " min"
                : ""}
            </DialogDescription>
          </DialogHeader>
          {w?.exercises.map((ex) => (
            <section key={ex.id}>
              <h3>{ex.name}</h3>
              {ex.sets
                .filter((s) => s.done)
                .map((s, i) => (
                  <div className="history-set" key={s.id}>
                    <span>
                      Set {i + 1}
                      {s.section !== "working"
                        ? " · " +
                          (s.section === "warmup" ? "Warm-up" : "Cool-down")
                        : ""}
                    </span>
                    <strong>{labelSet(s)}</strong>
                  </div>
                ))}
            </section>
          ))}
          <button className="primary" onClick={() => void repeat()}>
            <Repeat size={18} />
            Repeat workout
          </button>
          <Link className="secondary" to={"/workout/" + selected?.id}>
            <Pencil size={18} />
            Edit workout
          </Link>
          <button className="text-button danger" onClick={() => void remove()}>
            <Trash2 size={17} />
            Delete workout
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
