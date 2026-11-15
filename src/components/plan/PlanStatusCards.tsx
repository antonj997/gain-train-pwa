import { Link } from "react-router-dom";
import { ChevronRight, Play } from "lucide-react";
import GoalRing from "@/components/items/GoalRing";
import PhaseBar from "@/components/items/PhaseBar";
import { goalTitle, type GoalItem } from "@/data/goals";
import type { Plan } from "@/data/model";
import { deloadOf, phaseSegments } from "@/data/phase";
import {
  startNowText,
  type Adherence,
  type DayState,
  type LiftStatus,
  type OtherLift,
  type PhaseStatus,
  type PlanLift,
  type PlanMuscleSets,
} from "@/data/plan-status";
import { WEEKLY_SET_GUIDE } from "@/data/muscle-sets";
import { addedLoadLabel } from "@/data/exercise-overview";
import type { GoalCardData } from "@/hooks/useGoals";
import { categoryLabel } from "@/lib/catalogue-labels";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { exercisePath } from "@/lib/routes";
import { formatWeight } from "@/lib/units";
import { currentLocale, formatDecimal, type MessageKey } from "@/i18n";
import { useT } from "@/i18n/useT";

/*
 * The cards of a plan's status page (pages/PlanStatus.tsx), top to bottom:
 * the phase, adherence, progression against the plan, weekly sets per muscle
 * group, the plan's goals and the next workout. Each gets its numbers from
 * src/data/plan-status.ts and only formats them.
 */

const pct = (value: number, scale: number) =>
  `${Math.min(100, Math.max(0, (value / scale) * 100))}%`;

/** "Shoulders and Arms", "Legs, Shoulders and Arms" in the app's language. */
const listText = (items: string[]) =>
  new Intl.ListFormat(currentLocale(), {
    style: "long",
    type: "conjunction",
  }).format(items);

// ---------------------------------------------------------------- Phase

