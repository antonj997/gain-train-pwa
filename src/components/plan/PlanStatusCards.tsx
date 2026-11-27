import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Play } from "lucide-react";
import GoalRing from "@/components/items/GoalRing";
import RoutineBadge from "@/components/items/RoutineBadge";
import { statusChip } from "@/components/goals/goal-status";
import { goalLiftText, goalTitle, type GoalItem } from "@/data/goals";
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
import {
  WEEK_HEAT,
  type MuscleSets,
  type PlanMuscleMap,
} from "@/data/muscle-map";
import { MUSCLES } from "@/data/muscles";
import MapLegend from "@/components/muscles/MapLegend";
import MuscleMap from "@/components/muscles/MuscleMap";
import { useMapFigure } from "@/hooks/useMapFigure";
import { weekMapFills } from "@/lib/muscle-figure";
import { addedLoadLabel } from "@/data/exercise-overview";
import type { GoalCardData } from "@/hooks/useGoals";
import { categoryLabel, muscleLabel } from "@/lib/catalogue-labels";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { exercisePath } from "@/lib/routes";
import { formatWeight } from "@/lib/units";
import { currentLocale, formatDecimal, type MessageKey } from "@/i18n";
import { useT } from "@/i18n/useT";
import { exerciseDisplayName } from "@/lib/exercise-name";

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

// The phase and adherence now live in PlanPeriodCard (v6 F2): the period
// calendar replaced the phase bar and the week grid.
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
                  <strong className="row-title">
                    {exerciseDisplayName(lift.exerciseId, lift.name)}
                  </strong>
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
                <strong className="row-title">
                  {exerciseDisplayName(lift.exerciseId, lift.name)}
                </strong>
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

/** The heat steps' labels: 0, under 5, 5–9, 10–14, 15–19, 20+. */
function heatLegend(t: ReturnType<typeof useT>["t"]) {
  return [
    { key: "0", colour: "var(--gt-map-off)", label: "0" },
    ...WEEK_HEAT.map((from, index) => {
      const next = WEEK_HEAT[index + 1];
      return {
        key: String(index + 1),
        colour: `var(--gt-heat-${index + 1})`,
        label:
          index === 0
            ? t("planStatus.heatUnder", { sets: next })
            : next === undefined
              ? `${from}+`
              : `${from}–${next - 1}`,
      };
    }),
  ];
}

/**
 * The plan week on the detailed map: each muscle in the heat step of its
 * hard sets, this week while the plan runs and the average week after it.
 */
function WeekMap({ map }: { map: PlanMuscleMap }) {
  const { t } = useT();
  const [figure] = useMapFigure();
  const sets: MuscleSets = (map.ended ? map.average : map.thisWeek) ?? {};
  const { fills, rank } = useMemo(
    () => weekMapFills((map.ended ? map.average : map.thisWeek) ?? {}),
    [map],
  );
  const trained = MUSCLES.filter((m) => sets[m])
    .map((m) => `${muscleLabel(m)} ${formatDecimal(sets[m]!)}`)
    .join(", ");
  const title = t(map.ended ? "planStatus.mapAverage" : "planStatus.mapWeek", {
    week: map.week,
    muscles: trained || t("planStatus.mapNone"),
  });
  return (
    <div className="muscle-map">
      <MuscleMap fills={fills} rank={rank} figure={figure} title={title} />
      <MapLegend
        items={heatLegend(t)}
        shape="square"
        unit={t("planStatus.mapUnit")}
      />
    </div>
  );
}

