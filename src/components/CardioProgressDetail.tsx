import { type cardioProgressFor } from "@/data/analytics";
import ListRow from "@/components/ui/ListRow";
import { formatDuration, formatKm, totalsLabel } from "@/lib/cardio";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { historyPath } from "@/lib/routes";
import { t } from "@/i18n";

type Props = {
  item: ReturnType<typeof cardioProgressFor>[number];
  /** Sessions after this date count as the last 30 days. */
  cutoffDate: string;
};

/** The sheet body for a cardio exercise: time and distance per session. */
export default function CardioProgressDetail({ item, cutoffDate }: Props) {
  const latest = item.sessions.at(-1)!;
  const recent = item.sessions.filter((session) => session.date > cutoffDate);
  const sum = (key: "durationSec" | "distanceM") =>
    recent.reduce((total, session) => total + session[key], 0);
  const distance = sum("distanceM");
  return (
    <div className="exercise-detail">
      <div className="card performance">
        <span className="performance-label">{t("cardio.latestSession")}</span>
        <strong className="performance-value">{totalsLabel(latest)}</strong>
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
            {formatKm(distance) || "0"} <span className="tile-unit">km</span>
          </strong>
          <small className="row-sub">
            {t("cardio.total", {
              sessions: countLabel(item.sessions.length, "session"),
            })}
          </small>
        </div>
      </div>
      <section>
        <h3 className="group-title">{t("detail.recorded")}</h3>
        <div className="list">
          {[...item.sessions].reverse().map((session) => (
            <ListRow
              key={session.workoutId}
              to={historyPath(session.workoutId)}
              title={localizedDate(session.date)}
              value={<strong>{totalsLabel(session)}</strong>}
              chevron
            />
          ))}
        </div>
      </section>
      <p className="row-sub">{t("cardio.note", { name: item.name })}</p>
    </div>
  );
}
