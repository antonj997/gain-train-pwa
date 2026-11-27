import { useState } from "react";
import { Info } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import PlanPeriodCalendar from "@/components/plan/PlanPeriodCalendar";
import type { Plan } from "@/data/model";
import { planDay } from "@/data/plans";
import { deloadWeeks, phaseWeek } from "@/data/phase";
import type {
  Adherence,
  AdherenceStatus,
  IsWorkout,
  PhaseStatus,
} from "@/data/plan-status";
import { localizedDate } from "@/lib/dates";
import { periodLabels } from "@/lib/period-calendar";
import type { MessageKey } from "@/i18n";
import { useT } from "@/i18n/useT";

const STATUS: Record<AdherenceStatus, MessageKey> = {
  on: "planStatus.statusOn",
  behind: "planStatus.statusBehind",
  ahead: "planStatus.statusAhead",
};

/**
 * The plan status page's top card (v6 F2): where the phase is ("Vecka 4 av
 * 8 · byggfas", "Deload vecka 8 · slutar 20 dec"), the whole period in the
 * compact calendar's squares (done filled, coming days rings, today a dot,
 * the deload week in its tone, "v. 1", "nu", "deload" under it) with its
 * legend, and how well the plan is followed by week: "3 av 3 veckor
 * fullföljda", the status word, an ⓘ that explains a fulfilled week, and
 * "3 extrapass · 13 pass totalt · den här veckan 1 av 3".
 */
export default function PlanPeriodCard({
  plan,
  today,
  phase,
  adherence: a,
  doneDates,
  isWorkout,
}: {
  plan: Plan;
  today: string;
  phase: PhaseStatus;
  adherence: Adherence | null;
  doneDates: ReadonlySet<string>;
  isWorkout: IsWorkout;
}) {
  const { t } = useT();
  const [info, setInfo] = useState(false);
  const short = (date: string) =>
    localizedDate(date, { day: "numeric", month: "short" }).replace(/\./g, "");
  const heading =
    phase.kind === "running"
      ? t("planStatus.weekPhase", {
          week: phase.week,
          weeks: phase.weeks,
          phase: phase.deloadNow
            ? t("planStatus.deloadPhase")
            : t("planStatus.buildPhase"),
        })
      : phase.kind === "upcoming"
        ? t("planStatus.startsIn", { count: phase.daysUntil })
        : t("plan.ended");
  const deloadWeek =
    phase.kind === "running"
      ? phase.deloadNow
        ? phase.week
        : (phase.nextDeload?.week ?? null)
      : null;
  const sub = deloadWeek
    ? t("planStatus.deloadEnds", {
        week: deloadWeek,
        date: short(plan.endDate),
      })
    : t("planStatus.ends", { date: short(plan.endDate) });
  const started = phase.kind !== "upcoming";
  return (
    <section
      className="card status-card plan-period-top"
      aria-labelledby="status-period"
    >
      <div className="status-head">
        <div>
          <h2 id="status-period">{heading}</h2>
          <p className="row-sub">{sub}</p>
        </div>
        {plan.paused && (
          <span className="stat-chip muted">{t("plan.paused")}</span>
        )}
      </div>
      <div className="plan-period-top-cal">
        <PlanPeriodCalendar
          start={plan.startDate}
          end={plan.endDate}
          label={t("plan.periodCalendar", { name: plan.name, period: heading })}
          cell={(date) => {
            const inside = date >= plan.startDate && date <= plan.endDate;
            const planned = inside && isWorkout(planDay(plan, date).cell);
            const trained = doneDates.has(date) && date <= today;
            return {
              trained,
              // Today stays planned (a dot inside the ring) until it is done.
              planned: planned && !trained && date >= today,
              today: date === today,
              deload: inside && !!phaseWeek(plan, date)?.deload,
            };
          }}
          labels={periodLabels(plan, today)}
          legend={
            deloadWeeks(plan).length
              ? ["done", "planned", "today", "deload"]
              : ["done", "planned", "today"]
          }
        />
      </div>
      {plan.paused && (
        <p className="status-note">{t("planStatus.pausedNote")}</p>
      )}
      {started && a && (
        <div className="plan-adherence">
          <div className="plan-adherence-head">
            <strong className="plan-adherence-count">
              {a.weeksFinished > 0
                ? t("planStatus.weeksFulfilled", {
                    done: a.weeksFulfilled,
                    count: a.weeksFinished,
                  })
                : t("planStatus.noWeekYet")}
            </strong>
            <span className="plan-adherence-status">
              {!plan.paused && (
                <span className="plan-status-word">{t(STATUS[a.status])}</span>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label={t("planStatus.infoLabel")}
                aria-haspopup="dialog"
                onClick={() => setInfo(true)}
              >
                <Info size={18} aria-hidden="true" />
              </button>
            </span>
          </div>
          <p className="row-sub plan-adherence-line">
            {t("planStatus.adherenceLine", {
              extras: a.extras,
              total: t("count.workout", { count: a.total }),
              matched: a.thisWeek?.matched ?? 0,
              planned: a.thisWeek?.planned ?? 0,
            })}
          </p>
        </div>
      )}
      <Sheet
        open={info}
        onClose={() => setInfo(false)}
        title={t("planStatus.infoTitle")}
      >
        <p className="plan-info-text">{t("planStatus.infoText")}</p>
        <button
          type="button"
          className="btn-primary btn-block"
          onClick={() => setInfo(false)}
        >
          {t("common.done")}
        </button>
      </Sheet>
    </section>
  );
}
