import HistoryCalendar from "@/components/HistoryCalendar";
import {
  createHistoryCalendar,
  historyCalendarBounds,
} from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { sortWorkoutsNewest } from "@/data/workouts";
import { weekStart } from "@/data/summary";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
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
  const { state, save, restoreWorkout } = useData();
  const workoutStart = useStartWorkout();
  const [params, setParams] = useSearchParams();
  const now = today();
  const [calendar, setCalendar] = useState(() => createHistoryCalendar(now));
  const [busy, setBusy] = useState(false);
  const records = Object.values(state.records)
    .filter(
      (r) =>
        r.kind === "workout" &&
        !r.deleted &&
        (r.payload as Workout).status === "completed",
    )
    .sort(sortWorkoutsNewest);
  const period = historyCalendarBounds(calendar, now);
  const filtered = records.filter((r) => {
    const date = (r.payload as Workout).date;
    return period && date >= period.start && date <= period.end;
  });
  const weeks = [
    ...new Set(filtered.map((r) => weekStart((r.payload as Workout).date))),
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
      <HistoryCalendar
        value={calendar}
        now={now}
        records={records}
        onChange={setCalendar}
      />
      {period && (
        <p className="small-note" aria-live="polite">
          {countLabel(filtered.length, "workout")} ·{" "}
          <time dateTime={period.start}>{localizedDate(period.start)}</time>
          {period.start !== period.end && (
            <>
              {" "}
              – <time dateTime={period.end}>{localizedDate(period.end)}</time>
            </>
          )}
        </p>
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
      {!period && (
        <p className="small-note" role="status">
          Choose a date on the calendar to begin your range.
        </p>
      )}
      {period && !filtered.length && (
        <div className="empty-card">
          <CalendarDays size={26} />
          <h2>
            {calendar.selectedDate
              ? "No workouts on this day"
              : "No workouts in this period"}
          </h2>
          <p>Choose another date on the calendar or log your next workout.</p>
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
