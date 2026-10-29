import HistoryCalendar from "@/components/HistoryCalendar";
import HistorySetList from "@/components/HistorySetList";
import {
  createHistoryCalendar,
  filterBySelection,
  historyCalendarBounds,
} from "@/lib/history-calendar";
import { localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";
import { workoutPath } from "@/lib/routes";
import { toastWithUndo } from "@/lib/undo-toast";
import { completedWorkouts, doneSetCount } from "@/data/selectors";
import ConfirmDialog from "@/components/ConfirmDialog";
import { shiftDate, weekStart } from "@/data/summary";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { Repeat, Trash2, Pencil, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/useData";
import { today } from "@/data/model";
import PageHeader from "@/components/PageHeader";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import { newBestWorkoutIds, progressFor } from "@/data/analytics";
/** "This week", or the Monday–Sunday span such as "19–25 Oct". */
function weekTitle(week: string, now: string) {
  if (week === weekStart(now)) return "This week";
  const end = shiftDate(week, 6);
  const day = (date: string) => localizedDate(date, { day: "numeric" });
  const month = (date: string) => localizedDate(date, { month: "short" });
  return month(week) === month(end)
    ? `${day(week)}–${day(end)} ${month(end)}`
    : `${day(week)} ${month(week)}–${day(end)} ${month(end)}`;
}

export default function History() {
  const { state, deleteRecord, restoreWorkout } = useData();
  const workoutStart = useStartWorkout();
  const [params, setParams] = useSearchParams();
  const now = today();
  const [calendar, setCalendar] = useState(() => createHistoryCalendar(now));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const records = useMemo(
    () => completedWorkouts(state.records),
    [state.records],
  );
  const bests = useMemo(
    () => newBestWorkoutIds(progressFor(records)),
    [records],
  );
  const period = historyCalendarBounds(calendar, now);
  const filtered = filterBySelection(records, calendar, now);
  const weeks = [...new Set(filtered.map((r) => weekStart(r.payload.date)))];
  const selected = records.find((r) => r.id === params.get("workout"));
  const w = selected?.payload;
  const repeat = async () => {
    if (!w || busy || workoutStart.busy) return;
    setParams({});
    await workoutStart.repeat(w);
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
  const monthName = localizedDate(calendar.month + "-01", { month: "long" });
  const inMonth = records.filter(
    (r) => r.payload.date.slice(0, 7) === calendar.month,
  ).length;
  const groups = weeks.map((week) => {
    const items = filtered.filter((r) => weekStart(r.payload.date) === week);
    return {
      week,
      items,
      sets: items.reduce((sum, r) => sum + doneSetCount(r.payload), 0),
    };
  });
  return (
    <div className="page history-page">
      {workoutStart.confirmation}
      <PageHeader
        eyebrow={
          calendar.display === "simple"
            ? `${countLabel(filtered.length, "workout")} ${calendar.selectedDate ? "on this day" : "in view"}`
            : `${countLabel(inMonth, "workout")} in ${monthName}`
        }
        title="History"
      />
      <HistoryCalendar
        value={calendar}
        now={now}
        records={records}
        onChange={setCalendar}
      />
      {groups.map(({ week, items, sets }) => (
        <section key={week} aria-label={weekTitle(week, now)}>
          <h2 className="group-title">
            {weekTitle(week, now)} · {countLabel(items.length, "workout")} ·{" "}
            {countLabel(sets, "set")}
          </h2>
          <div className="list">
            {items.map((r) => {
              const w = r.payload;
              const sub = [
                w.date === now
                  ? "Today"
                  : localizedDate(w.date, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    }),
                w.duration !== null ? durationLabel(w.duration) : null,
                countLabel(doneSetCount(w), "set"),
                w.exercises
                  .slice(0, 2)
                  .map((ex) => ex.name)
                  .join(", ") || null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <ListRow
                  key={r.id}
                  className={
                    calendar.selectedDate === w.date
                      ? "row-selected"
                      : undefined
                  }
                  title={w.name}
                  sub={sub}
                  trailing={
                    bests.has(r.id) ? (
                      <span className="badge-new">New best</span>
                    ) : undefined
                  }
                  chevron
                  onClick={() => setParams({ workout: r.id })}
                />
              );
            })}
          </div>
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
      <Sheet
        open={!!selected}
        onClose={() => setParams({})}
        title={w?.name}
        description={
          w &&
          localizedDate(w.date) +
            (w.duration !== null ? " · " + durationLabel(w.duration) : "")
        }
        size="full"
      >
        {w?.exercises.map((ex) => (
          <section key={ex.id}>
            <h3 className="group-title">{ex.name}</h3>
            <HistorySetList sets={ex.sets} />
          </section>
        ))}
        <button
          className="btn-primary"
          disabled={busy || workoutStart.busy}
          onClick={() => void repeat()}
        >
          <Repeat size={18} aria-hidden="true" />
          {busy ? "Please wait…" : "Repeat workout"}
        </button>
        <Link className="btn-secondary" to={workoutPath(selected?.id ?? "")}>
          <Pencil size={18} aria-hidden="true" />
          Edit workout
        </Link>
        <button
          className="btn-danger"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={17} aria-hidden="true" />
          Delete workout
        </button>
      </Sheet>
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
