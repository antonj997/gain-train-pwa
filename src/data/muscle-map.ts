// Hard sets per muscle for the detailed muscle map: the plan status page
// colours each muscle by its sets in the plan week. Pure, so it is tested
// (tests/muscle-map.test.ts).
import type { Plan, RecordDoc, Workout } from "./model";
import { MUSCLES, type Muscle } from "./muscles";
import { isHardSet } from "./muscle-sets";
import type { MusclesOf } from "./exercise-muscles";
import { planVolumeWeeks, toHalfSet } from "./plan-status";

/** Hard sets per muscle; muscles without any are left out. */
export type MuscleSets = Partial<Record<Muscle, number>>;

/**
 * Hard sets per muscle in the workouts: each hard set adds the exercise's
 * level for each of its muscles, 1 for a main muscle and 0.5 for a helping
 * one, the same rule as the sets per muscle group.
 */
export function hardSetsPerMuscle(
  workouts: readonly Pick<Workout, "exercises">[],
  musclesOf: MusclesOf,
): Map<Muscle, number> {
  const sets = new Map<Muscle, number>();
  for (const workout of workouts)
    for (const exercise of workout.exercises) {
      const hard = exercise.sets.filter(isHardSet).length;
      if (!hard) continue;
      const muscles = musclesOf(exercise.exerciseId);
      for (const muscle of MUSCLES) {
        const level = muscles[muscle];
        if (level) sets.set(muscle, (sets.get(muscle) ?? 0) + hard * level);
      }
    }
  return sets;
}

export type PlanMuscleMap = {
  /** The plan week that holds today (the last one after the end). */
  week: number;
  /** Finished plan weeks the average is taken over; 0 in the first week. */
  weeks: number;
  /** Whether the plan has ended: the map then shows the average week. */
  ended: boolean;
  /** Hard sets so far in the week that holds today; empty after the end. */
  thisWeek: MuscleSets;
  /** Hard sets a week over the finished weeks; null before one has finished. */
  average: MuscleSets | null;
};

/** Sets to the half set in MUSCLES order; a muscle that rounds to none is left out. */
function rounded(sets: Map<Muscle, number>, weeks = 1): MuscleSets {
  const result: MuscleSets = {};
  for (const muscle of MUSCLES) {
    const value = toHalfSet((sets.get(muscle) ?? 0) / weeks);
    if (value > 0) result[muscle] = value;
  }
  return result;
}

/**
 * Hard sets per muscle over the plan, for the map on its volume card: the
 * weeks are planMuscleSets' (planVolumeWeeks), so the map and the group bars
 * agree. The UI colours this week while the plan runs and the average week
 * after it has ended. Null before the plan starts or when nothing has been
 * trained in it, as for planMuscleSets.
 */
export function planMuscleMap(
  plan: Plan,
  records: Record<string, RecordDoc> | readonly RecordDoc[],
  today: string,
  musclesOf: MusclesOf,
): PlanMuscleMap | null {
  const volume = planVolumeWeeks(plan, records, today);
  if (!volume) return null;
  const { week, weeks, ended } = volume;
  const finished = hardSetsPerMuscle(volume.finished, musclesOf);
  const current = hardSetsPerMuscle(volume.current, musclesOf);
  if (!finished.size && !current.size) return null;
  return {
    week,
    weeks,
    ended,
    thisWeek: rounded(current),
    average: weeks > 0 ? rounded(finished, weeks) : null,
  };
}

/**
 * Where the week map's heat steps start, in hard sets: step 1 from half a
 * set, then 5–9, 10–14, 15–19 and 20 or more. 10 to 20 is the common growth
 * guide (WEEKLY_SET_GUIDE), so steps 3 and 4 read as on target.
 */
export const WEEK_HEAT = [0.5, 5, 10, 15, 20] as const;
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

/** A muscle's heat step for its sets in a week: 0 untrained, up to 5 for 20 or more. */
export const heatStep = (sets: number): HeatStep =>
  WEEK_HEAT.filter((from) => sets >= from).length as HeatStep;
