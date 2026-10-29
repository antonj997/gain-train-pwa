import { Link } from "react-router-dom";
import { Repeat } from "lucide-react";
import type { WorkoutRecord } from "@/data/model";
import { doneSetCount } from "@/data/selectors";
import { localizedDate } from "@/lib/dates";
import { countLabel, durationLabel } from "@/lib/labels";
import { historyPath } from "@/lib/routes";
import { useT } from "@/i18n/useT";
import { workoutTitle } from "@/lib/workout-name";

/** The newest finished workout, with Repeat. */
export default function LastWorkoutCard({
  last,
  disabled,
  onRepeat,
}: {
  last: WorkoutRecord;
  disabled: boolean;
  onRepeat: () => void;
}) {
  const { t } = useT();
  return (
    <section className="card last-card" aria-label={t("home.lastWorkout")}>
      <Link className="last-text" to={historyPath(last.id)}>
        <span className="row-sub">
          {t("home.lastWorkout")} ·{" "}
          {localizedDate(last.payload.date, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </span>
        <span className="card-title">
          {workoutTitle(last.payload.name)} ·{" "}
          {countLabel(doneSetCount(last.payload), "set")}
          {last.payload.duration !== null &&
            ` · ${durationLabel(last.payload.duration)}`}
        </span>
      </Link>
      <button className="btn-secondary" disabled={disabled} onClick={onRepeat}>
        <Repeat size={18} aria-hidden="true" />
        {t("home.repeat")}
      </button>
    </section>
  );
}
