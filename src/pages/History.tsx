import HistoryCalendar from "@/components/HistoryCalendar";
import WorkoutDetails from "@/components/history/WorkoutDetails";
import {
  calendarMonthLimit,
  changeHistoryCalendar,
  createHistoryCalendar,
  filterBySelection,
  historyCalendarBounds,
  historySelection,
} from "@/lib/history-calendar";
import { periodRangeLabel, planSinceLine } from "@/lib/history-caption";
import { plannedFor } from "@/data/plans";
import { phaseWeek } from "@/data/phase";
import {
  historyWeeks,
  upcomingPlanned,
  weekTitle,
  type HistoryWeek,
} from "@/lib/history-weeks";
import Segmented from "@/components/ui/Segmented";
import Reveal from "@/components/motion/Reveal";
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
import { weekStart } from "@/lib/dates";
import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStartWorkout } from "@/hooks/useStartWorkout";
import { usePlanned } from "@/hooks/usePlanned";
import {
  CalendarDays,
  CalendarRange,
  CalendarSearch,
  ChevronDown,
  MoreHorizontal,
  Search,
  Repeat2,
  Trash2,
} from "lucide-react";
import Swipeable from "@/components/gestures/Swipeable";
import PlanCard from "@/components/calendar/PlanCard";
import { usePlanDaySheet } from "@/hooks/usePlanDaySheet";
import { canEditDay } from "@/data/plan-moves";
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
import MotionList from "@/components/motion/MotionList";
import { exerciseDisplayName } from "@/lib/exercise-name";

