import { EXERCISE_NOTE_MAX, REST_MAX, type Library } from "../data/model";

/**
 * Each exercise's own settings in the synced library (v6 §D5), keyed by
 * exercise id, built-in or custom, in the pattern of exercise-units.ts:
 *
 * - `exerciseNotes`: the note shown under the exercise's heading in every
 *   workout;
 * - `weightSteps`: its weight step in kg, which drives the pad's −/+, the
 *   drop's −20 % rounding, the fatigue lowering, the targets and the "±2,5"
 *   in the heading; absent means the equipment's default;
 * - `restSeconds`: its own rest time, where 0 turns the timer off for it;
 *   absent means it follows the rest preference (preferences.ts).
 *
 * Every helper keeps the other exercises' entries, and values a newer app
 * saved, as they are.
 */

/** The steps the exercise's ⋯ offers, in kg. */
export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 4, 5] as const;
export type WeightStep = (typeof WEIGHT_STEPS)[number];

/** The step for any equipment the table does not name (band, unknown). */
const FALLBACK_STEP = 2.5;
const EQUIPMENT_STEP: Readonly<Record<string, number>> = {
  barbell: 2.5,
  smith: 2.5,
  cable: 2.5,
  dumbbell: 2,
  machine: 5,
  kettlebell: 4,
  // Bodyweight exercises step their added weight.
  bodyweight: 1.25,
  band: 2.5,
};

/** The weight step an exercise's equipment starts with, in kg. */
export function defaultWeightStep(equipment?: string | null): number {
  return (equipment && EQUIPMENT_STEP[equipment]) || FALLBACK_STEP;
}

const isStep = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const own = <T>(record: Readonly<Record<string, T>> | undefined, id: string) =>
  record && Object.prototype.hasOwnProperty.call(record, id)
    ? record[id]
    : undefined;

/** A copy of the record without `id`'s entry. */
function without<T>(
  record: Readonly<Record<string, T>> | undefined,
  id: string,
): Record<string, T> {
  const { [id]: _old, ...others } = record ?? {};
  return others;
}

/** The exercise's weight step in kg: its own, else its equipment's default. */
export function weightStepOf(
  library: Pick<Library, "weightSteps">,
  exerciseId: string,
  equipment?: string | null,
): number {
  const step = own(library.weightSteps, exerciseId);
  return isStep(step) ? step : defaultWeightStep(equipment);
}

/**
 * The library with one exercise's weight step chosen. Null, or the
 * equipment's default, clears its own, so it follows the default again.
 */
export function withWeightStep(
  library: Library,
  exerciseId: string,
  step: number | null,
  equipment?: string | null,
): Library {
  const others = without(library.weightSteps, exerciseId);
  const next =
    step === null || !isStep(step) || step === defaultWeightStep(equipment)
      ? others
      : { ...others, [exerciseId]: step };
  return { ...library, weightSteps: next };
}

/** The exercise's note, or "" when it has none. */
export function exerciseNote(
  library: Pick<Library, "exerciseNotes">,
  exerciseId: string,
): string {
  const note = own(library.exerciseNotes, exerciseId);
  return typeof note === "string" ? note : "";
}

/** The library with one exercise's note set: trimmed, clipped; empty removes. */
export function withExerciseNote(
  library: Library,
  exerciseId: string,
  text: string,
): Library {
  const note = text.trim().slice(0, EXERCISE_NOTE_MAX).trim();
  const others = without(library.exerciseNotes, exerciseId);
  return {
    ...library,
    exerciseNotes: note ? { ...others, [exerciseId]: note } : others,
  };
}

/**
 * The exercise's own rest time in seconds (0 = the timer is off for it), or
 * undefined when it follows the rest preference.
 */
export function restOf(
  library: Pick<Library, "restSeconds">,
  exerciseId: string,
): number | undefined {
  const seconds = own(library.restSeconds, exerciseId);
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
    ? Math.min(Math.round(seconds), REST_MAX)
    : undefined;
}

/**
 * The library with one exercise's rest time set (whole seconds, 0–600; 0
 * turns its timer off), or cleared with null so it follows the preference.
 */
export function withRest(
  library: Library,
  exerciseId: string,
  seconds: number | null,
): Library {
  const others = without(library.restSeconds, exerciseId);
  if (seconds === null || !Number.isFinite(seconds))
    return { ...library, restSeconds: others };
  const value = Math.min(Math.max(Math.round(seconds), 0), REST_MAX);
  return { ...library, restSeconds: { ...others, [exerciseId]: value } };
}
