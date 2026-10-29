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
      label: "Workouts / week",
      value: current.perWeek === null ? "—" : current.perWeek.toFixed(1),
      change:
        metricChange(current.perWeek, previous.perWeek, 1) +
        (current.perWeek !== null && previous.perWeek !== null
          ? " · finished weeks"
          : ""),
    },
    {
      label: "Working sets",
      value: String(current.workingSets),
      change: metricChange(current.workingSets, previous.workingSets),
    },
    {
      label: "Volume",
      value: tonnes
        ? (current.volume / scale).toFixed(1)
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
      label: "Time trained",
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
  const { period, current, previous, tiles, improving } = useMemo(
    () => summaryFor({ records, progress, now, range }),
    [records, progress, now, range],
  );
  return (
    <section className="progress-summary" aria-label="Summary">
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
          Cardio{" "}
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
          ? "No recorded durations"
          : `Average workout ${durationLabel(current.duration)}`}
        {" · "}
        {improving === null
          ? "no exercises to compare yet"
          : `${Math.round(improving)}% of exercises improving`}
      </p>
      <details className="period-summary">
        <summary className="session-summary">
          <strong>About these stats</strong>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <p className="row-sub">
          <time dateTime={period.start}>{localizedDate(period.start)}</time> –{" "}
          <time dateTime={period.end}>{localizedDate(period.end)}</time>,
          compared with{" "}
          <time dateTime={period.previousStart}>
            {localizedDate(period.previousStart)}
          </time>{" "}
          –{" "}
          <time dateTime={period.previousEnd}>
            {localizedDate(period.previousEnd)}
          </time>
          . Workouts per week counts Monday–Sunday weeks that are over and have
          at least one workout; the current week joins once it ends. Working
          sets leave out warm-ups, cool-downs, drops and cardio; volume is
          weight × reps for weighted sets, drops included. Cardio adds up the
          time, distance and calories of checked cardio sets. Time trained adds
          the recorded durations. Exercises improving compares your latest
          working result with the last session before the period, or the first
          session within it. Only comparable load and measure count: estimated
          strength for weighted sets of 1–10 reps, otherwise reps or seconds at
          the same load. A dash means there is not enough data.
        </p>
      </details>
    </section>
  );
}

export default memo(ProgressSummary);