export function PhaseCard({
  plan,
  status,
  today,
}: {
  plan: Plan;
  status: PhaseStatus;
  today: string;
}) {
  const { t } = useT();
  const { loadPct, setsPct } = deloadOf(plan);
  const rule = t("planStatus.deloadRule", {
    load: loadPct
      ? t("planStatus.deloadLoad", { pct: loadPct })
      : t("planStatus.deloadSameLoad"),
    sets:
      setsPct === 50
        ? t("planStatus.deloadHalfSets")
        : setsPct >= 100
          ? t("planStatus.deloadAllSets")
          : t("planStatus.deloadSetsKept", { pct: setsPct }),
  });
  const heading =
    status.kind === "running"
      ? t("plan.weekOf", { week: status.week, weeks: status.weeks })
      : status.kind === "upcoming"
        ? t("planStatus.startsIn", { count: status.daysUntil })
        : t("plan.ended");
  const aside =
    status.kind === "running"
      ? status.daysLeft > 0
        ? t("planStatus.daysLeft", { count: status.daysLeft })
        : t("planStatus.lastDay")
      : countLabel(status.weeks, "week");
  let deload = "";
  if (status.kind === "running" && !plan.paused) {
    if (status.deloadNow) deload = t("planStatus.deloadNow", { rule });
    else if (status.nextDeload)
      deload = t("planStatus.deloadNext", {
        week: status.nextDeload.week,
        days: countLabel(status.nextDeload.inDays, "day"),
        rule,
      });
  }
  return (
    <section className="card status-card" aria-labelledby="status-phase">
      <div className="status-head">
        <h2 id="status-phase">{heading}</h2>
        {plan.paused ? (
          <span className="stat-chip muted">{t("plan.paused")}</span>
        ) : (
          <span className="row-sub">{aside}</span>
        )}
      </div>
      <PhaseBar segments={phaseSegments(plan, today)} tall />
      {plan.paused && (
        <p className="status-note">{t("planStatus.pausedNote")}</p>
      )}
      {deload && <p className="status-note">{deload}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- Adherence

const BAND: Record<
  NonNullable<Adherence["band"]>,
  { key: MessageKey; tone: string }
> = {
  good: { key: "planStatus.adherenceGood", tone: " done" },
  behind: { key: "planStatus.adherenceBehind", tone: " warm" },
  off: { key: "planStatus.adherenceOff", tone: " warm" },
};
const SR_STATE: Record<DayState, MessageKey> = {
  done: "planStatus.srDone",
  missed: "planStatus.srMissed",
  upcoming: "planStatus.srUpcoming",
  future: "planStatus.srFuture",
  paused: "planStatus.srPaused",
};
const STATE_ORDER: DayState[] = [
  "done",
  "missed",
  "upcoming",
  "future",
  "paused",
];

export function AdherenceCard({
  adherence: a,
  paused,
}: {
  adherence: Adherence;
  paused: boolean;
}) {
  const { t } = useT();
  const band = a.band ? BAND[a.band] : null;
  const changes = [
    a.moved > 0 && t("planStatus.moved", { count: a.moved }),
    a.skipped > 0 && t("planStatus.skipped", { count: a.skipped }),
  ]
    .filter(Boolean)
    .join(" · ");
  const weekText = (days: Adherence["weeks"][number]["days"]) => {
    if (!days.length) return t("plan.nothingPlanned");
    return STATE_ORDER.flatMap((state) => {
      const count = days.filter((d) => d.state === state).length;
      return count ? [t(SR_STATE[state], { count })] : [];
    }).join(", ");
  };
  return (
    <section className="card status-card" aria-labelledby="status-adherence">
      <div className="status-head">
        <h2 id="status-adherence">{t("planStatus.adherence")}</h2>
        {band && !paused && (
          <span className={"stat-chip" + band.tone}>{t(band.key)}</span>
        )}
        {paused && <span className="stat-chip muted">{t("plan.paused")}</span>}
      </div>
      {a.percent === null ? (
        <p className="row-sub">{t("planStatus.nothingYet")}</p>
      ) : (
        <p className="status-big">
          <strong>{t("planStatus.percent", { pct: a.percent })}</strong>
          <span>
            {t("planStatus.doneOf", { done: a.done, planned: a.planned })}
          </span>
        </p>
      )}
      <div
        className="adherence-weeks"
        style={{
          gridTemplateColumns: `repeat(${a.weeks.length}, minmax(0, 1fr))`,
        }}
        aria-hidden="true"
      >
        {a.weeks.map((w) => (
          <span key={w.week} className="adherence-week">
            {w.days.map((d) => (
              <span
                key={d.date}
                className="adherence-day"
                data-state={d.state}
              />
            ))}
          </span>
        ))}
      </div>
      <ul className="sr-only" aria-label={t("planStatus.weeksLabel")}>
        {a.weeks.map((w) => (
          <li key={w.week}>
            {t("planStatus.weekSr", { week: w.week, text: weekText(w.days) })}
          </li>
        ))}
      </ul>
      <ul className="adherence-legend" aria-hidden="true">
        <li>
          <span className="adherence-day" data-state="done" />
          {t("planStatus.legendDone")}
        </li>
        <li>
          <span className="adherence-day" data-state="missed" />
          {t("planStatus.legendMissed")}
        </li>
        <li>
          <span className="adherence-day" data-state="upcoming" />
          {t("planStatus.legendUpcoming")}
        </li>
      </ul>
      {changes && (
        <p className="status-note">{t("planStatus.notMissed", { changes })}</p>
      )}
      {a.band === "off" && !paused && (
        <p className="status-note">{t("planStatus.adherenceOffTip")}</p>
      )}
      {paused && <p className="status-note">{t("planStatus.pausedCount")}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- Progression

const LIFT_CHIP: Record<LiftStatus, { key: MessageKey; tone: string }> = {
  ahead: { key: "planStatus.ahead", tone: " done" },
  on: { key: "planStatus.onTrack", tone: " done" },
  behind: { key: "planStatus.behind", tone: " warm" },
};

/** A weight or a set on one line, so a row wraps between them. */
const unbroken = (text: string) => text.replace(/ /g, "\u00a0");

export function ProgressionCard({
  lifts,
  others,
  bodyweight,
}: {
  lifts: PlanLift[];
  others: OtherLift[];
  /** Whether a progression lift is a bodyweight lift, so its weights read "BW + 10 kg". */
  bodyweight: (lift: PlanLift) => boolean;
}) {
  const { t } = useT();
  const load = (lift: PlanLift, kg: number) =>
    bodyweight(lift) ? addedLoadLabel(kg) : formatWeight(kg);
  return (
    <section className="card status-card" aria-labelledby="status-progression">
      <div className="status-head">
        <h2 id="status-progression">{t("planStatus.progression")}</h2>
        <span className="row-sub">{t("planStatus.progressionHint")}</span>
      </div>
      <ul className="status-rows">
        {lifts.map((lift) => {
          const chip = lift.status ? LIFT_CHIP[lift.status] : null;
          const start =
            lift.start ??
            unbroken(`${load(lift, lift.startKg)} × ${lift.reps}`);
          return (
            <li key={lift.exerciseId}>
              <Link className="status-lift" to={exercisePath(lift.exerciseId)}>
                <span className="status-lift-text">
                  <strong className="row-title">{lift.name}</strong>
                  <span className="row-sub">
                    {startNowText(start, lift.now, t("planStatus.noSession"))}
                    {" · "}
                    {t("planStatus.planned", {
                      value: unbroken(load(lift, lift.plannedKg)),
                    })}
                  </span>
                </span>
                {chip && (
                  <span className={"stat-chip" + chip.tone}>{t(chip.key)}</span>
                )}
                <ChevronRight className="chev" size={18} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
        {others.map((lift) => (
          <li key={lift.exerciseId}>
            <Link className="status-lift" to={exercisePath(lift.exerciseId)}>
              <span className="status-lift-text">
                <strong className="row-title">{lift.name}</strong>
                <span className="row-sub">
                  {startNowText(lift.start, lift.now, "")}
                </span>
              </span>
              <span className="stat-chip muted">{t("planStatus.noPlan")}</span>
              <ChevronRight className="chev" size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Volume

export function MuscleCard({ muscle }: { muscle: PlanMuscleSets }) {
  const { t } = useT();
  const { min, max } = WEEKLY_SET_GUIDE;
  const under = muscle.under.map(categoryLabel);
  return (
    <section
      className="card status-card muscle-sets"
      aria-labelledby="status-muscle"
    >
      <div className="status-head">
        <h2 id="status-muscle">{t("planStatus.muscle")}</h2>
        <span className="row-sub">
          {t("planStatus.muscleHint", { min, max })}
        </span>
      </div>
      <ul className="muscle-list">
        {muscle.rows.map((row) => {
          const group = categoryLabel(row.group);
          const sets = formatDecimal(row.sets);
          return (
            <li
              key={row.group}
              className="muscle-row"
              data-status={row.status}
              aria-label={t("muscle.row", {
                group,
                sets,
                status: t(`muscle.${row.status}`),
              })}
            >
              <span className="muscle-name" aria-hidden="true">
                {group}
              </span>
              <span className="muscle-track" aria-hidden="true">
                <span
                  className="muscle-guide"
                  style={{
                    left: pct(min, muscle.scale),
                    width: `calc(${pct(max, muscle.scale)} - ${pct(min, muscle.scale)})`,
                  }}
                />
                <span
                  className="muscle-fill"
                  style={{ width: pct(row.sets, muscle.scale) }}
                />
              </span>
              <strong className="muscle-value" aria-hidden="true">
                {sets}
              </strong>
            </li>
          );
        })}
      </ul>
      {under.length > 0 && (
        <p className="status-note">
          {t("planStatus.muscleUnder", {
            count: under.length,
            groups: listText(under),
          })}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Goals

const PACE: Record<string, { key: MessageKey; tone: string }> = {
  ahead: { key: "goals.ahead", tone: " done" },
  "on-track": { key: "goals.onTrack", tone: " done" },
  behind: { key: "goals.behind", tone: " warm" },
  unknown: { key: "goals.noTrend", tone: " muted" },
};

export function GoalsCard({
  goals,
  today,
  onOpen,
}: {
  goals: GoalCardData[];
  today: string;
  onOpen: (goal: GoalItem) => void;
}) {
  const { t } = useT();
  return (
    <section className="card status-card" aria-labelledby="status-goals">
      <div className="status-head">
        <h2 id="status-goals">{t("planStatus.goals")}</h2>
      </div>
      <ul className="status-rows">
        {goals.map(({ goal, insight }) => {
          const title = goalTitle(goal);
          const { progress, pace, projected } = insight;
          const chip = progress.met
            ? { key: "goals.reached" as MessageKey, tone: " done" }
            : pace
              ? PACE[pace.kind]
              : null;
          const now =
            progress.current === null
              ? null
              : t(
                  progress.unit === "kg e1RM"
                    ? "planStatus.goalNowE1rm"
                    : "planStatus.goalNow",
                  { value: formatWeight(progress.current, undefined, 1) },
                );
          const sub = [
            now,
            projected &&
              !progress.met &&
              insight.deadline.kind !== "overdue" &&
              t("planStatus.goalAround", {
                date: localizedDate(projected, {
                  day: "numeric",
                  month: "short",
                  ...(projected.slice(0, 4) !== today.slice(0, 4)
                    ? { year: "numeric" }
                    : {}),
                }),
              }),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={goal.id}>
              <button
                type="button"
                className="status-goal"
                onClick={() => onOpen(goal)}
              >
                <GoalRing
                  size={44}
                  fraction={progress.fraction}
                  done={progress.met}
                  label={t("goals.progressLabel", { title })}
                >
                  {Math.round(progress.fraction * 100)}%
                </GoalRing>
                <span className="status-lift-text">
                  <strong className="row-title">{title}</strong>
                  {sub && <span className="row-sub">{sub}</span>}
                </span>
                {chip && (
                  <span className={"stat-chip" + chip.tone}>{t(chip.key)}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Next workout

export function NextWorkoutCard({
  date,
  today,
  tomorrow,
  title,
  sub,
  starting,
  onStart,
}: {
  date: string;
  today: string;
  tomorrow: string;
  title: string;
  sub: string;
  starting: boolean;
  onStart: () => void;
}) {
  const { t } = useT();
  const day = localizedDate(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const when =
    date === today
      ? t("planStatus.when", { when: t("planStatus.today"), date: day })
      : date === tomorrow
        ? t("planStatus.when", { when: t("planStatus.tomorrow"), date: day })
        : day;
  return (
    <section className="card status-card" aria-labelledby="status-next">
      <div className="status-head">
        <h2 id="status-next">{t("planStatus.next")}</h2>
        <span className="row-sub">{when}</span>
      </div>
      <div className="status-next">
        <span className="status-lift-text">
          <strong className="row-title">{title}</strong>
          {sub && <span className="row-sub">{sub}</span>}
        </span>
        <button
          type="button"
          className="status-play"
          aria-label={t("planStatus.startNext", { name: title })}
          disabled={starting}
          onClick={onStart}
        >
          <Play
            size={20}
            fill="currentColor"
            stroke="none"
            aria-hidden="true"
          />
        </button>
      </div>
    </section>
  );
}
