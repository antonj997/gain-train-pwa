import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { WorkoutRecord } from "@/data/model";
import type { PlannedDay } from "@/data/plans";
import { localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { goalStreak, weekStrip, weekTotals } from "@/lib/week-summary";
import { useT } from "@/i18n/useT";

type Props = {
  /** Finished workouts, newest first. */
  completed: WorkoutRecord[];
  goal: number | null;
  day: string;
  planned: (date: string) => PlannedDay | null;
};

/** "This week": the goal chip, a dot per day (done, today, planned) and the totals. */
export default function WeekCard({ completed, goal, day, planned }: Props) {
  const { t, language } = useT();
  const week = useMemo(() => {
    const dates = completed.map((r) => r.payload.date);
    const days = weekStrip(dates, day);
    return {
      // The plan is resolved once per day here, not on every render.
      days: days.map((d) => ({ ...d, entry: planned(d.date) })),
      totals: weekTotals(
        completed.map((r) => r.payload),
        day,
      ),
      streak: goalStreak(dates, goal, day),
    };
    // The weekday letters follow the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, goal, day, planned, language]);
  const { totals } = week;
  const goalMet = goal !== null && totals.workouts >= goal;
  return (
    <section className="card col-12" aria-labelledby="week-heading">
      <div className="card-head">
        <h2 id="week-heading">{t("home.thisWeek")}</h2>
        <span className="card-head-end">
          <span className={"stat-chip" + (goalMet ? " done" : "")}>
            {goal !== null
              ? t("home.goalProgress", { done: totals.workouts, goal })
              : countLabel(totals.workouts, "workout")}
          </span>
          <Link className="text-link" to="/library?tab=plan">
            {t("home.plan")}
          </Link>
        </span>
      </div>
      <ol className="week">
        {week.days.map(({ entry, ...d }) => {
          const outlined = entry !== null && entry.kind !== "rest";
          return (
            <li
              key={d.date}
              className="day"
              aria-label={
                localizedDate(d.date, { weekday: "long", day: "numeric" }) +
                (d.done ? t("home.dayDone") : "") +
                (d.today ? t("home.dayToday") : "") +
                (entry ? t("home.dayPlanned", { title: entry.title }) : "")
              }
            >
              <span aria-hidden="true">{d.label}</span>
              <span
                className={
                  "dot" +
                  (d.done ? " done" : "") +
                  (d.today ? " today" : "") +
                  (outlined ? " planned" : "")
                }
                aria-hidden="true"
              >
                {d.day}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="row-sub">
        {totals.workouts
          ? [
              countLabel(totals.sets, "set"),
              totals.minutes > 0 && durationLabel(totals.minutes),
              week.streak >= 2 && t("home.streak", { count: week.streak }),
            ]
              .filter(Boolean)
              .join(" · ")
          : week.streak >= 2
            ? t("home.streak", { count: week.streak })
            : t("home.nothingThisWeek")}
      </p>
    </section>
  );
}
