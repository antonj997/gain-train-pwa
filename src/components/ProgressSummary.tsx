import { ChevronDown } from "lucide-react";
import { type RecordDoc, type Workout } from "@/data/model";
import {
  historyPeriod,
  improvementRate,
  metricChange,
  summarize,
} from "@/data/summary";
import { localizedDate } from "@/lib/dates";
import "@/styles/progress-summary.css";

export default function ProgressSummary({
  records,
  now,
}: {
  records: readonly RecordDoc[];
  now: string;
}) {
  const period = historyPeriod("", now);
  const completed = records.filter(
    (record) =>
      !record.deleted &&
      record.kind === "workout" &&
      (record.payload as Workout).status === "completed",
  );
  const workoutsIn = (start: string, end: string) =>
    completed
      .filter((record) => {
        const date = (record.payload as Workout).date;
        return date >= start && date <= end;
      })
      .map((record) => record.payload as Workout);
  const current = summarize(workoutsIn(period.start, period.end), period.days);
  const previous = summarize(
    workoutsIn(period.previousStart, period.previousEnd),
    period.previousDays,
  );
  const metrics = [
    {
      label: "Workouts / active week",
      value: current.perWeek,
      prior: previous.perWeek,
      decimals: 1,
    },
    {
      label: "Avg duration · min",
      value: current.duration,
      prior: previous.duration,
      decimals: 0,
    },
    {
      label: "Exercises improving",
      value: improvementRate(completed, period.start, period.end),
      prior: improvementRate(
        completed,
        period.previousStart,
        period.previousEnd,
      ),
      decimals: 0,
      suffix: "%",
    },
  ];
  return (
    <section className="progress-summary" aria-label="Last 30 days summary">
      <h2>Last 30 days</h2>
      <p className="small-note">
        <time dateTime={period.start}>{localizedDate(period.start)}</time> –{" "}
        <time dateTime={period.end}>{localizedDate(period.end)}</time>
      </p>
      <p className="small-note">
        Compared with{" "}
        <time dateTime={period.previousStart}>
          {localizedDate(period.previousStart)}
        </time>{" "}
        –{" "}
        <time dateTime={period.previousEnd}>
          {localizedDate(period.previousEnd)}
        </time>
        .
      </p>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {metric.value === null
                ? "—"
                : metric.value.toFixed(metric.decimals) + (metric.suffix ?? "")}
            </strong>
            <small>
              {metricChange(metric.value, metric.prior, metric.decimals)}
              {metric.suffix && metric.value !== null && metric.prior !== null
                ? " pp"
                : ""}
            </small>
          </div>
        ))}
      </div>
      <details className="period-summary">
        <summary className="session-summary">
          <strong>About these stats</strong>
          <ChevronDown size={18} />
        </summary>
        <p className="small-note">
          Active weeks are Monday–Sunday weeks with at least one workout in this
          period. Duration averages exclude sessions without a recorded
          duration. Exercises improving compares your latest working result with
          the last session before the period, or the first session within it.
          Only comparable load and measure count: estimated strength for
          weighted sets of 1–10 reps, otherwise reps or seconds at the same
          load. Plain bodyweight, added bodyweight and assisted sets are
          compared separately. A dash means there is not enough data. Percentage
          changes use percentage points (pp).
        </p>
      </details>
    </section>
  );
}
