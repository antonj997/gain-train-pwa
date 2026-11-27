// The fatigue rule (v6 §D10, frame B13): a muscle that has already had 3 or
// more hard sets more before this exercise than last time may find today's
// target heavy, so the workout offers to lower it one weight step. Pure, so
// it is tested (tests/fatigue.test.ts); the row is FatigueRow.tsx.
import type { Exercise, Workout } from "./model";
import { isDrop } from "./drops";
import { isHardSet } from "./muscle-sets";
import { MUSCLES, type Muscle } from "./muscles";
import type { MusclesOf } from "./exercise-muscles";
import type { SetTarget } from "./targets";
import { hasExtraWeight } from "../lib/set-load";
import { formatWeightValue, type WeightUnit } from "../lib/units";

/** "20 × 8": a target as the fatigue row and its toast say it. */
export const fatigueTargetText = (target: SetTarget, unit: WeightUnit) =>
  target.weight === null
    ? `${target.reps}`
    : `${formatWeightValue(target.weight, unit)} × ${target.reps}`;

/** What the row says: the muscle, its hard sets today and last time, and the target. */
export type FatigueNote = {
  muscle: Muscle;
  today: number;
  before: number;
  from: SetTarget;
  to: SetTarget;
};

/** How many hard sets more before the exercise than last time bring the note. */
export const FATIGUE_MORE_SETS = 3;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Hard sets per muscle that the exercises before `index` credited, at each
 * exercise's level (1 for a main muscle, 0.5 for a helping one).
 */
function setsBefore(
  exercises: readonly Exercise[],
  index: number,
  musclesOf: MusclesOf,
): Map<Muscle, number> {
  const sets = new Map<Muscle, number>();
  for (const exercise of exercises.slice(0, Math.max(0, index))) {
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

/** An open working set (not a drop): the ones the target is for. */
const openWorking = (exercise: Exercise) =>
  exercise.sets.filter((s) => s.section === "working" && !isDrop(s) && !s.done);

/** The target one weight step lighter, the same reps, never under 0. */
export const lowerTarget = (target: SetTarget, step: number): SetTarget => ({
  weight:
    target.weight === null
      ? null
      : Math.max(0, round3(target.weight - (step > 0 ? step : 2.5))),
  reps: target.reps,
});

/**
 * The note for the exercise at `exerciseIndex`, or null. It shows only while
 * no working set of the exercise is checked, there is a last time (the last
 * finished workout that holds the exercise, `previous`), the exercise has a
 * weighted target and some main muscle has had at least 3 hard sets more
 * before it today than last time; the largest difference wins, a tie goes to
 * MUSCLES order. The target is `target` when given, else the first open
 * working set's weight and reps (its fields are filled with the target).
 */
export function fatigueNote(
  workout: Pick<Workout, "exercises">,
  exerciseIndex: number,
  previous: Pick<Workout, "exercises"> | null,
  musclesOf: MusclesOf,
  step: number,
  target?: SetTarget | null,
): FatigueNote | null {
  const exercise = workout.exercises[exerciseIndex];
  if (!exercise || !previous) return null;
  const working = exercise.sets.filter(
    (s) => s.section === "working" && !isDrop(s),
  );
  if (!working.length || working.some((s) => s.done)) return null;
  const first = openWorking(exercise)[0];
  const weighted =
    !!first && (first.load === "weight" || hasExtraWeight(first));
  const from: SetTarget | null =
    target ??
    (first && weighted && first.weight !== null && first.reps !== null
      ? { weight: first.weight, reps: first.reps }
      : null);
  if (!weighted || !from || from.weight === null || !(from.weight > 0))
    return null;
  const before = previous.exercises.findIndex(
    (ex) => ex.exerciseId === exercise.exerciseId,
  );
  if (before < 0) return null;

  const now = setsBefore(workout.exercises, exerciseIndex, musclesOf);
  const then = setsBefore(previous.exercises, before, musclesOf);
  const muscles = musclesOf(exercise.exerciseId);
  let best: { muscle: Muscle; today: number; before: number } | null = null;
  for (const muscle of MUSCLES) {
    if (muscles[muscle] !== 1) continue;
    const today = now.get(muscle) ?? 0;
    const earlier = then.get(muscle) ?? 0;
    const more = today - earlier;
    if (more < FATIGUE_MORE_SETS) continue;
    if (!best || more > best.today - best.before)
      best = { muscle, today, before: earlier };
  }
  if (!best) return null;
  return { ...best, from, to: lowerTarget(from, step) };
}

/**
 * "Sänk till …": every open working set gets the lowered weight and reps,
 * and the exercise is marked, so the next target is not based on today
 * (§D4). Checked sets, warm-ups and drops keep theirs.
 */
export function lowerTargets(exercise: Exercise, to: SetTarget): Exercise {
  return {
    ...exercise,
    fatigue: "lowered",
    sets: exercise.sets.map((s) =>
      s.section === "working" && !isDrop(s) && !s.done
        ? { ...s, weight: to.weight, reps: to.reps }
        : s,
    ),
  };
}

/**
 * Ångra: the open sets get their weight and reps from `snapshot` (the
 * exercise before it was lowered) back, and the mark goes.
 */
export function restoreTargets(
  exercise: Exercise,
  snapshot: Exercise,
): Exercise {
  const { fatigue: _mark, ...rest } = exercise;
  const was = new Map(snapshot.sets.map((s) => [s.id, s]));
  return {
    ...rest,
    sets: exercise.sets.map((s) => {
      const old = was.get(s.id);
      return old && !s.done && s.section === "working" && !isDrop(s)
        ? { ...s, weight: old.weight, reps: old.reps }
        : s;
    }),
  };
}
