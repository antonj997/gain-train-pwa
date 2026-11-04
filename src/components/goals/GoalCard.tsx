import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Sparkline from "@/components/Sparkline";
import { goalTitle } from "@/data/goals";
import { today } from "@/data/model";
import type { GoalCardData } from "@/hooks/useGoals";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { exercisePath } from "@/lib/routes";
import type { Deadline, Pace } from "@/lib/goal-pace";
import { type MessageKey, formatDecimal } from "@/i18n";
import { formatWeight, getWeightUnit, weightTotal } from "@/lib/units";
import { useT } from "@/i18n/useT";

const kg = (value: number) => formatWeight(value, getWeightUnit(), 1);
/** A signed weekly rate in the language: "+0.8", "−0,6". */
const signed = (value: number) => {
  const rounded = Number(value.toFixed(1));
  if (rounded === 0) return formatDecimal(0);
  return (rounded > 0 ? "+" : "−") + formatDecimal(Math.abs(rounded));
};

const paceChip: Record<Pace["kind"], { key: MessageKey; tone: string }> = {
  ahead: { key: "goals.ahead", tone: " done" },
  "on-track": { key: "goals.onTrack", tone: " done" },
  behind: { key: "goals.behind", tone: " warm" },
  unknown: { key: "goals.noTrend", tone: " muted" },
};

/**
 * One open goal: title, pace, bar, start → now → target, time left and a
 * sparkline. The card opens the goal's editor; a lift goal's exercise name is
 * a second link, to the exercise page.
 */
export default function GoalCard({
  card,
  onOpen,
}: {
  card: GoalCardData;
  onOpen: () => void;
}) {
  const { t } = useT();
  const { goal, insight } = card;
  const { progress, pace, projected, perDay } = insight;
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
  const chip = pace ? paceChip[pace.kind] : null;
  const values = insight.sinceStart.map((p) => p.value);
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
      <span
        className="goal-bar"
        role="progressbar"
        aria-label={t("goals.progressLabel", { title })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.fraction * 100)}
      >
        <span style={{ width: `${progress.fraction * 100}%` }} />
      </span>
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
      {progress.current === null && (
        <span className="row-sub">
          {goal.kind === "bodyweight"
            ? t("goals.addBodyweight")
            : t("goals.noSets")}
        </span>
      )}
      {progress.unit === "kg e1RM" && (
        <span className="row-sub">{t("goals.e1rmNote")}</span>
      )}
      <span
        className={
          "row-sub goal-due" +
          (insight.deadline.kind === "overdue" ? " is-late" : "")
        }
      >
        {due(insight.deadline)}
      </span>
      {pace && pace.kind !== "unknown" && perDay !== null && (
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
          {t("goals.projected", {
            date: localizedDate(projected, {
              day: "numeric",
              month: "short",
              ...(projected.slice(0, 4) !== today().slice(0, 4)
                ? { year: "numeric" }
                : {}),
            }),
          })}
        </span>
      )}
      {goal.kind === "lift" && goal.exerciseId && (
        <Link className="goal-exercise-link" to={exercisePath(goal.exerciseId)}>
          {goal.exerciseName ?? t("goals.lift")}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
