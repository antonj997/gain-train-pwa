import { memo, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import type { ExerciseProgress } from "@/data/analytics";
import { type RecordDoc } from "@/data/model";
import { completedWorkouts } from "@/data/selectors";
import {
  historyPeriod,
  improvementRate,
  metricChange,
  summarize,
} from "@/data/summary";
import { localizedDate } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";
import { formatKm } from "@/lib/cardio";
import { useT } from "@/i18n/useT";
import { formatFixed, t } from "@/i18n";

/** The change text with its unit, such as "↑ +1.2 t". Arrows only; messages stay as they are. */
const withUnit = (change: string, unit: string) =>
  /^[↑↓]/.test(change) ? `${change} ${unit}` : change;

type Props = {
  records: readonly RecordDoc[];
  /** `progressFor(records)`, computed once by the page. */
  progress: readonly ExerciseProgress[];
  now: string;
  /** A `historyPeriod` key: "4w", "3m" or "12m". */
  range: string;
};

/** The tiles' figures for a period and the one before it. */
function summaryFor({ records, progress, now, range }: Props) {
  const period = historyPeriod(range, now);
  const completed = completedWorkouts(records);
  const workoutsIn = (start: string, end: string) =>
    completed
      .map((record) => record.payload)
      .filter(({ date }) => date >= start && date <= end);
  const current = summarize(
    workoutsIn(period.start, period.end),
    period.days,
    now,
  );
  const previous = summarize(
    workoutsIn(period.previousStart, period.previousEnd),
    period.previousDays,
    now,
  );
  // Volume reads in tonnes once either period passes a tonne.
  const tonnes = Math.max(current.volume, previous.volume) >= 1000;
  const scale = tonnes ? 1000 : 1;
  const tiles = [
    {
      label: t("progress.perWeek"),
      value: current.perWeek === null ? "—" : formatFixed(current.perWeek, 1),
      change:
        current.perWeek !== null && previous.perWeek !== null
          ? t("progress.finishedWeeks", {
              change: metricChange(current.perWeek, previous.perWeek, 1),
            })
          : metricChange(current.perWeek, previous.perWeek, 1),
    },
    {
      label: t("progress.workingSets"),
      value: String(current.workingSets),
      change: metricChange(current.workingSets, previous.workingSets),
    },
    {
      label: t("progress.volume"),
      value: tonnes
        ? formatFixed(current.volume / scale, 1)
        : String(Math.round(current.volume)),
      unit: tonnes ? "t" : "kg",
      change: withUnit(
        metricChange(
          current.volume / scale,
          previous.volume / scale,
          tonnes ? 1 : 0,
        ),
        tonnes ? "t" : "kg",
      ),
    },
    {
      label: t("progress.timeTrained"),
      value: current.minutes ? durationLabel(current.minutes) : "—",
      change: withUnit(
        metricChange(current.minutes ?? 0, previous.minutes ?? 0),
        "min",
      ),
    },
  ];
  const improving = improvementRate(progress, period.start, period.end);
  return { period, current, previous, tiles, improving };
}

/**
 * Four tiles for a period, each against the period before it, and a note on
 * how they are worked out. Memoised: typing in the page's search box does not
 * recompute them.
 */
function ProgressSummary(props: Props) {
  const { records, progress, now, range } = props;
  const { language } = useT();
  const { period, current, previous, tiles, improving } = useMemo(
    () => summaryFor({ records, progress, now, range }),
    // The tiles' words follow the language too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, progress, now, range, language],
  );
  return (
    <section className="progress-summary" aria-label={t("progress.summary")}>
      <div className="tiles">
        {tiles.map((tile) => (
          <div className="card tile" key={tile.label}>
            <span className="row-sub">{tile.label}</span>
            <strong className="tile-value">
              {tile.value}
              {tile.unit && <span className="tile-unit"> {tile.unit}</span>}
            </strong>
            <small
              className={
                "tile-change" + (tile.change.startsWith("↑") ? " up" : " flat")
              }
            >
              {tile.change}
            </small>
          </div>
        ))}
      </div>
      {(current.cardioSec > 0 || previous.cardioSec > 0) && (
        <p className="row-sub">
          {t("progress.cardio")}{" "}
          <strong>
            {current.cardioSec ? durationLabel(current.cardioSec / 60) : "—"}
            {current.cardioM > 0 && ` · ${formatKm(current.cardioM)} km`}
            {current.cardioKcal > 0 && ` · ${current.cardioKcal} kcal`}
          </strong>{" "}
          ·{" "}
          {withUnit(
            metricChange(
              Math.round(current.cardioSec / 60),
              Math.round(previous.cardioSec / 60),
            ),
            "min",
          )}
        </p>
      )}
      <p className="row-sub">
        {current.duration === null
          ? t("progress.noDurations")
          : t("progress.averageWorkout", {
              duration: durationLabel(current.duration),
            })}
        {" · "}
        {improving === null
          ? t("progress.noCompare")
          : t("progress.improving", { percent: Math.round(improving) })}
      </p>
      <details className="period-summary">
        <summary className="session-summary">
          <strong>{t("progress.about")}</strong>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <p className="row-sub">
          <time dateTime={period.start}>{localizedDate(period.start)}</time> –{" "}
          <time dateTime={period.end}>{localizedDate(period.end)}</time>,{" "}
          {t("progress.comparedWithShort")}{" "}
          <time dateTime={period.previousStart}>
            {localizedDate(period.previousStart)}
          </time>{" "}
          –{" "}
          <time dateTime={period.previousEnd}>
            {localizedDate(period.previousEnd)}
          </time>
          . {t("progress.aboutText")}
        </p>
      </details>
    </section>
  );
}

export default memo(ProgressSummary);
