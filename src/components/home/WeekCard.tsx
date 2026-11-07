import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { WorkoutRecord } from "@/data/model";
import type { PlannedDay } from "@/data/plans";
import { isoWeek, localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { goalStreak, weekStrip, weekTotals } from "@/lib/week-summary";
import { useT } from "@/i18n/useT";
import DayCell from "@/components/items/DayCell";
import { useTipTarget } from "@/hooks/useTipTarget";

type Props = {
  /** Finished workouts, newest first. */
  completed: WorkoutRecord[];
  goal: number | null;
  day: string;
  planned: (date: string) => PlannedDay | null;
};

/**
 * This week on Train: "Week 45 · 2 of 3 workouts", a day cell per day (done,
 * today, planned) and the totals. The whole card is a link to History.
 */
export default function WeekCard({ completed, goal, day, planned }: Props) {
  const { t, language } = useT();
  const tipRef = useTipTarget<HTMLAnchorElement>("weekStrip", { tap: true });
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
  const summary = [
    t("home.weekLabel", { week: isoWeek(day) }),
    goal !== null
      ? t("home.goalProgress", { done: totals.workouts, goal })
      : countLabel(totals.workouts, "workout"),
  ].join(" · ");
  const totalsLine = totals.workouts
    ? [
        countLabel(totals.sets, "set"),
        totals.minutes > 0 && durationLabel(totals.minutes),
        week.streak >= 2 && t("home.streak", { count: week.streak }),
      ]
        .filter(Boolean)
        .join(" · ")
    : week.streak >= 2
      ? t("home.streak", { count: week.streak })
      : t("home.nothingThisWeek");
  return (
    <Link ref={tipRef} to="/history" className="card col-12 week-card">
      <span className="week-card-head">
        <span className={"week-card-title" + (goalMet ? " is-met" : "")}>
          {summary}
        </span>
        <ChevronRight className="chev" size={18} aria-hidden="true" />
      </span>
      <span className="week" aria-hidden="true">
        {week.days.map(({ entry, ...d }) => (
          <span key={d.date} className="day">
            <span>{d.label}</span>
            <DayCell
              size="week"
              trained={d.done}
              today={d.today}
              planned={entry !== null && entry.kind !== "rest"}
              count={d.count}
            >
              {d.day}
            </DayCell>
          </span>
        ))}
      </span>
      {/* Read as one link: the summary, each day, the totals, then where it goes. */}
      <span className="sr-only">
        {week.days
          .map(
            ({ entry, ...d }) =>
              localizedDate(d.date, { weekday: "long", day: "numeric" }) +
              (d.done ? t("home.dayDone") : "") +
              (d.today ? t("home.dayToday") : "") +
              (entry ? t("home.dayPlanned", { title: entry.title }) : ""),
          )
          .join("; ")}
        .{" "}
      </span>
      <span className="row-sub">{totalsLine}</span>
      <span className="sr-only">. {t("home.weekOpen")}</span>
    </Link>
  );
}
