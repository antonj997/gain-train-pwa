import {
  type Exercise,
  type RecordDoc,
  type RoutineRecord,
  type Workout,
  newSet,
  repeatExercises,
  today,
} from "./model";
import { previousResult } from "./workouts";
import { completedWorkouts } from "./selectors";
import { activePlans } from "./plans";
import { applyPlanStart, planStartFor } from "./phase";
import { equipmentLookup } from "./progression";
import { autoWorkoutName } from "../lib/workout-name";

export function suggestedExercises(items: Exercise[], records: RecordDoc[]) {
  const history = completedWorkouts(records);
  return repeatExercises(items).map((ex) => {
    const lastSession = history.find((r) =>
      r.payload.exercises.some(
        (e) => e.exerciseId === ex.exerciseId && e.sets.some((s) => s.done),
      ),
    );
    if (!lastSession) return ex;
    const prior = lastSession.payload.exercises
      .filter((e) => e.exerciseId === ex.exerciseId)
      .flatMap((e) => e.sets);
    return {
      ...ex,
      sets: ex.sets.map((set, index) => {
        const previous = previousResult(prior, ex.sets, index);
        return newSet(
          previous
            ? { ...set, reps: previous.reps, weight: previous.weight }
            : set,
        );
      }),
    };
  });
}

/**
 * A routine's exercises with the plan of `date` applied: the phase's planned
 * weights for progressed lifts and, in a deload week, fewer and lighter sets.
 * Without an active plan, or when the plan changes nothing, the exercises as
 * they are and no mark.
 */
export function withPlan(
  exercises: Exercise[],
  records: RecordDoc[],
  date: string,
): { exercises: Exercise[]; plan?: Workout["plan"] } {
  const plan = activePlans(records).find(
    (p) => !p.paused && p.startDate <= date && date <= p.endDate,
  );
  if (!plan) return { exercises };
  const equipmentOf = equipmentLookup(records);
  const start = planStartFor(plan, date, equipmentOf);
  if (!start || (!start.deload && !start.loads.size)) return { exercises };
  const applied = applyPlanStart(exercises, start, equipmentOf);
  return applied.mark.deload || applied.mark.loads
    ? { exercises: applied.exercises, plan: applied.mark }
    : { exercises };
}

/**
 * A new draft: blank, or from a routine with the last results suggested and,
 * inside a plan's phase, the plan's weights. `past` logs an earlier session,
 * so no timer starts and no plan applies (its date is chosen afterwards).
 */
export function newWorkout(
  records: RecordDoc[],
  { routine, past = false }: { routine?: RoutineRecord; past?: boolean } = {},
  now = Date.now(),
): Workout {
  const date = today();
  const suggested = routine
    ? suggestedExercises(routine.payload.exercises, records)
    : [];
  const planned =
    routine && !past
      ? withPlan(suggested, records, date)
      : { exercises: suggested };
  return {
    routineId: routine?.id,
    name: autoWorkoutName(
      { name: "", exercises: [] },
      { routine: routine?.payload.name },
    ),
    date,
    duration: null,
    startedAt: past ? null : now,
    createdAt: now,
    status: "draft",
    exercises: planned.exercises,
    ...(planned.plan ? { plan: planned.plan } : {}),
  };
}
