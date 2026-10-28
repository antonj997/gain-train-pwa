import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  baseline,
  comparableSets,
  exerciseStats,
  type progressFor,
} from "@/data/analytics";
import { labelSet } from "@/data/model";
import { metricChange } from "@/data/summary";
import ListRow from "@/components/ui/ListRow";
import { localizedDate } from "@/lib/dates";
import { chartDomain, chartSessions } from "@/lib/progressPresentation";
import { historyPath } from "@/lib/routes";

type Props = {
  item: ReturnType<typeof progressFor>[number];
  /** Sessions on or before this date count towards the 30-day baseline. */
  cutoffDate: string;
};

/** The sheet body for one exercise: latest and best results, sessions and the chart. */
export default function ExerciseProgressDetail({ item, cutoffDate }: Props) {
  const { latest, weighted, timed, comparable, valueOf, best } =
    exerciseStats(item);
  const unit = weighted ? "kg" : timed ? "seconds" : "reps";
  const metricLabel = weighted
    ? "Estimated 1RM (kg)"
    : timed
      ? "Seconds"
      : "Reps";
  const previous = comparable.at(-2);
  const latestValue = valueOf(latest);
  const bestValue = valueOf(best);
  const base = weighted ? baseline(comparable, cutoffDate) : null;
  const sessions = chartSessions(item.points);
  const points = sessions
    .filter((point) => comparableSets(point.set, latest.set))
    .map((point) => ({ ...point, value: valueOf(point) }));
  const decimals = weighted ? 1 : 0;
  return (
    <div className="exercise-detail">
      <div className="card performance">
        <span className="performance-label">Latest working set</span>
        <strong className="performance-value">{labelSet(latest.set)}</strong>
        <time className="row-sub" dateTime={latest.date}>
          {localizedDate(latest.date)}
        </time>
        <p className="row-sub">
          {previous ? (
            <>
              Prior comparable · {localizedDate(previous.date)}:{" "}
              <strong>{labelSet(previous.set)}</strong>
            </>
          ) : (
            "No prior comparable working set yet."
          )}
        </p>
      </div>
      <div className="tiles">
        <div className="card tile">
          <span className="row-sub">
            {weighted ? "Best est. 1RM" : timed ? "Best duration" : "Best reps"}
          </span>
          <strong className="tile-value">
            {bestValue.toFixed(decimals)} {unit}
          </strong>
          <small className="row-sub">
            {latestValue === bestValue
              ? "At your best"
              : `${(bestValue - latestValue).toFixed(decimals)} ${unit} from best`}
          </small>
        </div>
        <div className="card tile">
          <span className="row-sub">Latest change</span>
          <strong className="tile-value">
            {metricChange(
              latestValue,
              previous ? valueOf(previous) : null,
              decimals,
            )}
          </strong>
          <small className="row-sub">{unit} · vs prior comparable</small>
        </div>
        <div className="card tile tile-wide">
          <span className="row-sub">Sessions · 30 days</span>
          <strong className="tile-value">
            {item.points.filter((point) => point.date > cutoffDate).length}
          </strong>
          <small className="row-sub">{item.points.length} total</small>
        </div>
      </div>
      <p className="row-sub">
        Best comparable working result · {localizedDate(best.date)}:{" "}
        <strong>{labelSet(best.set)}</strong>
      </p>
      {points.length > 1 ? (
        <>
          <div
            className="chart"
            role="img"
            aria-label={`${item.name}: ${metricLabel.toLowerCase()} by session. The vertical scale starts at zero; exact results are listed below.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 10, right: 15, left: -8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--gt-line)" />
                <XAxis
                  dataKey="label"
                  minTickGap={24}
                  tick={{ fill: "var(--gt-ink-2)", fontSize: 12 }}
                />
                <YAxis
                  domain={chartDomain(points.map((point) => point.value))}
                  allowDecimals={weighted}
                  tick={{ fill: "var(--gt-ink-2)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--gt-surface)",
                    color: "var(--gt-ink)",
                    border: "1px solid var(--gt-line)",
                    borderRadius: 8,
                  }}
                  labelFormatter={(_, payload) =>
                    payload[0]?.payload.fullLabel ?? ""
                  }
                  formatter={(value) => [
                    Number(value).toFixed(decimals),
                    metricLabel,
                  ]}
                />
                <Line
                  dataKey="value"
                  name={metricLabel}
                  stroke="var(--gt-accent)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="row-sub">
            {metricLabel} · scale starts at zero. Same-day sessions use their
            recorded order.
          </p>
        </>
      ) : (
        <p className="row-sub">
          Your chart starts after your next comparable session.
        </p>
      )}
      <section>
        <h3 className="group-title">Recorded sessions</h3>
        <div className="list">
          {[...sessions].reverse().map((point) => (
            <ListRow
              key={point.workoutId}
              to={historyPath(point.workoutId)}
              title={point.fullLabel}
              value={<strong>{labelSet(point.set)}</strong>}
              chevron
            />
          ))}
        </div>
      </section>
      <p className="row-sub">
        {weighted ? (
          <>
            Estimated strength uses working sets of 1–10 reps.
            {base !== null
              ? ` ${latestValue - base >= 0 ? "+" : ""}${(latestValue - base).toFixed(1)} kg vs the baseline at least 30 days ago.`
              : " No comparable baseline from 30 days ago yet."}
          </>
        ) : timed ? (
          "Working-set duration in seconds at the same load as your latest session."
        ) : (
          "Working-set reps at the same load as your latest session. Assisted weight is assistance, not lifted weight."
        )}
      </p>
    </div>
  );
}
