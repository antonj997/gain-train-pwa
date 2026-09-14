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
import { TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { progressFor, baseline } from "@/data/analytics";
import { labelSet } from "@/data/model";
export default function Progress() {
  const { state } = useData();
  const [search, setSearch] = useState("");
  const items = progressFor(Object.values(state.records));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = [
    cutoff.getFullYear(),
    String(cutoff.getMonth() + 1).padStart(2, "0"),
    String(cutoff.getDate()).padStart(2, "0"),
  ].join("-");
  return (
    <div className="stack">
      <h1>Progress</h1>
      {items.length > 0 && (
        <input
          aria-label="Find exercise progress"
          placeholder="Find an exercise"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {items
        .filter((x) => x.name.toLowerCase().includes(search.toLowerCase()))
        .map((item) => {
          const latest = item.points.at(-1)!,
            previous = item.points.at(-2),
            base = baseline(item.points, cutoffDate);
          const weighted = item.points.every((p) => p.e1rm !== null);
          const points = item.points.map((p) => ({
            date: p.date,
            value: weighted ? p.e1rm : p.set.reps,
          }));
          return (
            <section className="progress-card" key={item.id}>
              <h2>{item.name}</h2>
              <div className="performance">
                <span className="eyebrow">LAST SESSION · {latest.date}</span>
                <strong>{labelSet(latest.set)}</strong>
                <p className="muted">
                  {previous
                    ? "Previous: " + labelSet(previous.set)
                    : "First session logged. A starting point to build on."}
                </p>
              </div>
              {points.length > 1 ? (
                <div
                  className="chart"
                  role="img"
                  aria-label={
                    item.name + " progress over " + points.length + " sessions"
                  }
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={points}
                      margin={{ top: 10, right: 15, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => d.slice(5)}
                        minTickGap={24}
                        tick={{ fill: "var(--soft)", fontSize: 12 }}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "var(--soft)", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                          borderRadius: 10,
                        }}
                        labelFormatter={(s) => String(s)}
                        formatter={(value) => [
                          Number(value).toFixed(weighted ? 1 : 0),
                          weighted ? "Estimated 1RM (kg)" : "Reps",
                        ]}
                      />
                      <Line
                        dataKey="value"
                        stroke="var(--blue)"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="small-note">
                  Your chart starts after your next session.
                </p>
              )}
              {weighted && (
                <p className="small-note">
                  Estimated strength (1RM)
                  {base !== null && latest.e1rm !== null
                    ? " · " +
                      (latest.e1rm - base >= 0 ? "+" : "") +
                      (latest.e1rm - base).toFixed(1) +
                      " kg vs 30 days ago"
                    : ""}
                  . Estimate uses sets of 1–10 reps.
                </p>
              )}
              {!weighted && (
                <p className="small-note">
                  Reps per best recorded set. Compare the same load type and
                  weight; assisted weight is not lifted weight.
                </p>
              )}
              <details>
                <summary>Session details</summary>
                {[...item.points].reverse().map((p, i) => (
                  <div className="history-set" key={i}>
                    <span>{p.date}</span>
                    <strong>{labelSet(p.set)}</strong>
                  </div>
                ))}
              </details>
            </section>
          );
        })}
      {!items.length && (
        <div className="empty-card">
          <TrendingUp size={30} />
          <h2>See every step forward</h2>
          <p>
            Finish a workout to see your first performance. Your next session
            gives you a comparison.
          </p>
          <Link className="primary" to="/">
            Start a workout
          </Link>
        </div>
      )}
    </div>
  );
}