/** The undo placeholders of one week's box. */
const historyScope = (week: string) => `history:${week}`;
/** The plan card's Undo slot, for a planned day skipped from this tab. */
const PLAN_SCOPE = "calendar:plan";

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
  // Planned days ahead open Train's day sheet to move or skip them.
  const days = usePlanDaySheet({ day: now, undoScope: PLAN_SCOPE });
  const maxMonth = calendarMonthLimit(days.plans, now);
  // "Styrkeblock: 13 pass sedan 19 okt" under the compact grid (C1).
  const runningPlan = plannedFor(days.plans, now)?.plan ?? null;
  const planLine = runningPlan
    ? planSinceLine(
        runningPlan,
        records.map((r) => r.payload.date),
        now,
      )
    : null;
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
  const { undos } = useMessageState();
  // C1: Gjort | Planerat, the search and the older weeks folded away.
  const [list, setList] = useState<"done" | "planned">("done");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [showOlder, setShowOlder] = useState(false);
  const recordsOf = (id: string) =>
    prs.filter((pr) => pr.workoutId === id).length;
  const listed = historyWeeks(filtered, now, runningPlan, query, recordsOf);
  // A chosen period shows all its weeks open.
  const open = (week: HistoryWeek) =>
    selection ? { ...week, older: false } : week;
  // A week whose last workout was just deleted keeps its box for the Undo.
  const undoWeeks = undos
    .filter((u) => u.scope.startsWith("history:"))
    .map((u) => u.scope.slice("history:".length))
    .filter((key) => !listed.some((week) => week.key === key));
  const weekGroups: HistoryWeek[] = [
    ...listed.map(open),
    ...[...new Set(undoWeeks)].map((key) => ({
      key,
      label: weekTitle(key, now),
      summary: { workouts: 0, sets: 0, records: 0 },
      beforePlan: false,
      older: false,
      items: [],
    })),
  ].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  const matches = listed.reduce((sum, week) => sum + week.items.length, 0);
  // Planerat: the next two weeks' planned workouts, today's first.
  const upcoming = upcomingPlanned(
    (date) => {
      const day = planned(date);
      if (!day || day.kind === "rest") return null;
      const plan = plannedFor(days.plans, date)?.plan;
      return {
        title: day.title,
        week: (plan && phaseWeek(plan, date)?.week) || 1,
      };
    },
    now,
    records.some((r) => r.payload.date === now),
  );
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
  const renderWeek = ({
    key: week,
    label,
    summary,
    beforePlan,
    items,
  }: HistoryWeek) => (
    <section key={week} aria-label={label}>
      <h2 className="group-title history-week-title">
        <span>
          {label}
          {beforePlan && ` · ${t("history.beforePlan")}`}
        </span>
        <span className="history-week-sum">
          {[
            countLabel(summary.workouts, "workout"),
            countLabel(summary.sets, "set"),
            summary.records > 0 &&
              t("history.recordCount", { count: summary.records }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </h2>
      <MotionList className="grouped">
        {interleave(
          items,
          undos.filter((u) => u.scope === historyScope(week)),
        ).map((slot) => {
          if (slot.kind === "undo")
            return (
              <UndoPlaceholder key={`u${slot.entry.id}`} entry={slot.entry} />
            );
          const r = slot.item;
          const w = r.payload;
          const meta = [
            w.date === now ? t("common.todayCap") : null,
            w.duration !== null ? durationLabel(w.duration) : null,
            countLabel(doneSetCount(w), "set"),
            w.exercises
              .slice(0, 2)
              .map((ex) => exerciseDisplayName(ex.exerciseId, ex.name))
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
      </MotionList>
    </section>
  );
  const openWeeks = weekGroups.filter((week) => !week.older);
  const olderWeeks = weekGroups.filter((week) => week.older);
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
            <button
              type="button"
              className="icon-btn"
              aria-label={t("history.search")}
              aria-expanded={searching}
              aria-controls="history-search"
              onClick={() => {
                if (searching) setQuery("");
                setSearching(!searching);
                setList("done");
              }}
            >
              <Search size={22} aria-hidden="true" />
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
      {/* Search (C1): the field unfolds, takes the focus and filters the list. */}
      <Reveal>
        {searching && (
          <label className="search-field history-search" id="history-search">
            <span className="sr-only">{t("history.search")}</span>
            <input
              type="search"
              placeholder={t("history.searchPlaceholder")}
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  setSearching(false);
                }
              }}
            />
          </label>
        )}
      </Reveal>
      <HistoryCalendar
        value={calendar}
        now={now}
        records={records}
        planned={plannedDay}
        edit={{
          can: (date) => plannedDay(date) && canEditDay(days.plans, date, now),
          title: (date) => planned(date)?.title ?? "",
          open: days.open,
          openDate: days.openDate,
        }}
        maxMonth={maxMonth}
        onChange={setCalendar}
        picking={picking}
        onPicking={setPicking}
        periodShown={!!chosenPeriod}
        planLine={planLine}
      />
      {chosenPeriod && periodTotals && (
        <PeriodSummary
          label={chosenPeriod.label}
          days={chosenPeriod.days}
          weeks={selection?.kind === "dates"}
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
      <PlanCard
        today={now}
        plans={days.plans}
        names={days.names}
        metaOf={days.metaOf}
        openDate={days.openDate}
        undoScope={PLAN_SCOPE}
        onOpenDay={days.open}
      />
      {days.sheetNode}
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
      {/* C1: what was done, or what is planned, under the calendar. */}
      <Segmented<"done" | "planned">
        label={t("history.listLabel")}
        value={list}
        options={[
          { value: "done", label: t("history.done") },
          {
            value: "planned",
            label: t("history.plannedTab", { count: upcoming.length }),
          },
        ]}
        onChange={setList}
      />
      {list === "done" && query.trim() && (
        <p className="history-search-line" role="status">
          {matches
            ? t("history.searchMatches", {
                count: matches,
                query: query.trim(),
              })
            : t("history.searchNone", { query: query.trim() })}
        </p>
      )}
      {list === "done" && openWeeks.map(renderWeek)}
      {list === "done" && olderWeeks.length > 0 && (
        <button
          type="button"
          className="history-older"
          aria-expanded={showOlder}
          onClick={() => setShowOlder(!showOlder)}
        >
          {t("history.olderWeeks")}
          <ChevronDown
            className={"history-older-chev" + (showOlder ? " is-open" : "")}
            size={18}
            aria-hidden="true"
          />
        </button>
      )}
      {list === "done" && (
        <Reveal>
          {showOlder && olderWeeks.length > 0 && (
            <div className="history-older-weeks">
              {olderWeeks.map(renderWeek)}
            </div>
          )}
        </Reveal>
      )}
      {list === "planned" &&
        (upcoming.length ? (
          <div className="grouped">
            {upcoming.map((day) => (
              <WorkoutRow
                key={day.date}
                date={day.date}
                planned
                title={day.title}
                meta={
                  day.date === now
                    ? t("history.plannedTodayWeek", { week: day.week })
                    : t("history.plannedWeek", { week: day.week })
                }
                onClick={() => days.open(day.date)}
              />
            ))}
          </div>
        ) : (
          <p className="small-note">{t("history.nothingPlanned")}</p>
        ))}
      {!period && (
        <p className="small-note" role="status">
          {t("history.chooseDateToBegin")}
        </p>
      )}
      {/* A month still to come has nothing to list yet. */}
      {list === "done" &&
        !query.trim() &&
        period &&
        !filtered.length &&
        period.start <= now && (
          <div className="empty-card">
            <CalendarDays size={26} />
            <h2>
              {calendar.selectedDate
                ? t("history.noneOnDay")
                : t("history.noneInPeriod")}
            </h2>
            <Link className="btn-primary" to="/">
              {t("history.logWorkout")}
            </Link>
          </div>
        )}
      <Sheet
        open={!!selected}
        onClose={() => setParams({})}
        title={w && workoutTitle(w.name)}
        // Just the date: the tiles below give the time and the sets.
        description={
          w &&
          localizedDate(w.date, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
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
