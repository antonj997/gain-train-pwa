import {
  historyPeriod,
  summarize,
  weekStart,
  metricChange,
} from "@/data/summary";
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
  const period = historyPeriod(month, today());
  const filtered = records.filter((r) => {
    const date = (r.payload as Workout).date;
    return date >= period.start && date <= period.end;
  });
  const current = summarize(
    filtered.map((r) => r.payload as Workout),
    period.days,
  );
  const previous = summarize(
    records
      .filter((r) => {
        const date = (r.payload as Workout).date;
        return date >= period.previousStart && date <= period.previousEnd;
      })
      .map((r) => r.payload as Workout),
    period.previousDays,
  );
  const weeks = [
    ...new Set(filtered.map((r) => weekStart((r.payload as Workout).date))),
  ];
  const metrics = [
    {
      label: "Workouts",
      value: current.workouts,
      prior: previous.workouts,
      decimals: 0,
    },
    {
      label: "Workouts / week",
      value: current.perWeek,
      prior: previous.perWeek,
      decimals: 1,
    },
    {
      label: "Avg duration · min",
      value: current.duration,
      prior: previous.duration,
      decimals: 0,
    },
    {
      label: "Training time · min",
      value: current.minutes,
      prior: previous.minutes,
      decimals: 0,
    },
    {
      label: "Completed sets",
      value: current.sets,
      prior: previous.sets,
      decimals: 0,
    },
    {
      label: "Working sets",
      value: current.workingSets,
      prior: previous.workingSets,
      decimals: 0,
    },
  ];
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
    <div className="stack history-page">
      <div className="section-heading">
        <h1>History</h1>
        <span className="muted">{records.length} workouts</span>
      </div>
      <div className="history-filter">
        <button
          className={month ? "secondary" : "primary"}
          onClick={() => setMonth("")}
        >
          Last 30 days
        </button>
        <label>
          Choose month
          <input
            type="month"
            aria-label="History month"
            max={today().slice(0, 7)}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <p className="small-note">
        {period.start} – {period.end}
      </p>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {metric.value === null
                ? "—"
                : metric.value.toFixed(metric.decimals)}
            </strong>
            <small>
              {metricChange(metric.value, metric.prior, metric.decimals)}
            </small>
          </div>
        ))}
      </div>
      <details className="stats-help">
        <summary>
          Compared with {period.previousStart} – {period.previousEnd}
        </summary>
        <p className="small-note">
          Arrows show the change from the previous period. Duration averages
          exclude workouts without a recorded duration. Weekly frequency
          includes weeks without workouts.
        </p>
      </details>
      {weeks.map((week) => (
        <section className="history-week" key={week}>
          <div className="section-heading">
            <h2>
              Week of{" "}
              {new Date(week + "T12:00:00").toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}
            </h2>
            <small>
              {
                filtered.filter(
                  (r) => weekStart((r.payload as Workout).date) === week,
                ).length
              }{" "}
              workouts
            </small>
          </div>
          {filtered
            .filter((r) => weekStart((r.payload as Workout).date) === week)
            .map((r) => {
              const w = r.payload as Workout;
              return (
                <button
                  className="list-card"
                  key={r.id}
                  onClick={() => setParams({ workout: r.id })}
                >
                  <span className="history-date">
                    {new Date(w.date + "T12:00:00").toLocaleDateString(
                      undefined,
                      { weekday: "short", day: "numeric" },
                    )}
                  </span>
                  <span className="history-name">
                    <strong>{w.name}</strong>
                    <small>
                      {w.exercises.length} exercises ·{" "}
                      {w.exercises.reduce(
                        (n, e) => n + e.sets.filter((s) => s.done).length,
                        0,
                      )}{" "}
                      sets
                      {w.duration !== null
                        ? " · " +
                          (w.duration === 0 ? "<1" : w.duration) +
                          " min"
                        : ""}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
        </section>
      ))}
      {!filtered.length && (
        <div className="empty-card">
          <CalendarDays size={26} />
          <h2>No workouts in this period</h2>
          <p>Choose another month or log your next workout.</p>
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
