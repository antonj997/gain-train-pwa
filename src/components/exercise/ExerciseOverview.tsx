import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { DoneSetValue } from "@/components/DoneSetList";
import { setBadge } from "@/data/drops";
import type { RecordDoc } from "@/data/model";
import type { ExerciseSession } from "@/data/exercise-records";
import {
  chartSeries,
  defaultMetric,
  deltaText,
  mainWorkingSets,
  nextTarget,
  overviewRecords,
  overviewStats,
  pointCaption,
  setDeltas,
  strengthBodyweight,
  targetText,
  trendVerdict,
  type Metric,
  type Overview,
  type OverviewKind,
} from "@/data/exercise-overview";
import { localizedDate } from "@/lib/dates";
import { local, storageKeys, writeStored } from "@/lib/storage";
import { formatWeight, getWeightUnit, type WeightUnit } from "@/lib/units";
import { formatFixed, t, type MessageKey } from "@/i18n";
import TrendChart from "./TrendChart";

type Props = {
  exerciseId: string;
  name: string;
  overview: Overview;
  /** The exercise's sessions, newest first. */
  sessions: readonly ExerciseSession[];
  records: RecordDoc[];
  today: string;
  /** Opens the Records tab. */
  onAllRecords: () => void;
  /** The exercise's weight unit (useWeightUnits); the default otherwise. */
  weightUnit?: WeightUnit;
};

const shortDate = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short" });

const METRIC_LABEL: Record<Metric, MessageKey> = {
  top: "overview.metricTop",
  e1rm: "overview.metricE1rm",
  volume: "overview.metricVolume",
  total: "overview.metricReps",
  best: "overview.metricBest",
};
const metricLabel = (metric: Metric, kind: OverviewKind) =>
  t(
    metric === "total" && kind === "reps"
      ? "overview.metricRepsPerSession"
      : metric === "total" && kind === "timed"
        ? "overview.metricTimePerSession"
        : METRIC_LABEL[metric],
  );

function storedMetric(exerciseId: string, metrics: readonly Metric[]) {
  try {
    const saved = local.getItem(storageKeys.exerciseMetric(exerciseId));
    return metrics.find((metric) => metric === saved) ?? null;
  } catch {
    return null;
  }
}

/**
 * The exercise page's Overview for a strength exercise: the latest session's
 * working sets against the session before with the next target, the trend
 * (a verdict, a chart per metric and three stats) and the headline records.
 */
