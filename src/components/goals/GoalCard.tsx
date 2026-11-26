import GoalRing from "@/components/items/GoalRing";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Sparkline from "@/components/Sparkline";
import { goalExerciseName, goalLiftText, goalTitle } from "@/data/goals";
import { goalTargetLabel } from "@/data/goal-targets";
import { statusChip } from "@/components/goals/goal-status";
import { today } from "@/data/model";
import type { GoalCardData } from "@/hooks/useGoals";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { exercisePath } from "@/lib/routes";
import { shortSetText } from "@/lib/set-target";
import type { Deadline, Pace } from "@/lib/goal-pace";
import { type MessageKey, formatDecimal } from "@/i18n";
import { formatWeight, getWeightUnit, weightTotal } from "@/lib/units";
import { useT } from "@/i18n/useT";

const kg = (value: number) => formatWeight(value, getWeightUnit(), 1);
/** Strength is an estimate: whole kilograms (or pounds) say enough. */
const roundKg = (value: number) => formatWeight(value, getWeightUnit(), 0);
/** A signed weekly rate in the language: "+0.8", "−0,6". */
const signed = (value: number) => {
  const rounded = Number(value.toFixed(1));
  if (rounded === 0) return formatDecimal(0);
  return (rounded > 0 ? "+" : "−") + formatDecimal(Math.abs(rounded));
};
const shortDate = (date: string) =>
  localizedDate(date, {
    day: "numeric",
    month: "short",
    ...(date.slice(0, 4) !== today().slice(0, 4) ? { year: "numeric" } : {}),
  });

const paceChip: Record<Pace["kind"], { key: MessageKey; tone: string }> = {
  ahead: { key: "goals.ahead", tone: " done" },
  "on-track": { key: "goals.onTrack", tone: " done" },
  behind: { key: "goals.behind", tone: " warm" },
  unknown: { key: "goals.noTrend", tone: " muted" },
};

/**
 * One open goal: title, status, bar, start → now → target, time left and a
 * sparkline. A lift goal reads strength (estimated 1RM): "now" names the set
 * it comes from, and the card says when to test the real lift or that a
 * check-in is due this week (with Skip). The card opens the goal's editor; a
 * lift goal's exercise name is a second link, to the exercise page.
 */
