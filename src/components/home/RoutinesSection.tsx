import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/useData";
import { RoutineRow, RoutinePreviewSheet } from "@/components/RoutinePreview";
import type { RoutineRecord, WorkoutRecord } from "@/data/model";
import {
  routines as routineRecords,
  workouts as allWorkouts,
} from "@/data/selectors";
import { routineEditPath } from "@/lib/routes";
import { routineAverageMinutes } from "@/lib/routine-preview";
import { useT } from "@/i18n/useT";

type Props = {
  /** Finished workouts, newest first. */
  completed: WorkoutRecord[];
  day: string;
  /** The routine the Today card offers, left out here. */
  exclude?: string | null;
  starting: boolean;
  onStart: (routine: RoutineRecord) => void;
};

/** "Your routines" on Train: up to three routines used most recently (not today's), with their preview. */
export default function RoutinesSection({
  completed,
  day,
  exclude,
  starting,
  onStart,
}: Props) {
  const { state } = useData();
  const navigate = useNavigate();
  const { t } = useT();
  const all = routineRecords(state.records);
  // Routines last used first; those never used keep their saved order.
  const recentRoutines = useMemo(() => {
    const lastUsed = new Map<string, number>();
    allWorkouts(state.records).forEach((r, index) => {
      const id = r.payload.routineId;
      if (id && !lastUsed.has(id)) lastUsed.set(id, index);
    });
    return routineRecords(state.records)
      .filter((routine) => routine.id !== exclude)
      .map((routine, order) => ({ routine, order }))
      .sort(
        (a, b) =>
          (lastUsed.get(a.routine.id) ?? Infinity) -
            (lastUsed.get(b.routine.id) ?? Infinity) || a.order - b.order,
      )
      .slice(0, 3)
      .map(({ routine }) => routine);
  }, [state.records, exclude]);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRoutine =
    routineRecords(state.records).find((r) => r.id === previewId) ?? null;
  const routineStats = (id: string) => ({
    minutes: routineAverageMinutes(id, state.records),
    lastDone:
      completed.find((r) => r.payload.routineId === id)?.payload.date ?? null,
  });
  const renderRoutine = (r: RoutineRecord) => (
    <RoutineRow
      key={r.id}
      routine={r}
      stats={routineStats(r.id)}
      disabled={starting}
      onPreview={() => setPreviewId(r.id)}
      onStart={() => onStart(r)}
    />
  );
  // The only routine is on the Today card: nothing else to list.
  if (!recentRoutines.length && all.length) return null;
  return (
    <section aria-labelledby="routines-heading">
      <div className="section-head">
        <h2 id="routines-heading">{t("home.yourRoutines")}</h2>
        <Link
          className="text-link"
          to="/library"
          aria-label={t("home.allRoutines")}
        >
          {t("home.all")}
        </Link>
      </div>
      {recentRoutines.length ? (
        <div className="routine-cards">{recentRoutines.map(renderRoutine)}</div>
      ) : (
        <div className="card col-12">
          <h3 className="card-title">{t("home.emptyRoutinesTitle")}</h3>
          <p className="row-sub">{t("home.emptyRoutinesText")}</p>
          <Link className="btn-secondary" to="/library">
            {t("home.createRoutine")}
          </Link>
        </div>
      )}
      <RoutinePreviewSheet
        routine={previewRoutine}
        stats={
          previewRoutine
            ? routineStats(previewRoutine.id)
            : { minutes: null, lastDone: null }
        }
        now={day}
        disabled={starting}
        onClose={() => setPreviewId(null)}
        onStart={() => {
          if (!previewRoutine) return;
          setPreviewId(null);
          onStart(previewRoutine);
        }}
        onEdit={() => {
          if (previewRoutine) navigate(routineEditPath(previewRoutine.id));
        }}
      />
    </section>
  );
}
