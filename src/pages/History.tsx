import HistoryDatePicker from "@/components/HistoryDatePicker";
import HistoryCalendar from "@/components/HistoryCalendar";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { sortWorkoutsNewest } from "@/data/workouts";
import {
  historyPeriod,
  summarize,
  weekStart,
  metricChange,
  improvementRate,
} from "@/data/summary";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import {
  Repeat,
  ChevronRight,
  Trash2,
  Pencil,
  CalendarDays,
  ChevronDown,
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
  const { state, save, restoreWorkout } = useData();
  const workoutStart = useStartWorkout();
  const [params, setParams] = useSearchParams();
  const now = today();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const changePeriod = (value: string) => {
    setMonth(value);
    setSelectedDate(null);
  };
  const [busy, setBusy] = useState(false);
  const records = Object.values(state.records)
    .filter(
      (r) =>
        r.kind === "workout" &&
        !r.deleted &&
        (r.payload as Workout).status === "completed",
    )
    .sort(sortWorkoutsNewest);
  const period = historyPeriod(month, now);
  const periodRecords = records.filter((r) => {
    const date = (r.payload as Workout).date;
    return date >= period.start && date <= period.end;
  });
  const filtered = selectedDate
    ? periodRecords.filter((r) => (r.payload as Workout).date === selectedDate)
    : periodRecords;
  const current = summarize(
    periodRecords.map((r) => r.payload as Workout),
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
      label: "Workouts / active week",
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
      label: "Exercises improving",
      value: improvementRate(records, period.start, period.end),
      prior: improvementRate(records, period.previousStart, period.previousEnd),
      decimals: 0,
      suffix: "%",
    },
  ];
  const selected = records.find((r) => r.id === params.get("workout"));
  const w = selected?.payload as Workout | undefined;
  const repeat = async () => {
    if (!w || busy || workoutStart.busy) return;
    const now = Date.now();
    setParams({});
    await workoutStart.start({
      ...w,
      date: today(),
      duration: null,
      startedAt: now,
      createdAt: now,
      completedAt: undefined,
      status: "draft",
      exercises: repeatExercises(w.exercises),
    });
  };
  const remove = async () => {
    if (
      !selected ||
      busy ||
      !window.confirm(
        "Delete this workout? You can undo immediately afterwards.",
      )
    )
      return;
    setBusy(true);
    try {
      await save(selected.id, "workout", selected.payload, true);
      setParams({});
      toast("Workout deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreWorkout(selected.id).catch(() =>
              toast.error(
                "Could not restore the workout. Try restoring a backup.",
              ),
            ),
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete this workout. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack history-page">
      {workoutStart.confirmation}
      <div className="section-heading">
        <h1>History</h1>
        <span className="muted">{countLabel(records.length, "workout")}</span>
      </div>
      <p className="small-note">
        {localizedDate(period.start)} – {localizedDate(period.end)}
      </p>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {metric.value === null
                ? "—"
                : metric.value.toFixed(metric.decimals) + (metric.suffix ?? "")}
            </strong>
            <small>
              {metricChange(metric.value, metric.prior, metric.decimals)}
              {metric.suffix && metric.value !== null && metric.prior !== null
                ? " pp"
                : ""}
            </small>
          </div>
        ))}
      </div>
      <HistoryCalendar
        month={/^\d{4}-\d{2}$/.test(month) ? month : now.slice(0, 7)}
        now={now}
        records={records}
        selectedDate={selectedDate}
        onMonthChange={changePeriod}
        onSelectDate={(date) => {
          setMonth(date.slice(0, 7));
          setSelectedDate((selected) => (selected === date ? null : date));
        }}
      />
      <details className="history-period-options">
        <summary>More periods</summary>
        <HistoryDatePicker value={month} onChange={changePeriod} />
      </details>
      <details className="period-summary">
        <summary className="session-summary">
          <strong>About these stats</strong>
          <ChevronDown size={18} />
        </summary>
        <p className="small-note">
          Compared with {localizedDate(period.previousStart)} –{" "}
          {localizedDate(period.previousEnd)}.
        </p>
        <p className="small-note">
          Active weeks are Monday–Sunday weeks with at least one workout in this
          period. Duration averages exclude sessions without a recorded
          duration. Exercises improving compares your latest working result with
          the last session before the period, or the first session within it.
          Only matching load and measure count: estimated strength for weighted
          sets of 1–10 reps, otherwise reps or seconds at the same load. A dash
          means there is not enough data. Percentage changes use percentage
          points (pp).
        </p>
      </details>
      {selectedDate && (
        <div className="history-selected-date">
          <h2>
            {localizedDate(selectedDate, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </h2>
          <button className="text-button" onClick={() => setSelectedDate(null)}>
            Show whole month
          </button>
        </div>
      )}
      {weeks.map((week) => (
        <section className="history-week" key={week}>
          <div className="section-heading">
            <h2>
              Week of {localizedDate(week, { day: "numeric", month: "short" })}
            </h2>
            <small>
              {countLabel(
                filtered.filter(
                  (r) => weekStart((r.payload as Workout).date) === week,
                ).length,
                "workout",
              )}
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
                    {localizedDate(w.date, {
                      weekday: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="history-name">
                    <strong>{w.name}</strong>
                    <small>
                      {countLabel(w.exercises.length, "exercise")} ·{" "}
                      {countLabel(
                        w.exercises.reduce(
                          (n, e) => n + e.sets.filter((s) => s.done).length,
                          0,
                        ),
                        "set",
                      )}
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
          <h2>
            {selectedDate
              ? "No workouts on this day"
              : "No workouts in this period"}
          </h2>
          <p>Choose another month or log your next workout.</p>
          {month && (
            <button className="secondary" onClick={() => changePeriod("")}>
              Show last 30 days
            </button>
          )}
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
              {w && localizedDate(w.date)}
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
          <button
            className="primary"
            disabled={busy || workoutStart.busy}
            onClick={() => void repeat()}
          >
            <Repeat size={18} />
            {busy ? "Please wait…" : "Repeat workout"}
          </button>
          <Link className="secondary" to={"/workout/" + selected?.id}>
            <Pencil size={18} />
            Edit workout
          </Link>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            <Trash2 size={17} />
            Delete workout
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
