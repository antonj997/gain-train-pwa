import type { ReactNode } from "react";
import ListRow from "@/components/ui/ListRow";
import { DoneSetValue } from "@/components/DoneSetList";
import type { ExerciseRecords as Records } from "@/data/exercise-records";
import { localizedDate } from "@/lib/dates";
import { historyPath } from "@/lib/routes";
import {
  formatWeight,
  formatWeightValue,
  getWeightUnit,
  weightTotal,
} from "@/lib/units";
import { formatFixed, t } from "@/i18n";

const dateOf = (date: string) =>
  localizedDate(date, { day: "numeric", month: "short", year: "numeric" });

/**
 * The exercise page's Records. Each row opens the workout it was set in, with
 * the record set highlighted; session volume opens the workout.
 */
export default function ExerciseRecords({ records }: { records: Records }) {
  const unit = getWeightUnit();
  const volume = (kg: number) =>
    `${formatFixed(weightTotal(kg, unit), 0)} ${unit}`;
  const rows: {
    key: string;
    title: string;
    value: ReactNode;
    sub: ReactNode;
    to: string;
  }[] = [];
  const { bestE1rm, heaviest, mostReps, bestSetVolume, bestSessionVolume } =
    records;
  if (bestE1rm)
    rows.push({
      key: "e1rm",
      title: t("records.e1rm"),
      value: formatWeight(bestE1rm.value, unit, 1),
      sub: (
        <>
          <DoneSetValue set={bestE1rm.set} withHold={false} /> ·{" "}
          {dateOf(bestE1rm.date)}
        </>
      ),
      to: historyPath(bestE1rm.workoutId, bestE1rm.set.id),
    });
  if (heaviest)
    rows.push({
      key: "heaviest",
      title: t("records.heaviest"),
      value: <DoneSetValue set={heaviest.set} withHold={false} />,
      sub: dateOf(heaviest.date),
      to: historyPath(heaviest.workoutId, heaviest.set.id),
    });
  if (mostReps)
    rows.push({
      key: "reps",
      title: t("records.mostReps"),
      value: <DoneSetValue set={mostReps.set} withHold={false} />,
      sub: dateOf(mostReps.date),
      to: historyPath(mostReps.workoutId, mostReps.set.id),
    });
  if (bestSetVolume)
    rows.push({
      key: "setVolume",
      title: t("records.setVolume"),
      value: volume(bestSetVolume.value),
      sub: (
        <>
          <DoneSetValue set={bestSetVolume.set} withHold={false} /> ·{" "}
          {dateOf(bestSetVolume.date)}
        </>
      ),
      to: historyPath(bestSetVolume.workoutId, bestSetVolume.set.id),
    });
  if (bestSessionVolume)
    rows.push({
      key: "sessionVolume",
      title: t("records.sessionVolume"),
      value: volume(bestSessionVolume.value),
      sub: dateOf(bestSessionVolume.date),
      to: historyPath(bestSessionVolume.workoutId),
    });
  if (!rows.length)
    return (
      <div className="empty-card" role="status">
        <p>{t("records.empty")}</p>
      </div>
    );
  return (
    <>
      <section aria-label={t("exercise.records")}>
        <div className="list record-list">
          {rows.map((row) => (
            <ListRow
              key={row.key}
              to={row.to}
              title={row.title}
              sub={row.sub}
              value={<strong>{row.value}</strong>}
              chevron
            />
          ))}
        </div>
      </section>
      {records.repsAtWeight.length > 1 && (
        <section aria-labelledby="reps-at-weight">
          <h2 className="group-title" id="reps-at-weight">
            {t("records.repsAtWeight")}
          </h2>
          <div className="list record-list">
            {records.repsAtWeight.map((hit) => (
              <ListRow
                key={hit.weight}
                to={historyPath(hit.workoutId, hit.set.id)}
                title={t("records.repsAt", {
                  weight: formatWeightValue(hit.weight, unit),
                  unit,
                })}
                sub={dateOf(hit.date)}
                value={
                  <strong>{t("records.reps", { count: hit.reps })}</strong>
                }
                chevron
              />
            ))}
          </div>
        </section>
      )}
      <p className="row-sub section-note">{t("records.note")}</p>
    </>
  );
}
