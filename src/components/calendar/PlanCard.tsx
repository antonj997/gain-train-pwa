import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/useData";
import PhaseBar from "@/components/items/PhaseBar";
import DateTile from "@/components/items/DateTile";
import UndoPlaceholder from "@/components/messages/UndoPlaceholder";
import MotionList from "@/components/motion/MotionList";
import { useUndoEntries } from "@/hooks/useMessages";
import { phaseSegments } from "@/data/phase";
import {
  currentPlan,
  planDay,
  resolveCell,
  type PlannedDay,
  type PlanItem,
} from "@/data/plans";
import {
  doneDatesOf,
  nextPlannedDays,
  pausedCountUntil,
  phaseStatus,
  planAdherence,
  workoutsPerWeek,
  type AdherenceBand,
} from "@/data/plan-status";
import type { RoutineGroup, RoutineRecord } from "@/data/model";
import { localizedDate, shiftDate } from "@/lib/dates";
import { PLANS_PATH, planStatusPath } from "@/lib/routes";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n";

/** The coming workouts the card lists. */
export const UPCOMING_COUNT = 3;

const BAND: Record<AdherenceBand, { key: MessageKey; tone: string }> = {
  good: { key: "planStatus.adherenceGood", tone: " done" },
  behind: { key: "planStatus.adherenceBehind", tone: " warm" },
  off: { key: "planStatus.adherenceOff", tone: " warm" },
};

/**
 * The Calendar tab's plan card, under the calendar: the current plan's name
 * and week, its phase bar with the deload weeks, how well it is followed,
 * the days left and the next deload, then the next three workouts. A tap on
 * one opens the day sheet to move or skip it; "See how the plan is going"
 * opens the plan's status page. A plan that has not started says when it
 * starts, a paused one says so; with no plan, a quiet card offers to create
 * one. The numbers come from src/data/plan-status.ts.
 */
