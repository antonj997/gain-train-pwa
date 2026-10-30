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
import { shiftDate, weekStart } from "@/lib/dates";
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
import { t } from "@/i18n";
import { workoutTitle } from "@/lib/workout-name";
/** "This week", or the Monday–Sunday span such as "19–25 Oct". */
function weekTitle(week: string, now: string) {
  if (week === weekStart(now)) return t("history.thisWeek");
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
        t("history.deleted"),
        () => restoreWorkout(selected.id),
        t("history.restoreFailed"),
      );
    } catch (error) {
      toast.error(errorMessage(error, t("history.deleteFailed")));
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
            ? t(
                calendar.selectedDate ? "history.onThisDay" : "history.inView",
                {
                  workouts: countLabel(filtered.length, "workout"),
                },
              )
            : t("history.inMonth", {
                workouts: countLabel(inMonth, "workout"),
                month: monthName,
              })
        }
        title={t("history.title")}
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
                  ? t("common.todayCap")
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
                  title={workoutTitle(w.name)}
                  sub={sub}
                  trailing={
                    bests.has(r.id) ? (
                      <span className="badge-new">{t("history.newBest")}</span>
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
          {t("history.chooseDateToBegin")}
        </p>
      )}
      {period && !filtered.length && (
        <div className="empty-card">
          <CalendarDays size={26} />
          <h2>
            {calendar.selectedDate
              ? t("history.noneOnDay")
              : t("history.noneInPeriod")}
          </h2>
          <p>{t("history.emptyText")}</p>
          <Link className="primary" to="/">
            {t("history.logWorkout")}
          </Link>
        </div>
      )}
      <Sheet
        open={!!selected}
        onClose={() => setParams({})}
        title={w && workoutTitle(w.name)}
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
          {busy ? t("history.pleaseWait") : t("history.repeatWorkout")}
        </button>
        <Link className="btn-secondary" to={workoutPath(selected?.id ?? "")}>
          <Pencil size={18} aria-hidden="true" />
          {t("history.editWorkout")}
        </Link>
        <button
          className="btn-danger"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={17} aria-hidden="true" />
          {t("history.deleteWorkout")}
        </button>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete && !!selected}
        title={t("history.deleteTitle", {
          name: w ? workoutTitle(w.name) : t("history.thisWorkout"),
        })}
        description={t("history.undoAfter")}
        cancelLabel={t("history.keepWorkout")}
        confirmLabel={busy ? t("history.deleting") : t("history.deleteWorkout")}
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
