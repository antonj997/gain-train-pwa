import ExerciseAvatar from "@/components/items/ExerciseAvatar";
import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Pencil, Repeat, Trash2 } from "lucide-react";
import DoneSetList from "@/components/DoneSetList";
import { useData } from "@/contexts/useData";
import { useCardioFields } from "@/hooks/useCardioFields";
import {
  recordBadges,
  recordSetKinds,
  workoutRecords,
} from "@/data/record-rank";
import { improvedSetIds } from "@/data/set-improvement";
import { lastSessions, priorWorkouts } from "@/data/workouts";
import type { Workout } from "@/data/model";
import { completedWorkouts, doneSetCount } from "@/data/selectors";
import { summarize } from "@/data/summary";
import { countLabel, durationLabel, volumeLabel } from "@/lib/labels";
import { exercisePath, workoutPath } from "@/lib/routes";
import { workoutNoteOf } from "@/lib/workout-note";
import { t } from "@/i18n";

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
 * rows, under the workout's note when it has one. A set that beat the same
 * set last time has a small up arrow; an exercise that set a record has one
 * chip on its record set, naming the strongest kind (heaviest weight, then
 * rep record, then the quieter estimated 1RM). Repeat, Edit and Delete sit in
 * the sheet's sticky footer.
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
  const prs = useMemo(
    () => workoutRecords(state.records, id),
    [state.records, id],
  );
  const bySet = useMemo(() => recordSetKinds(prs), [prs]);
  const badge = recordBadges(prs).get(id);
  const note = workoutNoteOf(w);
  // Each exercise's previous session, as the workout screen's Previous column had it.
  const previous = useMemo(() => {
    const current = completedWorkouts(state.records).find((r) => r.id === id);
    return current
      ? lastSessions(
          priorWorkouts(Object.values(state.records), current, w.date),
        )
      : new Map();
  }, [state.records, id, w.date]);
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
      value: String(prs.length),
      records: !!badge && !badge.quiet,
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
        {note && (
          <p className="workout-note">
            <span className="workout-note-label">{t("details.note")}</span>
            {note}
          </p>
        )}
        {w.exercises.map((ex) => {
          const done = ex.sets.filter((s) => s.done);
          return (
            <section key={ex.id} className="card ex-card" aria-label={ex.name}>
              <Link className="ex-head-link" to={exercisePath(ex.exerciseId)}>
                <ExerciseAvatar exerciseId={ex.exerciseId} />
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
              <DoneSetList
                sets={ex.sets}
                highlight={highlight}
                records={bySet}
                improved={improvedSetIds(
                  ex.sets,
                  previous.get(ex.exerciseId)?.sets,
                )}
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
