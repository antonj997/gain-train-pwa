import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import GoalRing from "@/components/items/GoalRing";
import { goalTitle } from "@/data/goals";
import type { GoalCardData } from "@/hooks/useGoals";
import type { WeeklyGoalStats } from "@/lib/week-summary";
import { useT } from "@/i18n/useT";

/**
 * Progress's goals at a glance: a sideways strip of goal rings, the weekly
 * goal first, then the open goals by the nearest date. Each ring opens the
 * Goals subscreen; with no goal yet, one tile invites you to add one there.
 */
export default function GoalStrip({
  weekly,
  open,
}: {
  weekly: WeeklyGoalStats | null;
  open: GoalCardData[];
}) {
  const { t } = useT();
  if (!weekly && !open.length)
    return (
      <Link to="/progress/goals" className="card goal-add-tile">
        <span className="goal-add-ring" aria-hidden="true">
          <Plus size={22} />
        </span>
        <span className="goal-add-text">
          <strong>{t("goals.add")}</strong>
          <span className="row-sub">{t("progress.addGoalText")}</span>
        </span>
      </Link>
    );
  return (
    <ul className="goal-strip">
      {weekly && (
        <li>
          <Link
            to="/progress/goals"
            className="goal-tile"
            aria-label={t("progress.goalOpen", {
              title: t("goals.weeklyTitle"),
              value: t("home.goalProgress", {
                done: weekly.done,
                goal: weekly.goal,
              }),
            })}
          >
            <GoalRing
              fraction={Math.min(1, weekly.done / weekly.goal)}
              done={weekly.done >= weekly.goal}
              label={t("goals.weekProgressLabel")}
              value={{
                now: Math.min(weekly.done, weekly.goal),
                max: weekly.goal,
                text: t("home.goalProgress", {
                  done: weekly.done,
                  goal: weekly.goal,
                }),
              }}
            >
              {weekly.done}/{weekly.goal}
            </GoalRing>
            <span className="goal-tile-title">{t("goals.weeklyTitle")}</span>
            <span className="goal-tile-sub">
              {weekly.streak > 0
                ? t("progress.streak", { count: weekly.streak })
                : t("progress.weekLeft", { count: weekly.daysLeft })}
            </span>
          </Link>
        </li>
      )}
      {open.map(({ goal, insight }) => {
        const title = goalTitle(goal);
        const percent = Math.round(insight.progress.fraction * 100);
        const behind = insight.pace?.kind === "behind";
        const due = insight.deadline;
        return (
          <li key={goal.id}>
            <Link
              to="/progress/goals"
              className="goal-tile"
              aria-label={t("progress.goalOpen", {
                title,
                value: `${percent}%`,
              })}
            >
              <GoalRing
                fraction={insight.progress.fraction}
                label={t("goals.progressLabel", { title })}
              >
                {percent}%
              </GoalRing>
              <span className="goal-tile-title">{title}</span>
              <span className={"goal-tile-sub" + (behind ? " is-behind" : "")}>
                {behind
                  ? t("goals.behind")
                  : due.kind === "left"
                    ? t("progress.daysLeft", { count: due.days })
                    : due.kind === "today"
                      ? t("progress.dueToday")
                      : t("progress.overdue")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
