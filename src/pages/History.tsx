import HistoryCalendar from "@/components/HistoryCalendar";
import WorkoutDetails from "@/components/history/WorkoutDetails";
import {
  changeHistoryCalendar,
  createHistoryCalendar,
  filterBySelection,
  historyCalendarBounds,
  historySelection,
} from "@/lib/history-calendar";
import { periodRangeLabel } from "@/lib/history-caption";
import { daysBetween } from "@/lib/dates";
import { summarize } from "@/data/summary";
import PeriodSummary from "@/components/history/PeriodSummary";
import { useTrainingPreferences } from "@/hooks/useTrainingPreferences";
import { localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";
import { notify, offerUndo } from "@/lib/message-store";
import { interleave } from "@/lib/messages";
import { useMessageState } from "@/hooks/useMessages";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import { completedWorkouts, doneSetCount } from "@/data/selectors";
import ConfirmDialog from "@/components/ConfirmDialog";
import { shiftDate, weekStart } from "@/lib/dates";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { usePlanned } from "@/hooks/usePlanned";
import {
  CalendarDays,
  CalendarRange,
  CalendarSearch,
  MoreHorizontal,
  Repeat2,
  Trash2,
} from "lucide-react";
import Swipeable from "@/components/gestures/Swipeable";
import ActivityGridIcon from "@/components/ActivityGridIcon";
import { useData } from "@/contexts/useData";
import { today, type WorkoutRecord } from "@/data/model";
import PageHeader from "@/components/PageHeader";
import WorkoutRow from "@/components/items/WorkoutRow";
import RecordPill from "@/components/items/RecordPill";
import Sheet from "@/components/ui/Sheet";
import {
  RECORD_KINDS,
  rankedKindsText,
  rankedRecords,
  recordBadges,
  recordBadgeText,
  type RecordBadge as RecordBadgeInfo,
  type RecordKind,
} from "@/data/record-rank";
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

/** The undo placeholders of one week's box. */
const historyScope = (week: string) => `history:${week}`;

export default function History() {
  const { state, deleteRecord, restoreWorkout } = useData();
  const workoutStart = useStartWorkout();
  const [params, setParams] = useSearchParams();
  const now = today();
  const [calendar, setCalendar] = useState(() => createHistoryCalendar(now));
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  // "Go to a month" opens the picker once the menu has closed, so the
  // picker keeps the focus instead of the ⋯ button.
  const pickAfterMenu = useRef(false);
  const detailed = (state = calendar) =>
    state.display === "detailed"
      ? state
      : changeHistoryCalendar(
          state,
          { type: "display", display: "detailed" },
          now,
        );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const records = useMemo(
    () => completedWorkouts(state.records),
    [state.records],
  );
  const planned = usePlanned();
  const plannedDay = useMemo(
    () => (date: string) => {
      const day = planned(date);
      return !!day && day.kind !== "rest";
    },
    [planned],
  );
  // One record per exercise per workout, strongest first; one badge per workout.
  const prs = useMemo(() => rankedRecords(records), [records]);
  const bests = useMemo(() => recordBadges(prs), [prs]);
  const [{ weightUnit }] = useTrainingPreferences();
  const period = historyCalendarBounds(calendar, now);
  const filtered = filterBySelection(records, calendar, now);
  // A period of more than a day gets its own heading and totals.
  const selection = historySelection(calendar);
  const chosenPeriod =
    selection?.kind === "dates"
      ? { label: selection.label, days: selection.dates.length }
      : selection?.kind === "range" && selection.from !== selection.to
        ? {
            label: periodRangeLabel(selection.from, selection.to),
            days: daysBetween(selection.from, selection.to) + 1,
          }
        : null;
  const periodIds = new Set(filtered.map((r) => r.id));
  const periodTotals = chosenPeriod && {
    sets: filtered.reduce((sum, r) => sum + doneSetCount(r.payload), 0),
    volumeKg: summarize(
      filtered.map((r) => r.payload),
      1,
      now,
    ).volume,
    records: prs.filter((pr) => periodIds.has(pr.workoutId)).length,
  };
  // A week whose last workout was just deleted keeps its box for the Undo.
  const { undos } = useMessageState();
  const weeks = [
    ...new Set([
      ...filtered.map((r) => weekStart(r.payload.date)),
      ...undos
        .filter((u) => u.scope.startsWith("history:"))
        .map((u) => u.scope.slice("history:".length)),
    ]),
  ].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const selected = records.find((r) => r.id === params.get("workout"));
  const w = selected?.payload;
  const repeat = async () => {
    if (!w || busy || workoutStart.busy) return;
    setParams({});
    await workoutStart.repeat(w);
  };
  // Deleting leaves an Undo in the workout's place in its week's box.
  const removeWorkout = async (r: WorkoutRecord) => {
    if (busy) return false;
    const week = weekStart(r.payload.date);
    const index = filtered
      .filter((x) => weekStart(x.payload.date) === week)
      .findIndex((x) => x.id === r.id);
    setBusy(true);
    try {
      await deleteRecord(r.id);
      offerUndo({
        scope: historyScope(week),
        index,
        text: t("history.deleted", { name: workoutTitle(r.payload.name) }),
        undo: () => restoreWorkout(r.id),
        failed: t("history.restoreFailed"),
      });
      return true;
    } catch (error) {
      notify.error(errorMessage(error, t("history.deleteFailed")));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!selected) return;
    if (await removeWorkout(selected)) {
      setConfirmDelete(false);
      setParams({});
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
        action={
          <div className="page-header-actions">
            {/* The button shows the view it switches to. */}
            <button
              type="button"
              className="icon-btn"
              aria-label={
                calendar.display === "simple"
                  ? t("history.showMonth")
                  : t("history.showGrid")
              }
              title={
                calendar.display === "simple"
                  ? t("history.showMonth")
                  : t("history.showGrid")
              }
              onClick={() =>
                setCalendar(
                  changeHistoryCalendar(
                    calendar,
                    {
                      type: "display",
                      display:
                        calendar.display === "simple" ? "detailed" : "simple",
                    },
                    now,
                  ),
                )
              }
            >
              {calendar.display === "simple" ? (
                <CalendarDays size={22} aria-hidden="true" />
              ) : (
                <ActivityGridIcon size={22} />
              )}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("history.more")}
              aria-haspopup="dialog"
              onClick={() => setMenu(true)}
            >
              <MoreHorizontal size={22} aria-hidden="true" />
            </button>
          </div>
        }
      />
      <HistoryCalendar
        value={calendar}
        now={now}
        records={records}
        planned={plannedDay}
        onChange={setCalendar}
        picking={picking}
        onPicking={setPicking}
        periodShown={!!chosenPeriod}
      />
      {chosenPeriod && periodTotals && (
        <PeriodSummary
          label={chosenPeriod.label}
          days={chosenPeriod.days}
          workouts={filtered.length}
          sets={periodTotals.sets}
          volumeKg={periodTotals.volumeKg}
          records={periodTotals.records}
          unit={weightUnit}
          onClear={() =>
            setCalendar(changeHistoryCalendar(calendar, { type: "reset" }, now))
          }
        />
      )}
      {/* Choosing a period or a month: the calendar's rarer controls. */}
      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title={t("history.title")}
        onCloseAutoFocus={(event) => {
          if (!pickAfterMenu.current) return;
          pickAfterMenu.current = false;
          event.preventDefault();
          setPicking(true);
        }}
      >
        <div className="sheet-menu">
          <button
            type="button"
            className={
              "sheet-menu-item" +
              (calendar.mode === "range" ? " is-current" : "")
            }
            aria-pressed={calendar.mode === "range"}
            onClick={() => {
              setMenu(false);
              setCalendar(
                changeHistoryCalendar(
                  detailed(),
                  {
                    type: "mode",
                    mode: calendar.mode === "range" ? "month" : "range",
                  },
                  now,
                ),
              );
            }}
          >
            <CalendarRange size={20} aria-hidden="true" />
            {calendar.mode === "range"
              ? t("history.stopPeriod")
              : t("history.choosePeriod")}
          </button>
          <button
            type="button"
            className="sheet-menu-item"
            onClick={() => {
              pickAfterMenu.current = true;
              setMenu(false);
              setCalendar(detailed());
            }}
          >
            <CalendarSearch size={20} aria-hidden="true" />
            {t("history.chooseMonth")}
          </button>
        </div>
      </Sheet>
      {groups.map(({ week, items, sets }) => (
        <section key={week} aria-label={weekTitle(week, now)}>
          <h2 className="group-title">
            {weekTitle(week, now)} · {countLabel(items.length, "workout")} ·{" "}
            {countLabel(sets, "set")}
          </h2>
          <div className="grouped">
            {interleave(
              items,
              undos.filter((u) => u.scope === historyScope(week)),
            ).map((slot) => {
              if (slot.kind === "undo")
                return (
                  <UndoPlaceholder
                    key={`u${slot.entry.id}`}
                    entry={slot.entry}
                  />
                );
              const r = slot.item;
              const w = r.payload;
              const meta = [
                w.date === now ? t("common.todayCap") : null,
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
                <Swipeable
                  key={r.id}
                  className="swipe-row"
                  actions={[
                    {
                      key: "repeat",
                      label: t("swipe.repeat"),
                      icon: <Repeat2 size={18} aria-hidden="true" />,
                      onSelect: () => {
                        if (!busy && !workoutStart.busy)
                          void workoutStart.repeat(w);
                      },
                    },
                    {
                      key: "delete",
                      label: t("swipe.delete"),
                      icon: <Trash2 size={18} aria-hidden="true" />,
                      tone: "danger",
                      onSelect: () => void removeWorkout(r),
                    },
                  ]}
                >
                  <WorkoutRow
                    date={w.date}
                    selected={calendar.selectedDate === w.date}
                    title={workoutTitle(w.name)}
                    meta={meta}
                    badge={
                      bests.has(r.id) ? (
                        <RecordBadge
                          badge={bests.get(r.id)!}
                          kinds={RECORD_KINDS.filter((kind) =>
                            prs.some(
                              (pr) => pr.workoutId === r.id && pr.top === kind,
                            ),
                          )}
                        />
                      ) : undefined
                    }
                    onClick={() => setParams({ workout: r.id })}
                  />
                </Swipeable>
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
          <Link className="btn-primary" to="/">
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
          [
            localizedDate(w.date, {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            w.duration !== null ? durationLabel(w.duration) : null,
            countLabel(doneSetCount(w), "set"),
          ]
            .filter(Boolean)
            .join(" · ")
        }
        size="full"
        className="details-dialog"
      >
        {selected && w && (
          <WorkoutDetails
            id={selected.id}
            workout={w}
            highlight={params.get("set")}
            busy={busy || workoutStart.busy}
            onRepeat={() => void repeat()}
            onDelete={() => setConfirmDelete(true)}
          />
        )}
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

/** A workout row's one record badge: "2 records", muted when only estimates. */
function RecordBadge({
  badge,
  kinds,
}: {
  badge: RecordBadgeInfo;
  kinds: RecordKind[];
}) {
  const text = recordBadgeText(badge);
  return (
    <span title={rankedKindsText(kinds)}>
      <RecordPill small quiet={badge.quiet}>
        {text}
        <span className="sr-only">
          {": "}
          {badge.quiet ? t("records.countQuiet") : rankedKindsText(kinds)}
        </span>
      </RecordPill>
    </span>
  );
}