export default function GoalCard({
  card,
  onOpen,
  onSkipCheckin,
}: {
  card: GoalCardData;
  onOpen: () => void;
  /** Skips this week's check-in; without it there is no Skip button. */
  onSkipCheckin?: (week: string) => void;
}) {
  const { t } = useT();
  const { goal, insight } = card;
  const { progress, pace, projected, perDay } = insight;
  const lift = insight.strength;
  const title = goalTitle(goal);
  const rate = (value: string) => t("goals.rate", { kg: value });
  const due = (d: Deadline) =>
    d.kind === "left"
      ? t("goals.daysLeftBy", {
          days: countLabel(d.days, "day"),
          date: localizedDate(goal.byDate, { day: "numeric", month: "short" }),
        })
      : d.kind === "today"
        ? t("goals.dueToday")
        : t("goals.overdue", { days: countLabel(d.days, "day") });
  const chip = lift
    ? statusChip[lift.trend.status]
    : pace
      ? paceChip[pace.kind]
      : null;
  const values = insight.sinceStart.map((p) => p.value);
  const approx = (value: number) => t("goals.approx", { kg: roundKg(value) });
  const checkinDue = lift?.checkin?.due ?? null;
  const lastCheckin = lift?.checkin?.last ?? null;
  // A one-rep target is the weight itself; more reps are an estimate.
  const exactTarget = !lift || (!goal.estimated && (goal.reps ?? 1) === 1);
  return (
    <div className="card goal-card">
      <span className="card-head">
        <button
          type="button"
          className="card-title goal-card-open"
          onClick={onOpen}
        >
          {title}
        </button>
        {chip && <span className={"stat-chip" + chip.tone}>{t(chip.key)}</span>}
      </span>
      <span className="goal-main">
        <GoalRing
          fraction={progress.fraction}
          label={t("goals.progressLabel", { title })}
        >
          {Math.round(progress.fraction * 100)}%
        </GoalRing>
        {lift ? (
          // Strength: now, with the set it comes from, over start and target.
          <span className="goal-lift-values">
            <span className="goal-values">
              <span className="goal-value">
                <span className="goal-value-label">{t("goals.nowLabel")}</span>
                <strong className="goal-now">
                  {progress.current === null
                    ? t("goals.noValue")
                    : t("goals.nowStrength", {
                        kg: roundKg(progress.current),
                      })}
                </strong>
                {progress.source && (
                  <span className="goal-value-sub">
                    {t("goals.sourceLine", {
                      set: shortSetText(
                        progress.source.set,
                        progress.source.set,
                      ),
                      date: shortDate(progress.source.date),
                    })}
                  </span>
                )}
              </span>
              {values.length >= 2 && <Sparkline values={values} />}
            </span>
            <span className="goal-range">
              <span>
                <span className="goal-value-label">{t("goals.start")}</span>{" "}
                {progress.start <= 0
                  ? t("goals.noValue")
                  : approx(progress.start)}
              </span>
              <span>
                <span className="goal-value-label">
                  {t("goals.targetLabel")}
                </span>{" "}
                {exactTarget ? kg(progress.target) : approx(progress.target)}
              </span>
            </span>
          </span>
        ) : (
          <span className="goal-values">
            <span className="goal-value">
              <span className="goal-value-label">{t("goals.start")}</span>
              <span>
                {progress.start > 0 ? kg(progress.start) : t("goals.noValue")}
              </span>
            </span>
            <span className="goal-value">
              <span className="goal-value-label">{t("goals.nowLabel")}</span>
              <strong>
                {progress.current === null
                  ? t("goals.noValue")
                  : kg(progress.current)}
              </strong>
            </span>
            <span className="goal-value">
              <span className="goal-value-label">{t("goals.targetLabel")}</span>
              <span>{kg(progress.target)}</span>
            </span>
            {values.length >= 2 && <Sparkline values={values} />}
          </span>
        )}
      </span>
      {progress.current === null && (
        <span className="row-sub">
          {goal.kind === "bodyweight" || (lift?.body && !lift.checkin)
            ? t("goals.addBodyweight")
            : t("goals.noSets")}
        </span>
      )}
      {lift?.ready && (
        <span className="goal-ready">
          {t("goals.ready", { lift: goalLiftText(goal, lift.body) })}
        </span>
      )}
      {lift && checkinDue && lift.checkin && (
        <span className="goal-checkin">
          <span className="goal-checkin-text">
            <strong>
              {t("goals.checkinDue", {
                set: goalTargetLabel({
                  kind: "checkin",
                  goalId: goal.id,
                  weight: lift.checkin.load,
                  reps: null,
                  body: lift.body,
                }),
              })}
            </strong>
            <span className="row-sub">
              {t("goals.checkinHow", {
                name: goalExerciseName(goal),
              })}
            </span>
          </span>
          {onSkipCheckin && (
            <button
              type="button"
              className="goal-checkin-skip"
              aria-label={t("goals.checkinSkipLabel", { title })}
              onClick={() => onSkipCheckin(checkinDue.week)}
            >
              {t("goals.checkinSkip")}
            </button>
          )}
        </span>
      )}
      {lastCheckin && (
        <span className="row-sub">
          {t("goals.checkinLast", {
            kg: roundKg(lastCheckin.value),
            date: shortDate(lastCheckin.date),
          })}
        </span>
      )}
      <span
        className={
          "row-sub goal-due" +
          (insight.deadline.kind === "overdue" ? " is-late" : "")
        }
      >
        {due(insight.deadline)}
      </span>
      {lift?.pace && (
        <span className="row-sub">
          {t(lift.pace === "on" ? "goals.paceOn" : "goals.paceOff")}
        </span>
      )}
      {!lift && pace && pace.kind !== "unknown" && perDay !== null && (
        <span className="row-sub">
          {t(
            pace.kind === "behind" ? "goals.behindDetail" : "goals.paceDetail",
            {
              needed: rate(kg(pace.needed)),
              trend: rate(
                `${signed(weightTotal(perDay * 7))} ${getWeightUnit()}`,
              ),
            },
          )}
        </span>
      )}
      {projected && insight.deadline.kind !== "overdue" && (
        <span className="row-sub">
          {t("goals.projected", { date: shortDate(projected) })}
        </span>
      )}
      {lift && (
        <span className="row-sub goal-note">
          {t("goals.strengthNote", { lift: goalLiftText(goal, lift.body) })}
        </span>
      )}
      {goal.kind === "lift" && goal.exerciseId && (
        <Link className="goal-exercise-link" to={exercisePath(goal.exerciseId)}>
          {goalExerciseName(goal)}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
