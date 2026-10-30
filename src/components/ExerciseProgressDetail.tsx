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
  heaviestLift,
  type progressFor,
} from "@/data/analytics";
import { labelSet, type RecordDoc } from "@/data/model";
import { metricChange } from "@/data/summary";
import ListRow from "@/components/ui/ListRow";
import { localizedDate } from "@/lib/dates";
import { chartDomain, chartSessions } from "@/lib/progressPresentation";
import { historyPath } from "@/lib/routes";
import { formatFixed, t } from "@/i18n";

type Props = {
  item: ReturnType<typeof progressFor>[number];
  /** Sessions on or before this date count towards the 30-day baseline. */
  cutoffDate: string;
  /** Every record, to find the heaviest set ever lifted. */
  records: RecordDoc[];
};

/** The sheet body for one exercise: latest and best results, sessions and the chart. */
export default function ExerciseProgressDetail({
  item,
  cutoffDate,
  records,
}: Props) {
  const { latest, weighted, timed, comparable, valueOf, best } =
    exerciseStats(item);
  const unit = t(
    weighted
      ? "detail.unitKg"
      : timed
        ? "detail.unitSeconds"
        : "detail.unitReps",
  );
  const metricLabel = t(
    weighted
      ? "detail.metricKg"
      : timed
        ? "detail.metricSeconds"
        : "detail.metricReps",
  );
  const previous = comparable.at(-2);
  const latestValue = valueOf(latest);
  const bestValue = valueOf(best);
  const base = weighted ? baseline(comparable, cutoffDate) : null;
  const sessions = chartSessions(item.points);
  const points = sessions
    .filter((point) => comparableSets(point.set, latest.set))
    .map((point) => ({ ...point, value: valueOf(point) }));
  const decimals = weighted ? 1 : 0;
  const heaviest = heaviestLift(records, item.id);
  return (
    <div className="exercise-detail">
      <div className="card performance">
        <span className="performance-label">{t("detail.latestSet")}</span>
        <strong className="performance-value">{labelSet(latest.set)}</strong>
        <time className="row-sub" dateTime={latest.date}>
          {localizedDate(latest.date)}
        </time>
        <p className="row-sub">
          {previous ? (
            <>
              {t("detail.prior", { date: localizedDate(previous.date) })}{" "}
              <strong>{labelSet(previous.set)}</strong>
            </>
          ) : (
            t("detail.noPrior")
          )}
        </p>
      </div>
      <div className="tiles">
        <div className="card tile">
          <span className="row-sub">
            {t(
              weighted
                ? "detail.bestE1rm"
                : timed
                  ? "detail.bestDuration"
                  : "detail.bestReps",
            )}
          </span>
          <strong className="tile-value">
            {formatFixed(bestValue, decimals)} {unit}
          </strong>
          <small className="row-sub">
            {latestValue === bestValue
              ? t("detail.atBest")
              : t("detail.fromBest", {
                  value: formatFixed(bestValue - latestValue, decimals),
                  unit,
                })}
          </small>
        </div>
        <div className="card tile">
          <span className="row-sub">{t("detail.latestChange")}</span>
          <strong className="tile-value">
            {metricChange(
              latestValue,
              previous ? valueOf(previous) : null,
              decimals,
            )}
          </strong>
          <small className="row-sub">{t("detail.vsPrior", { unit })}</small>
        </div>
        <div className={"card tile" + (heaviest ? "" : " tile-wide")}>
          <span className="row-sub">{t("detail.sessions30")}</span>
          <strong className="tile-value">
            {item.points.filter((point) => point.date > cutoffDate).length}
          </strong>
          <small className="row-sub">
            {t("detail.total", { count: item.points.length })}
          </small>
        </div>
        {heaviest && (
          <div className="card tile">
            <span className="row-sub">{t("detail.heaviest")}</span>
            <strong className="tile-value tile-value-text">
              {labelSet(heaviest.set)}
            </strong>
            <time className="row-sub" dateTime={heaviest.date}>
              {localizedDate(heaviest.date)}
            </time>
          </div>
        )}
      </div>
      <p className="row-sub">
        {t("detail.bestResult", { date: localizedDate(best.date) })}{" "}
        <strong>{labelSet(best.set)}</strong>
      </p>
      {points.length > 1 ? (
        <>
          <div
            className="chart"
            role="img"
            aria-label={t("detail.chartLabel", {
              name: item.name,
              metric: metricLabel.toLocaleLowerCase(),
            })}
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
                    formatFixed(Number(value), decimals),
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
            {t("detail.chartNote", { metric: metricLabel })}
          </p>
        </>
      ) : (
        <p className="row-sub">{t("detail.chartLater")}</p>
      )}
      <section>
        <h3 className="group-title">{t("detail.recorded")}</h3>
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
            {t("detail.estimatedNote")}{" "}
            {base !== null
              ? t("detail.baseline", {
                  change: `${latestValue - base >= 0 ? "+" : ""}${formatFixed(latestValue - base, 1)}`,
                })
              : t("detail.noBaseline")}
          </>
        ) : timed ? (
          t("detail.timedNote")
        ) : (
          t("detail.repsNote")
        )}
      </p>
    </div>
  );
}
