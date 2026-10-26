import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { metricChange } from "@/data/summary";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/useData";
import { progressFor, baseline, comparableSets } from "@/data/analytics";
import { labelSet, today } from "@/data/model";
import ProgressSummary from "@/components/ProgressSummary";
import { localizedDate } from "@/lib/dates";
import { chartDomain, chartSessions } from "@/lib/progressPresentation";

export default function Progress() {
  const { state } = useData();
  const [search, setSearch] = useState("");
  const records = Object.values(state.records);
  const items = progressFor(records);
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = [
    cutoff.getFullYear(),
    String(cutoff.getMonth() + 1).padStart(2, "0"),
    String(cutoff.getDate()).padStart(2, "0"),
  ].join("-");
  return (
    <div className="stack progress-page">
      <h1>Progress</h1>
      <ProgressSummary records={records} now={today()} />
      {items.length > 0 && (
        <input
          aria-label="Find exercise progress"
          placeholder="Find an exercise"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      {filtered.map((item) => {
        const latest = item.points.at(-1)!;
        const weighted = latest.e1rm !== null;
        const timed = latest.set.measure === "seconds";
        const unit = weighted ? "kg" : timed ? "seconds" : "reps";
        const metricLabel = weighted
          ? "Estimated 1RM (kg)"
          : timed
            ? "Seconds"
            : "Reps";
        const comparable = item.points.filter((point) =>
          comparableSets(point.set, latest.set),
        );
        const previous = comparable.at(-2);
        const valueOf = (point: typeof latest) =>
          weighted ? point.e1rm! : point.set.reps!;
        const latestValue = valueOf(latest);
        const bestPoint = comparable.reduce(
          (best, point) => (valueOf(point) >= valueOf(best) ? point : best),
          latest,
        );
        const best = valueOf(bestPoint);
        const base = weighted ? baseline(comparable, cutoffDate) : null;
        const sessions = chartSessions(item.points);
        const points = sessions
          .filter((point) => comparableSets(point.set, latest.set))
          .map((point) => ({ ...point, value: valueOf(point) }));
        return (
          <section className="progress-card" key={item.id}>
            <h2>{item.name}</h2>
            <div className="performance">
              <div className="best-working-set">
                <span className="performance-label">Best working set</span>
                <strong>{labelSet(latest.set)}</strong>
              </div>
              <time dateTime={latest.date}>{localizedDate(latest.date)}</time>
            </div>
            <p className="previous-performance muted">
              {previous ? (
                <>
                  Prior comparable · {localizedDate(previous.date)}:{" "}
                  <strong>{labelSet(previous.set)}</strong>
                </>
              ) : (
                "No prior comparable working set yet."
              )}
            </p>
            <details>
              <summary className="session-summary">
                Details & sessions
                <ChevronDown size={18} />
              </summary>
              <div className="progress-details stack">
                <h3>Recorded sessions</h3>
                {[...sessions].reverse().map((point) => (
                  <Link
                    to={"/history?workout=" + point.workoutId}
                    className="history-set progress-session"
                    key={point.workoutId}
                  >
                    <span>{point.fullLabel}</span>
                    <strong>{labelSet(point.set)}</strong>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                ))}
                <div className="metrics-grid progress-metrics">
                  <div className="metric">
                    <span>
                      {weighted
                        ? "Best est. 1RM"
                        : timed
                          ? "Best duration"
                          : "Best reps"}
                    </span>
                    <strong>
                      {best.toFixed(weighted ? 1 : 0)} {unit}
                    </strong>
                    <small>
                      {latestValue === best
                        ? "At your best"
                        : `${(best - latestValue).toFixed(weighted ? 1 : 0)} ${unit} from best`}
                    </small>
                  </div>
                  <div className="metric">
                    <span>Latest change</span>
                    <strong>
                      {metricChange(
                        latestValue,
                        previous ? valueOf(previous) : null,
                        weighted ? 1 : 0,
                      )}
                    </strong>
                    <small>{unit} · vs prior comparable</small>
                  </div>
                  <div className="metric">
                    <span>Sessions · 30 days</span>
                    <strong>
                      {
                        item.points.filter((point) => point.date > cutoffDate)
                          .length
                      }
                    </strong>
                    <small>{item.points.length} total</small>
                  </div>
                </div>
                <p className="small-note">
                  Best comparable working result ·{" "}
                  {localizedDate(bestPoint.date)}:{" "}
                  <strong>{labelSet(bestPoint.set)}</strong>
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
                          <CartesianGrid
                            vertical={false}
                            stroke="var(--line)"
                          />
                          <XAxis
                            dataKey="label"
                            minTickGap={24}
                            tick={{ fill: "var(--soft)", fontSize: 12 }}
                          />
                          <YAxis
                            domain={chartDomain(
                              points.map((point) => point.value),
                            )}
                            allowDecimals={weighted}
                            tick={{ fill: "var(--soft)", fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--surface)",
                              color: "var(--ink)",
                              border: "1px solid var(--line)",
                              borderRadius: 8,
                            }}
                            labelFormatter={(_, payload) =>
                              payload[0]?.payload.fullLabel ?? ""
                            }
                            formatter={(value) => [
                              Number(value).toFixed(weighted ? 1 : 0),
                              metricLabel,
                            ]}
                          />
                          <Line
                            dataKey="value"
                            name={metricLabel}
                            stroke="var(--blue)"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="small-note">
                      {metricLabel} · scale starts at zero. Same-day sessions
                      use their recorded order.
                    </p>
                  </>
                ) : (
                  <p className="small-note">
                    Your chart starts after your next comparable session.
                  </p>
                )}
                <p className="small-note">
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
            </details>
          </section>
        );
      })}
      {items.length > 0 && filtered.length === 0 && (
        <div className="empty-card" role="status">
          <h2>No matching exercises</h2>
          <p>
            Try another name or clear your search to see all recorded progress.
          </p>
          <button className="secondary" onClick={() => setSearch("")}>
            Clear search
          </button>
        </div>
      )}
      {!items.length && (
        <div className="empty-card">
          <TrendingUp size={30} />
          <h2>Your working sets will appear here</h2>
          <p>
            Finish a workout with a working set to see an exact result. Another
            comparable session gives you a comparison.
          </p>
          <Link className="primary" to="/">
            Start a workout
          </Link>
        </div>
      )}
    </div>
  );
}