export default function PlanCard({
  today,
  plans,
  names,
  metaOf,
  openDate,
  undoScope,
  onOpenDay,
}: {
  today: string;
  plans: readonly PlanItem[];
  names: {
    routines: readonly RoutineRecord[];
    groups: readonly RoutineGroup[];
  };
  /** A planned day's line: exercises and length, a group's routines. */
  metaOf: (entry: PlannedDay | null) => string;
  /** The day the sheet is open on. */
  openDate: string | null;
  /** Where a skipped day's Undo shows. */
  undoScope: string;
  onOpenDay: (date: string) => void;
}) {
  const { t } = useT();
  const { state } = useData();
  const plan = currentPlan(plans, today);
  const undos = useUndoEntries(undoScope);
  const isWorkout = useMemo(
    () => (cell: string | null | undefined) => {
      const day = resolveCell(cell, names);
      return !!day && day.kind !== "rest";
    },
    [names],
  );
  const doneDates = useMemo(() => doneDatesOf(state.records), [state.records]);
  const adherence = useMemo(
    () =>
      plan
        ? planAdherence(plan, doneDates, today, {
            isWorkout,
            countUntil: pausedCountUntil(plan, doneDates, today),
          })
        : null,
    [plan, doneDates, today, isWorkout],
  );

  if (!plan || !adherence)
    return (
      <section
        className="card plan-card is-empty"
        aria-labelledby="plan-card-title"
      >
        <span className="plan-card-icon" aria-hidden="true">
          <CalendarPlus size={22} />
        </span>
        <div className="plan-card-empty-text">
          <h2 id="plan-card-title" className="plan-card-name">
            {t("calendarPlan.none")}
          </h2>
          <p className="row-sub">{t("calendarPlan.noneText")}</p>
          <Link className="text-link plan-card-link" to={PLANS_PATH}>
            {t("calendarPlan.create")}
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );

  const phase = phaseStatus(plan, today);
  const paused = !!plan.paused;
  const band = adherence.band && !paused ? BAND[adherence.band] : null;
  const weekLine =
    phase.kind === "running"
      ? t("plan.weekOf", { week: phase.week, weeks: phase.weeks })
      : phase.kind === "upcoming"
        ? t("planStatus.startsIn", { count: phase.daysUntil })
        : t("plan.ended");
  const tomorrow = shiftDate(today, 1);
  const upcoming = nextPlannedDays(
    plan,
    today,
    doneDates.has(today),
    UPCOMING_COUNT,
    isWorkout,
  );

  // The third fact: the next deload, this week's deload, else the workouts a week.
  let third: { value: string; label: string } | null = null;
  if (phase.kind === "running") {
    if (phase.deloadNow)
      third = {
        value: t("calendarPlan.now"),
        label: t("calendarPlan.deloadNow"),
      };
    else if (phase.nextDeload)
      third = {
        value: t("calendarPlan.week", { week: phase.nextDeload.week }),
        label: t("calendarPlan.nextDeload"),
      };
    else {
      const perWeek = workoutsPerWeek(plan, isWorkout);
      if (perWeek)
        third = {
          value:
            perWeek.min === perWeek.max
              ? String(perWeek.max)
              : `${perWeek.min}–${perWeek.max}`,
          label: t("calendarPlan.perWeek", { count: perWeek.max }),
        };
    }
  }

  return (
    <section className="card plan-card" aria-labelledby="plan-card-title">
      <div className="plan-card-head">
        <span className="plan-card-eyebrow">{t("calendarPlan.label")}</span>
        {paused ? (
          <span className="stat-chip muted">{t("plan.paused")}</span>
        ) : (
          band && <span className={"stat-chip" + band.tone}>{t(band.key)}</span>
        )}
      </div>
      <div className="plan-card-title">
        <h2 id="plan-card-title" className="plan-card-name">
          {plan.name}
        </h2>
        <span className="row-sub">{weekLine}</span>
      </div>
      <PhaseBar segments={phaseSegments(plan, today)} />
      {paused ? (
        <p className="status-note">{t("planStatus.pausedNote")}</p>
      ) : phase.kind === "running" ? (
        <dl className="plan-facts">
          <div>
            <dt>
              {adherence.percent === null
                ? t("calendarPlan.nothingYet")
                : t("calendarPlan.doneOf", {
                    done: adherence.done,
                    planned: adherence.planned,
                  })}
            </dt>
            <dd>
              {adherence.percent === null
                ? "–"
                : t("planStatus.percent", { pct: adherence.percent })}
            </dd>
          </div>
          <div>
            <dt>
              {phase.daysLeft > 0
                ? t("calendarPlan.daysLeft", { count: phase.daysLeft })
                : t("calendarPlan.lastDay")}
            </dt>
            <dd>{phase.daysLeft > 0 ? phase.daysLeft : "0"}</dd>
          </div>
          {third && (
            <div>
              <dt>{third.label}</dt>
              <dd>{third.value}</dd>
            </div>
          )}
        </dl>
      ) : null}
      {!paused && (
        <div className="plan-upcoming">
          <div className="plan-card-head">
            <h3 className="plan-card-eyebrow">{t("calendarPlan.upcoming")}</h3>
          </div>
          <MotionList className="plan-upcoming-list">
            {[
              ...undos.map((entry) => (
                <UndoPlaceholder key={`u${entry.id}`} entry={entry} />
              )),
              ...upcoming.map((date) => {
                const entry = resolveCell(planDay(plan, date).cell, names);
                const title = entry?.title ?? "";
                const meta = metaOf(entry);
                const when =
                  date === today
                    ? t("planStatus.today")
                    : date === tomorrow
                      ? t("planStatus.tomorrow")
                      : null;
                return (
                  <button
                    type="button"
                    key={date}
                    className={
                      "workout-row plan-upcoming-row" +
                      (openDate === date ? " is-selected" : "")
                    }
                    aria-haspopup="dialog"
                    aria-label={t("history.plannedDay", {
                      date: localizedDate(date, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }),
                      title: when ? `${title} (${when})` : title,
                    })}
                    onClick={() => onOpenDay(date)}
                  >
                    <DateTile date={date} planned />
                    <span className="workout-row-text" aria-hidden="true">
                      <span className="workout-row-title">{title}</span>
                      {meta && <span className="workout-row-meta">{meta}</span>}
                    </span>
                    {when && (
                      <span className="stat-chip muted" aria-hidden="true">
                        {when}
                      </span>
                    )}
                  </button>
                );
              }),
            ]}
          </MotionList>
          {!upcoming.length && !undos.length && (
            <p className="status-note">{t("calendarPlan.noneAhead")}</p>
          )}
        </div>
      )}
      <Link className="text-link plan-card-link" to={planStatusPath(plan.id)}>
        {t("calendarPlan.status")}
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
