import { CalendarCheck, ChevronRight } from "lucide-react";
import { localizedDate } from "@/lib/dates";
import type { WeeklyGoalStats } from "@/lib/week-summary";
import { useT } from "@/i18n/useT";

/** Bars over the goal line: the line sits a quarter below the top unless a week passes it. */
function WeekStrip({ stats }: { stats: WeeklyGoalStats }) {
  const { t } = useT();
  const { series, goal } = stats;
  const top = Math.max(
    Math.ceil(goal * 1.25),
    ...series.map((w) => w.workouts),
  );
  return (
    <div className="week-strip-wrap">
      <div className="week-strip" aria-hidden="true">
        <span
          className="week-strip-goal"
          style={{ bottom: `${(goal / top) * 100}%` }}
        />
        {series.map((week) => (
          <span
            key={week.start}
            className={
              "week-strip-bar" +
              (week.met ? " is-met" : week.current ? " is-current" : "") +
              (week.tracked ? "" : " is-untracked")
            }
            style={{ height: `${(week.workouts / top) * 100}%` }}
          />
        ))}
      </div>
      <div className="week-strip-axis" aria-hidden="true">
        <span>
          {localizedDate(series[0].start, { day: "numeric", month: "short" })}
        </span>
        <span>{t("goals.stripThisWeek")}</span>
      </div>
      <p className="sr-only">
        {t("goals.stripSummary", {
          count: series.length,
          list: series.map((w) => w.workouts).join(", "),
          goal,
        })}
      </p>
    </div>
  );
}

/**
 * The weekly training goal: this week against it, the hit rate over the last
 * 4 and 12 finished weeks, the streak and a 12-week strip. Without a goal, a
 * short card that sets one.
 */
export default function WeeklyGoalCard({
  stats,
  onEdit,
}: {
  stats: WeeklyGoalStats | null;
  onEdit: () => void;
}) {
  const { t } = useT();
  if (!stats)
    return (
      <button
        type="button"
        className="card goal-card weekly-empty"
        onClick={onEdit}
      >
        <span className="card-head">
          <span className="weekly-empty-title">
            <CalendarCheck size={20} aria-hidden="true" />
            <strong className="card-title">{t("settings.setGoal")}</strong>
          </span>
          <ChevronRight size={20} aria-hidden="true" className="chev" />
        </span>
        <span className="row-sub">{t("goals.setWeeklyText")}</span>
      </button>
    );

  const { goal, done, daysLeft, last4, last12, streak, best } = stats;
  const met = done >= goal;
  const weeks = (count: number) => t("goals.weeks", { count });
  return (
    <section className="card weekly-card" aria-labelledby="weekly-heading">
      <div className="card-head">
        <div>
          <h2 id="weekly-heading">{t("goals.weeklyTitle")}</h2>
          <p className="row-sub">
            {t("goals.weeklyTarget", {
              count: goal,
              unit: t("settings.perWeekUnit", { count: goal }),
            })}
          </p>
        </div>
        <button type="button" className="text-link" onClick={onEdit}>
          <span aria-hidden="true">{t("common.edit")}</span>
          <span className="sr-only">{t("goals.editWeekly")}</span>
        </button>
      </div>
      <div className="weekly-now">
        <div className="weekly-now-head">
          <strong>{t("home.goalProgress", { done, goal })}</strong>
          <span className={"stat-chip" + (met ? " done" : "")}>
            {met
              ? t("goals.weekMet")
              : t("goals.weekDaysLeft", { count: daysLeft })}
          </span>
        </div>
        <span
          className={"goal-bar" + (met ? " is-done" : "")}
          role="progressbar"
          aria-label={t("goals.weekProgressLabel")}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(done, goal)}
          aria-valuetext={t("home.goalProgress", { done, goal })}
        >
          <span style={{ width: `${Math.min(1, done / goal) * 100}%` }} />
        </span>
      </div>
      <WeekStrip stats={stats} />
      <ul className="weekly-facts">
        <li>
          {last4.of === 0
            ? t("goals.hitRateNone")
            : t("goals.hitRate", { met: last4.met, count: last4.of }) +
              (last12.of > last4.of
                ? " · " +
                  t("goals.hitRateMore", { met: last12.met, of: last12.of })
                : "")}
        </li>
        {(streak > 0 || best > 0) && (
          <li>
            {t("goals.streakLine", {
              current: weeks(streak),
              best: weeks(best),
            })}
          </li>
        )}
      </ul>
    </section>
  );
}
