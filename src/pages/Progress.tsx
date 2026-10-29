import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/useData";
import {
  exerciseStats,
  progressFor,
  recentBests,
  sparklinePoints,
} from "@/data/analytics";
import { labelSet, today } from "@/data/model";
import { historyPeriod } from "@/data/summary";
import ExerciseProgressDetail from "@/components/ExerciseProgressDetail";
import PageHeader from "@/components/PageHeader";
import ProgressSummary from "@/components/ProgressSummary";
import ListRow from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { daysAgo, localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";

const periods = [
  { value: "4w", label: "4 weeks", before: "the 4 weeks before" },
  { value: "3m", label: "3 months", before: "the 3 months before" },
  { value: "12m", label: "Year", before: "the year before" },
] as const;
type Period = (typeof periods)[number]["value"];
const periodOptions: { value: Period; label: string }[] = periods.map(
  ({ value, label }) => ({ value, label }),
);

/** A 64×28 trend line with no axes; the row text carries the numbers. */
function Sparkline({ values }: { values: number[] }) {
  return (
    <svg
      className="sparkline"
      width="64"
      height="28"
      viewBox="0 0 64 28"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={sparklinePoints(values)}
        fill="none"
        stroke="var(--gt-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Progress() {
  const { state } = useData();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Period>("4w");
  const [openId, setOpenId] = useState<string | null>(null);
  const now = today();
  const records = useMemo(() => Object.values(state.records), [state.records]);
  // Recomputed only when the log changes, not while typing in the search box.
  const items = useMemo(() => progressFor(records), [records]);
  const period = historyPeriod(range, now);
  const rows = useMemo(
    () =>
      items
        .map((item) => ({
          item,
          stats: exerciseStats(item),
          sessions: item.points.filter(
            ({ date }) => date >= period.start && date <= period.end,
          ).length,
        }))
        .filter((row) => row.sessions > 0)
        .sort(
          (a, b) =>
            b.sessions - a.sessions || a.item.name.localeCompare(b.item.name),
        ),
    [items, period.start, period.end],
  );
  const bests = useMemo(
    () => recentBests(records, period.start, period.end),
    [records, period.start, period.end],
  );
  const query = search.trim().toLowerCase();
  const shown = rows.filter((row) =>
    row.item.name.toLowerCase().includes(query),
  );
  const open = items.find((item) => item.id === openId);
  const before = periods.find((p) => p.value === range)!.before;
  return (
    <div className="page progress-page">
      <PageHeader
        eyebrow={items.length ? `Compared with ${before}` : undefined}
        title="Progress"
      />
      {items.length > 0 && (
        <>
          <Segmented<Period>
            label="Period"
            value={range}
            options={periodOptions}
            onChange={setRange}
          />
          <ProgressSummary records={records} now={now} range={range} />
          {bests.length > 0 && (
            <section aria-labelledby="bests-heading">
              <div className="section-head">
                <h2 id="bests-heading">Recent bests</h2>
              </div>
              <div className="best-grid">
                {bests.map((best) => (
                  <div className="card best-card" key={best.exerciseId}>
                    <span className="badge-new">{best.name}</span>
                    <strong>{labelSet(best.set)}</strong>
                    <time className="row-sub" dateTime={best.date}>
                      {best.date === now
                        ? "Today"
                        : localizedDate(best.date, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                    </time>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section aria-labelledby="exercises-heading">
            <div className="section-head">
              <h2 id="exercises-heading">Exercises</h2>
              <span className="row-sub">Most trained first</span>
            </div>
            {rows.length > 0 && (
              <input
                aria-label="Find exercise progress"
                placeholder="Find an exercise"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            {shown.length > 0 && (
              <div className="list">
                {shown.map(({ item, stats, sessions }) => (
                  <ListRow
                    key={item.id}
                    title={item.name}
                    sub={`Best ${labelSet(stats.best.set)} · ${countLabel(sessions, "session")}`}
                    trailing={
                      <Sparkline
                        values={stats.comparable.slice(-8).map(stats.valueOf)}
                      />
                    }
                    chevron
                    onClick={() => setOpenId(item.id)}
                  />
                ))}
              </div>
            )}
            {rows.length === 0 && (
              <div className="card col-12" role="status">
                <h3 className="card-title">No sessions in this period</h3>
                <p className="row-sub">
                  Pick a longer period to see earlier exercises.
                </p>
              </div>
            )}
            {rows.length > 0 && shown.length === 0 && (
              <div className="card col-12" role="status">
                <h3 className="card-title">No matching exercises</h3>
                <p className="row-sub">
                  Try another name or clear your search to see all recorded
                  progress.
                </p>
                <button className="btn-secondary" onClick={() => setSearch("")}>
                  Clear search
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {!items.length && (
        <div className="empty-card">
          <TrendingUp size={30} />
          <h2>Your working sets will appear here</h2>
          <p>
            Finish a workout with a working set to see an exact result. Another
            comparable session gives you a comparison.
          </p>
          <Link className="btn-primary" to="/">
            Start a workout
          </Link>
        </div>
      )}
      <Sheet
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.name}
        description="Results, sessions and chart"
        size="full"
      >
        {open && (
          <ExerciseProgressDetail item={open} cutoffDate={daysAgo(30)} />
        )}
      </Sheet>
    </div>
  );
}
