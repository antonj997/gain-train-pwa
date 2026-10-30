import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "@/contexts/useData";
import {
  cardioProgressFor,
  exerciseStats,
  progressFor,
  recentBests,
  sparklinePoints,
} from "@/data/analytics";
import { labelSet, today } from "@/data/model";
import { historyPeriod } from "@/data/summary";
import CardioProgressDetail from "@/components/CardioProgressDetail";
import ExerciseProgressDetail from "@/components/ExerciseProgressDetail";
import GoalsSection from "@/components/goals/GoalsSection";
import PageHeader from "@/components/PageHeader";
import ProgressSummary from "@/components/ProgressSummary";
import ListRow from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { daysAgo, localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { totalsLabel } from "@/lib/cardio";
import { useT } from "@/i18n/useT";

const periods = [
  { value: "4w", label: "progress.p4w", before: "progress.before4w" },
  { value: "3m", label: "progress.p3m", before: "progress.before3m" },
  { value: "12m", label: "progress.p12m", before: "progress.before12m" },
] as const;
type Period = (typeof periods)[number]["value"];

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
  const { t } = useT();
  const periodOptions: { value: Period; label: string }[] = periods.map(
    ({ value, label }) => ({ value, label: t(label) }),
  );
  const now = today();
  const records = useMemo(() => Object.values(state.records), [state.records]);
  // Recomputed only when the log changes, not while typing in the search box.
  const items = useMemo(() => progressFor(records), [records]);
  const period = historyPeriod(range, now);
  const cardioItems = useMemo(() => cardioProgressFor(records), [records]);
  // Strength and cardio exercises share one list, most trained first. A strength
  // row shows its best set; a cardio row shows its latest time and distance.
  const rows = useMemo(() => {
    const inPeriod = ({ date }: { date: string }) =>
      date >= period.start && date <= period.end;
    return [
      ...items.map((item) => {
        const stats = exerciseStats(item);
        return {
          id: item.id,
          name: item.name,
          sessions: item.points.filter(inPeriod).length,
          best: t("progress.best", { set: labelSet(stats.best.set) }),
          trend: stats.comparable.slice(-8).map(stats.valueOf),
        };
      }),
      ...cardioItems.map((item) => {
        const latest = item.sessions.at(-1)!;
        return {
          id: item.id,
          name: item.name,
          sessions: item.sessions.filter(inPeriod).length,
          best: t("progress.latest", { value: totalsLabel(latest) }),
          trend: item.sessions.slice(-8).map((x) => x.durationSec),
        };
      }),
    ]
      .filter((row) => row.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  }, [items, cardioItems, period.start, period.end, t]);
  const bests = useMemo(
    () => recentBests(items, period.start, period.end),
    [items, period.start, period.end],
  );
  const query = search.trim().toLocaleLowerCase();
  const shown = rows.filter((row) =>
    row.name.toLocaleLowerCase().includes(query),
  );
  const open = items.find((item) => item.id === openId);
  const openCardio = cardioItems.find((item) => item.id === openId);
  const hasData = items.length > 0 || cardioItems.length > 0;
  const before = periods.find((p) => p.value === range)!.before;
  return (
    <div className="page progress-page">
      <PageHeader
        eyebrow={
          hasData
            ? t("progress.comparedWith", { before: t(before) })
            : undefined
        }
        title={t("progress.title")}
      />
      <GoalsSection />
      {hasData && (
        <>
          <Segmented<Period>
            label={t("progress.period")}
            value={range}
            options={periodOptions}
            onChange={setRange}
          />
          <ProgressSummary
            records={records}
            progress={items}
            now={now}
            range={range}
          />
          {bests.length > 0 && (
            <section aria-labelledby="bests-heading">
              <div className="section-head">
                <h2 id="bests-heading">{t("progress.recentBests")}</h2>
              </div>
              <div className="best-grid">
                {bests.map((best) => (
                  <div className="card best-card" key={best.exerciseId}>
                    <span className="badge-new">{best.name}</span>
                    <strong>{labelSet(best.set)}</strong>
                    <time className="row-sub" dateTime={best.date}>
                      {best.date === now
                        ? t("common.todayCap")
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
              <h2 id="exercises-heading">{t("progress.exercises")}</h2>
              <span className="row-sub">{t("progress.mostTrained")}</span>
            </div>
            {rows.length > 0 && (
              <input
                aria-label={t("progress.find")}
                placeholder={t("progress.findPlaceholder")}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            {shown.length > 0 && (
              <div className="list">
                {shown.map((row) => (
                  <ListRow
                    key={row.id}
                    title={row.name}
                    sub={`${row.best} · ${countLabel(row.sessions, "session")}`}
                    trailing={<Sparkline values={row.trend} />}
                    chevron
                    onClick={() => setOpenId(row.id)}
                  />
                ))}
              </div>
            )}
            {rows.length === 0 && (
              <div className="card col-12" role="status">
                <h3 className="card-title">{t("progress.noSessions")}</h3>
                <p className="row-sub">{t("progress.longerPeriod")}</p>
              </div>
            )}
            {rows.length > 0 && shown.length === 0 && (
              <div className="card col-12" role="status">
                <h3 className="card-title">{t("progress.noMatch")}</h3>
                <p className="row-sub">{t("progress.noMatchText")}</p>
                <button className="btn-secondary" onClick={() => setSearch("")}>
                  {t("progress.clearSearch")}
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {!hasData && (
        <div className="empty-card">
          <TrendingUp size={30} />
          <h2>{t("progress.emptyTitle")}</h2>
          <p>{t("progress.emptyText")}</p>
          <Link className="btn-primary" to="/">
            {t("progress.startWorkout")}
          </Link>
        </div>
      )}
      <Sheet
        open={!!open || !!openCardio}
        onClose={() => setOpenId(null)}
        title={open?.name ?? openCardio?.name}
        description={t("progress.sheetDescription")}
        size="full"
      >
        {open && (
          <ExerciseProgressDetail
            item={open}
            cutoffDate={daysAgo(30)}
            records={records}
          />
        )}
        {openCardio && (
          <CardioProgressDetail item={openCardio} cutoffDate={daysAgo(30)} />
        )}
      </Sheet>
    </div>
  );
}
