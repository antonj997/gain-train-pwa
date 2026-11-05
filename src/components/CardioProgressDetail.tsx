import { type cardioProgressFor } from "@/data/analytics";
import {
  type DistanceUnit,
  cardioTotals,
  formatDistance,
  formatDuration,
  formatPace,
  paceUnit,
  totalsLabel,
} from "@/lib/cardio";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { formatDecimal, t } from "@/i18n";

type Props = {
  item: ReturnType<typeof cardioProgressFor>[number];
  /** Sessions after this date count as the last 30 days. */
  cutoffDate: string;
  /** The unit the exercise's distance is shown in. */
  distanceUnit?: DistanceUnit;
};

/**
 * The exercise page's Overview for a cardio exercise: the latest session,
 * then time and distance over 30 days, with pace, calories and average heart
 * rate where they were logged.
 */
export default function CardioProgressDetail({
  item,
  cutoffDate,
  distanceUnit: unit = "km",
}: Props) {
  const latest = item.sessions.at(-1)!;
  const recent = item.sessions.filter((session) => session.date > cutoffDate);
  const sum = (key: "durationSec" | "distanceM" | "calories") =>
    recent.reduce((total, session) => total + session[key], 0);
  const distance = sum("distanceM");
  const calories = sum("calories");
  // Heart rate over 30 days: each session's average, weighted by its time.
  const heartRate = cardioTotals(
    recent.map((session) => ({
      id: session.workoutId,
      reps: null,
      weight: null,
      load: "weight",
      measure: "cardio",
      section: "working",
      done: true,
      durationSec: session.durationSec,
      heartRate: session.heartRate,
    })),
  ).heartRate;
  const latestPace = formatPace(latest.durationSec, latest.distanceM, unit);
  const pace = formatPace(sum("durationSec"), distance, unit);
  const latestExtras = [
    latestPace && `${latestPace} ${paceUnit(unit)}`,
    latest.inclinePct !== null &&
      t("cardio.avgIncline", { n: formatDecimal(latest.inclinePct) }),
  ].filter(Boolean);
  return (
    <div className="exercise-detail">
      <div className="card performance">
        <span className="performance-label">{t("cardio.latestSession")}</span>
        <strong className="performance-value">
          {totalsLabel(latest, unit)}
        </strong>
        {latestExtras.length > 0 && (
          <span className="row-sub">{latestExtras.join(" · ")}</span>
        )}
        <time className="row-sub" dateTime={latest.date}>
          {localizedDate(latest.date)}
        </time>
      </div>
      <div className="tiles">
        <div className="card tile">
          <span className="row-sub">{t("cardio.time30")}</span>
          <strong className="tile-value">
            {formatDuration(sum("durationSec"))}
          </strong>
          <small className="row-sub">
            {countLabel(recent.length, "session")}
          </small>
        </div>
        <div className="card tile">
          <span className="row-sub">{t("cardio.distance30")}</span>
          <strong className="tile-value">
            {formatDistance(distance, unit) || "0"}{" "}
            <span className="tile-unit">{unit}</span>
          </strong>
          <small className="row-sub">
            {t("cardio.total", {
              sessions: countLabel(item.sessions.length, "session"),
            })}
          </small>
        </div>
        {pace && (
          <div className="card tile">
            <span className="row-sub">{t("cardio.pace30")}</span>
            <strong className="tile-value">
              {pace} <span className="tile-unit">{paceUnit(unit)}</span>
            </strong>
          </div>
        )}
        {calories > 0 && (
          <div className="card tile">
            <span className="row-sub">{t("cardio.calories30")}</span>
            <strong className="tile-value">
              {formatDecimal(calories)} <span className="tile-unit">kcal</span>
            </strong>
          </div>
        )}
        {heartRate !== null && (
          <div className="card tile">
            <span className="row-sub">{t("cardio.heartRate30")}</span>
            <strong className="tile-value">
              {Math.round(heartRate)} <span className="tile-unit">bpm</span>
            </strong>
          </div>
        )}
      </div>
      <p className="row-sub">{t("cardio.note", { name: item.name })}</p>
    </div>
  );
}
