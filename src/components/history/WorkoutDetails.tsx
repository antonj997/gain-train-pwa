import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Pencil, Repeat, Trash2 } from "lucide-react";
import DoneSetList from "@/components/DoneSetList";
import { useData } from "@/contexts/useData";
import { useCardioFields } from "@/hooks/useCardioFields";
import { workoutRecordHits, type RecordKind } from "@/data/exercise-records";
import type { Workout } from "@/data/model";
import { doneSetCount } from "@/data/selectors";
import { summarize } from "@/data/summary";
import { countLabel, durationLabel } from "@/lib/labels";
import { exercisePath, workoutPath } from "@/lib/routes";
import { getWeightUnit, weightTotal } from "@/lib/units";
import { formatFixed, t } from "@/i18n";

/** "1.7 t", "830 kg", or in pounds "3.8 k lb". */
function volumeLabel(kg: number) {
  const unit = getWeightUnit();
  const value = weightTotal(kg, unit);
  return value >= 1000
    ? `${formatFixed(value / 1000, 1)} ${unit === "lb" ? "k lb" : "t"}`
    : `${Math.round(value)} ${unit}`;
}

type Props = {
  id: string;
  workout: Workout;
  /** A set to highlight and scroll to, from a record link. */
  highlight: string | null;
  busy: boolean;
  onRepeat: () => void;
  onDelete: () => void;
};

/**
 * A finished workout, read-only, in the workout screen's parts: summary tiles,
 * a card per exercise (its name opens the exercise page) with the checked
 * rows, and PR chips on the sets that set a record. Repeat, Edit and Delete
 * sit in the sheet's sticky footer.
 */
export default function WorkoutDetails({
  id,
  workout: w,
  highlight,
  busy,
  onRepeat,
  onDelete,
}: Props) {
  const { state } = useData();
  const { fieldsFor } = useCardioFields();
  const body = useRef<HTMLDivElement>(null);
  const hits = useMemo(
    () => workoutRecordHits(state.records, id),
    [state.records, id],
  );
  const bySet = useMemo(() => {
    const map = new Map<string, RecordKind[]>();
    for (const hit of hits) if (hit.setId) map.set(hit.setId, hit.kinds);
    return map;
  }, [hits]);
  const sessionRecords = new Set(
    hits.filter((hit) => !hit.setId).map((hit) => hit.exerciseId),
  );
  const totals = summarize([w], 1, w.date);
  // A record link scrolls its set into view once the sheet has opened.
  useEffect(() => {
    if (!highlight) return;
    const row = body.current?.querySelector(
      `[data-set-id="${CSS.escape(highlight)}"]`,
    );
    row?.scrollIntoView({ block: "center" });
  }, [highlight]);
  const tiles = [
    { label: t("details.sets"), value: String(doneSetCount(w)) },
    { label: t("progress.volume"), value: volumeLabel(totals.volume) },
    {
      label: t("details.time"),
      value: w.duration !== null ? durationLabel(w.duration) : "—",
    },
    {
      label: t("records.tile"),
      value: String(hits.length),
      records: hits.length > 0,
    },
  ];
  return (
    <>
      <div className="workout-details" ref={body}>
        <div className="detail-tiles">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className={"detail-tile" + (tile.records ? " has-records" : "")}
            >
              <span>{tile.label}</span>
              <strong>{tile.value}</strong>
            </div>
          ))}
        </div>
        {w.exercises.map((ex) => {
          const done = ex.sets.filter((s) => s.done);
          return (
            <section key={ex.id} className="card ex-card" aria-label={ex.name}>
              <Link className="ex-head-link" to={exercisePath(ex.exerciseId)}>
                <span className="ex-titles">
                  <h3 className="ex-title">{ex.name}</h3>
                  <span className="ex-last">
                    {done.length
                      ? countLabel(done.filter((s) => !s.drop).length, "set")
                      : t("details.noSets")}
                  </span>
                </span>
                <ChevronRight className="chev" size={20} aria-hidden="true" />
              </Link>
              {sessionRecords.has(ex.exerciseId) && (
                <p className="ex-session-record">
                  {t("records.prLabel", { kinds: t("records.sessionVolume") })}
                </p>
              )}
              <DoneSetList
                sets={ex.sets}
                highlight={highlight}
                records={bySet}
                distanceUnit={fieldsFor(ex.exerciseId).distanceUnit}
              />
            </section>
          );
        })}
      </div>
      <div className="sheet-footer details-footer">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={onRepeat}
        >
          <Repeat size={18} aria-hidden="true" />
          {busy ? t("history.pleaseWait") : t("details.repeat")}
        </button>
        <Link className="btn-secondary" to={workoutPath(id)}>
          <Pencil size={18} aria-hidden="true" />
          {t("details.edit")}
        </Link>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("history.deleteWorkout")}
          title={t("history.deleteWorkout")}
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
