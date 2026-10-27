import HistoryCalendar from "@/components/HistoryCalendar";
import {
  createHistoryCalendar,
  historyCalendarBounds,
} from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";
import { workoutPath } from "@/lib/routes";
import { toastWithUndo } from "@/lib/undo-toast";
import { completedWorkouts, doneSetCount } from "@/data/selectors";
import ConfirmDialog from "@/components/ConfirmDialog";
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
import { useData } from "@/contexts/useData";
import { today, repeatExercises, labelSet } from "@/data/model";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export default function History() {
  const { state, deleteRecord, restoreWorkout } = useData();
  const workoutStart = useStartWorkout();
  const [params, setParams] = useSearchParams();
  const now = today();
  const [calendar, setCalendar] = useState(() => createHistoryCalendar(now));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const records = completedWorkouts(state.records);
  const period = historyCalendarBounds(calendar, now);
  const filtered = records.filter(
    ({ payload: { date } }) =>
      period && date >= period.start && date <= period.end,
  );
  const weeks = [...new Set(filtered.map((r) => weekStart(r.payload.date)))];
  const selected = records.find((r) => r.id === params.get("workout"));
  const w = selected?.payload;
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
    if (!selected || busy) return;
    setBusy(true);
    try {
      await deleteRecord(selected.id);
      setConfirmDelete(false);
      setParams({});
      toastWithUndo(
        "Workout deleted",
        () => restoreWorkout(selected.id),
        "Could not restore the workout. Try restoring a backup.",
      );
    } catch (error) {
      toast.error(
        errorMessage(error, "Could not delete this workout. Try again."),
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
                filtered.filter((r) => weekStart(r.payload.date) === week)
                  .length,
                "workout",
              )}
            </small>
          </div>
          {filtered
            .filter((r) => weekStart(r.payload.date) === week)
            .map((r) => {
              const w = r.payload;
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
                      {countLabel(doneSetCount(w), "set")}
                      {w.duration !== null
                        ? " · " + durationLabel(w.duration)
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
                ? " · " + durationLabel(w.duration)
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
          <Link className="secondary" to={workoutPath(selected?.id ?? "")}>
            <Pencil size={18} />
            Edit workout
          </Link>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={17} />
            Delete workout
          </button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete && !!selected}
        title={`Delete ${w?.name ?? "this workout"}?`}
        description="You can undo immediately afterwards."
        cancelLabel="Keep workout"
        confirmLabel={busy ? "Deleting…" : "Delete workout"}
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
