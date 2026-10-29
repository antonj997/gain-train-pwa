import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/useData";
import { RoutineRow, RoutinePreviewSheet } from "@/components/RoutinePreview";
import type { RoutineRecord, WorkoutRecord } from "@/data/model";
import type { PlannedDay } from "@/data/plans";
import {
  routines as routineRecords,
  workouts as allWorkouts,
} from "@/data/selectors";
import { routineEditPath } from "@/lib/routes";
import { routineAverageMinutes } from "@/lib/routine-preview";

type Props = {
  /** Finished workouts, newest first. */
  completed: WorkoutRecord[];
  day: string;
  todayPlan: PlannedDay | null;
  starting: boolean;
  onStart: (routine: RoutineRecord) => void;
  /** Starts an empty workout with the picker on today's planned categories. */
  onStartSuggestions: () => void;
};

/** "Start a routine": today's plan, the three routines used most recently and their preview. */
export default function RoutinesSection({
  completed,
  day,
  todayPlan,
  starting,
  onStart,
  onStartSuggestions,
}: Props) {
  const { state } = useData();
  const navigate = useNavigate();
  // Routines last used first; those never used keep their saved order.
  const recentRoutines = useMemo(() => {
    const lastUsed = new Map<string, number>();
    allWorkouts(state.records).forEach((r, index) => {
      const id = r.payload.routineId;
      if (id && !lastUsed.has(id)) lastUsed.set(id, index);
    });
    return routineRecords(state.records)
      .map((routine, order) => ({ routine, order }))
      .sort(
        (a, b) =>
          (lastUsed.get(a.routine.id) ?? Infinity) -
            (lastUsed.get(b.routine.id) ?? Infinity) || a.order - b.order,
      )
      .slice(0, 3)
      .map(({ routine }) => routine);
  }, [state.records]);

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
  const planRoutines = todayPlan
    ? todayPlan.routineIds.flatMap((id) => {
        const routine = routineRecords(state.records).find((r) => r.id === id);
        return routine ? [routine] : [];
      })
    : [];

  return (
    <section aria-labelledby="routines-heading">
      <div className="section-head">
        <h2 id="routines-heading">Start a routine</h2>
        <Link className="text-link" to="/library">
          All routines
        </Link>
      </div>
      {todayPlan && (
        <div className="card plan-today">
          <span className="plan-today-text">
            <span className="row-sub">From your plan</span>
            <strong className="card-title">Today: {todayPlan.title}</strong>
          </span>
          {todayPlan.kind === "routine" && planRoutines[0] && (
            <button
              className="btn-primary btn-sm"
              disabled={starting}
              onClick={() => onStart(planRoutines[0])}
            >
              Start
            </button>
          )}
          {todayPlan.kind === "type" && (
            <button
              className="btn-primary btn-sm"
              disabled={starting}
              onClick={onStartSuggestions}
            >
              Start with suggestions
            </button>
          )}
        </div>
      )}
      {todayPlan?.kind === "group" && (
        <div className="plan-today-group">
          {planRoutines.length > 0 && (
            <div className="list">{planRoutines.map(renderRoutine)}</div>
          )}
          {todayPlan.categories.length > 0 && (
            <button
              className="btn-secondary btn-block"
              disabled={starting}
              onClick={onStartSuggestions}
            >
              Start with suggestions
            </button>
          )}
        </div>
      )}
      {recentRoutines.length ? (
        <div className="list">{recentRoutines.map(renderRoutine)}</div>
      ) : (
        <div className="card col-12">
          <h3 className="card-title">A routine makes next time easier</h3>
          <p className="row-sub">
            Save a workout as a routine after finishing, or create one now.
          </p>
          <Link className="btn-secondary" to="/library">
            Create a routine
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