export function MuscleCard({
  muscle,
  map,
}: {
  muscle: PlanMuscleSets;
  /** The detailed map of the plan week, above the group bars. */
  map?: PlanMuscleMap | null;
}) {
  const { t } = useT();
  const { min, max } = WEEKLY_SET_GUIDE;
  const under = muscle.under.map(categoryLabel);
  // The bar is this week as it stands; the mark is the average of the
  // finished weeks. After the plan has ended only the average is left.
  const live = !muscle.ended;
  const hasAverage = muscle.weeks > 0;
  const short = muscle.short.slice(0, 3);
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
      {map && <WeekMap map={map} />}
      <p className="muscle-legend row-sub" aria-hidden="true">
        {live && (
          <span>
            <i className="muscle-key-fill" />
            {t("planStatus.muscleThisWeek", { week: muscle.week })}
          </span>
        )}
        {hasAverage && (
          <span>
            <i className="muscle-key-mark" />
            {t("planStatus.muscleAverage", { count: muscle.weeks })}
          </span>
        )}
      </p>
      <ul className="muscle-list">
        {muscle.rows.map((row) => {
          const group = categoryLabel(row.group);
          const shown = live ? row.thisWeek : (row.average ?? 0);
          const average =
            row.average === null ? null : formatDecimal(row.average);
          return (
            <li
              key={row.group}
              className="muscle-row"
              data-status={row.status}
              aria-label={
                live
                  ? t(
                      average === null
                        ? "planStatus.muscleRowWeek"
                        : "planStatus.muscleRow",
                      {
                        group,
                        week: formatDecimal(row.thisWeek),
                        average: average ?? "",
                      },
                    )
                  : t("muscle.row", {
                      group,
                      sets: average ?? "0",
                      status: t(`muscle.${row.status}`),
                    })
              }
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
                  data-reached={shown >= min || undefined}
                  style={{ width: pct(shown, muscle.scale) }}
                />
                {live && row.average !== null && (
                  <span
                    className="muscle-mark"
                    style={{ left: pct(row.average, muscle.scale) }}
                  />
                )}
              </span>
              <span className="muscle-value" aria-hidden="true">
                <strong>{formatDecimal(shown)}</strong>
                {live && average !== null && (
                  <small>
                    {t("planStatus.muscleAverageShort", { average })}
                  </small>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {live && short.length > 0 && (
        <p className="status-note">
          {t("planStatus.muscleLeft", {
            min,
            groups: listText(
              short.map(
                ({ group, left }) =>
                  `${categoryLabel(group)} ${formatDecimal(left)}`,
              ),
            ),
          })}
        </p>
      )}
      {under.length > 0 && (
        <p className="status-note">
          {t("planStatus.muscleUnder", {
            count: under.length,
            groups: listText(under),
          })}
        </p>
      )}
      {live && !hasAverage && (
        <p className="status-note">{t("planStatus.muscleFirstWeek")}</p>
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
          const lift = insight.strength;
          // A lift goal reads its smoothed strength; a bodyweight goal its pace.
          const chip = progress.met
            ? { key: "goals.reached" as MessageKey, tone: " done" }
            : lift
              ? statusChip[lift.trend.status]
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
                  {
                    value: formatWeight(
                      progress.current,
                      undefined,
                      lift ? 0 : 1,
                    ),
                  },
                );
          const sub = [
            now,
            !progress.met &&
              lift?.ready &&
              t("planStatus.goalReady", {
                lift: goalLiftText(goal, lift.body),
              }),
            !progress.met && lift?.checkin?.due && t("planStatus.goalCheckin"),
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
  exercises,
}: {
  date: string;
  today: string;
  tomorrow: string;
  title: string;
  sub: string;
  /** The routine's exercises, for its badge. */
  exercises?: readonly { exerciseId: string }[];
  starting: boolean;
  onStart: () => void;
}) {
  const { t } = useT();
  // "Nästa pass · i dag", "· i morgon" or "· lördag" (v6 F2).
  const when =
    date === today
      ? t("planStatus.today")
      : date === tomorrow
        ? t("planStatus.tomorrow")
        : localizedDate(date, { weekday: "long" });
  return (
    <section
      className="card status-card status-next-card"
      aria-labelledby="status-next"
    >
      <h2 id="status-next" className="status-next-when">
        {t("planStatus.nextWhen", { when })}
      </h2>
      <div className="status-next">
        {exercises && exercises.length > 0 && (
          <RoutineBadge exercises={exercises} />
        )}
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
