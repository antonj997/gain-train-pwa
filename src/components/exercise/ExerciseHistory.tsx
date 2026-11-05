import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import DoneSetList from "@/components/DoneSetList";
import type { ExerciseSession } from "@/data/exercise-records";
import type { DistanceUnit } from "@/lib/cardio";
import { localizedDate } from "@/lib/dates";
import { countLabel } from "@/lib/labels";
import { historyPath } from "@/lib/routes";
import { workoutTitle } from "@/lib/workout-name";
import { t } from "@/i18n";

/**
 * The exercise page's History: one card per finished workout, newest first,
 * with the date, the workout's name and its checked sets. A card opens that
 * workout's details in History.
 */
export default function ExerciseHistory({
  name,
  sessions,
  distanceUnit,
}: {
  name: string;
  sessions: readonly ExerciseSession[];
  /** A cardio exercise's distance unit. */
  distanceUnit?: DistanceUnit;
}) {
  return (
    <section className="col-12" aria-label={t("exercise.history")}>
      <p className="row-sub section-note">
        {t("exercise.historyNote", { name })}
      </p>
      {sessions.map((session) => {
        const date = localizedDate(session.date, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const title = workoutTitle(session.workoutName);
        return (
          <Link
            key={session.workoutId}
            to={historyPath(session.workoutId)}
            className="card session-card"
          >
            <span className="session-card-head">
              <span className="session-card-titles">
                <span className="session-card-title">{title}</span>
                <span className="row-sub">
                  <time dateTime={session.date}>{date}</time> ·{" "}
                  {countLabel(
                    session.sets.filter((s) => !s.drop).length,
                    "set",
                  )}
                </span>
              </span>
              <ChevronRight className="chev" size={20} aria-hidden="true" />
            </span>
            <DoneSetList sets={session.sets} distanceUnit={distanceUnit} />
          </Link>
        );
      })}
    </section>
  );
}