export default function ExerciseOverview({
  exerciseId,
  name,
  overview,
  sessions,
  records,
  today,
  onAllRecords,
  weightUnit,
}: Props) {
  const { kind, metrics } = overview;
  const unit = weightUnit ?? getWeightUnit();
  const latest = overview.sessions.at(-1)!;
  const previous = overview.sessions.at(-2) ?? null;
  const [metric, setMetric] = useState<Metric>(
    () => storedMetric(exerciseId, metrics) ?? defaultMetric(kind),
  );
  const shown = metrics.includes(metric) ? metric : defaultMetric(kind);
  const points = useMemo(
    () => chartSeries(overview.sessions, shown, unit),
    [overview.sessions, shown, unit],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const found = points.findIndex((point) => point.workoutId === picked);
  const selected = found >= 0 ? found : points.length - 1;
  const point = points[selected];

  const target = useMemo(
    () => nextTarget(records, exerciseId, latest.top.id, unit),
    [records, exerciseId, latest.top.id, unit],
  );
  const stats = overviewStats(sessions, today);
  const best = overviewRecords(overview, sessions, unit);
  const bodyKg = kind === "bodyweight" ? strengthBodyweight(overview) : null;

  const choose = (next: Metric) => {
    setMetric(next);
    writeStored(storageKeys.exerciseMetric(exerciseId), next);
  };

  // The latest session's working sets, drops under their set; deltas by set.
  const working = latest.working;
  const deltas = setDeltas(working, previous?.working ?? null);
  const standing = mainWorkingSets(working);

  return (
    <div className="exercise-overview">
      <section className="card overview-card" aria-labelledby="overview-latest">
        <div className="overview-head">
          <h2 id="overview-latest">
            {t("overview.latest", { date: shortDate(latest.date) })}
          </h2>
          {previous && (
            <span>
              {t("overview.against", { date: shortDate(previous.date) })}
            </span>
          )}
        </div>
        <ol className="done-list overview-sets">
          {working.map((set, index) => {
            const badge = setBadge(working, index);
            const at = standing.indexOf(set);
            const delta = at >= 0 ? deltas[at] : null;
            const tone = delta
              ? delta.kind === "more" || delta.kind === "heavier"
                ? "up"
                : delta.kind === "same"
                  ? "same"
                  : "down"
              : null;
            return (
              <li
                key={set.id}
                className={
                  "done-row" + (badge.tone === "drop" ? " is-drop" : "")
                }
              >
                <span className="set-badge" data-tone={badge.tone}>
                  <span className="set-badge-chip" aria-hidden="true">
                    {badge.text}
                  </span>
                  <span className="sr-only">{badge.name}</span>
                </span>
                <DoneSetValue set={set} weightUnit={unit} />
                {delta && (
                  <span className={"set-delta " + tone}>
                    <span aria-hidden="true">
                      {tone === "up" ? "↑" : tone === "down" ? "↓" : "="}
                    </span>
                    {deltaText(delta)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {target && (
          <p className="next-target">
            <span>{t("overview.nextTarget")}</span>
            <strong>{targetText(target.target, target.last, unit)}</strong>
          </p>
        )}
      </section>

      <section
        className="card overview-card"
        aria-labelledby="overview-verdict"
      >
        <h2 className="trend-verdict" id="overview-verdict">
          {trendVerdict(overview, unit)}
        </h2>
        {overview.sessions.length > 1 && metrics.length > 1 && (
          <div
            className="metric-chips"
            role="group"
            aria-label={t("overview.metrics")}
          >
            {metrics.map((option) => (
              <button
                key={option}
                type="button"
                className="metric-chip"
                aria-pressed={option === shown}
                onClick={() => choose(option)}
              >
                {metricLabel(option, kind)}
              </button>
            ))}
          </div>
        )}
        {overview.sessions.length > 1 && point ? (
          <>
            <TrendChart
              points={points}
              kind={kind}
              metric={shown}
              unit={unit}
              selected={selected}
              onSelect={(index) => setPicked(points[index].workoutId)}
              label={t("overview.chartLabel", {
                name,
                metric: metricLabel(shown, kind).toLocaleLowerCase(),
                count: points.length,
              })}
            />
            <p className="trend-caption" aria-live="polite">
              <strong>{shortDate(point.date)}</strong> ·{" "}
              {pointCaption(point, kind, shown, unit)}
            </p>
          </>
        ) : (
          <p className="row-sub">{t("overview.chartLater")}</p>
        )}
        <ul className="overview-stats">
          <li>
            <strong>{stats.last30}</strong>
            <span>{t("overview.stat30", { count: stats.last30 })}</span>
          </li>
          <li>
            <strong>{formatFixed(stats.setsPerWeek, 1)}</strong>
            <span>{t("overview.statSetsWeek")}</span>
          </li>
          <li>
            <strong>{stats.total}</strong>
            <span>{t("overview.statTotal", { count: stats.total })}</span>
          </li>
        </ul>
      </section>

      {best.length > 0 && (
        <section
          className="card overview-card"
          aria-labelledby="overview-records"
        >
          <div className="overview-head">
            <h2 id="overview-records">{t("exercise.records")}</h2>
            <button
              type="button"
              className="overview-more"
              onClick={onAllRecords}
            >
              {t("overview.allRecords")}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <dl className="overview-records">
            {best.map((row) => (
              <div key={row.key}>
                <dt>{row.title}</dt>
                <dd>
                  <span className="overview-record-value">
                    <strong>{row.value}</strong>
                    {row.pill && (
                      <span className="stat-chip warm">
                        {t("records.short.heaviest")}
                      </span>
                    )}
                  </span>
                  {row.sub && <small>{row.sub}</small>}
                  <time dateTime={row.date}>{shortDate(row.date)}</time>
                </dd>
              </div>
            ))}
          </dl>
          {bodyKg !== null && best.some((row) => row.key === "e1rm") && (
            <p className="overview-note">
              {t("overview.bodyNote", { weight: formatWeight(bodyKg, unit) })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
