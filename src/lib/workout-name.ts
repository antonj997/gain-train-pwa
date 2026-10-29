import type { Workout } from "../data/model";

/** The name a workout gets when nobody names it. */
export const DEFAULT_WORKOUT_NAME = "Workout";

const MAX = 100;

/**
 * A workout's name, filled in when it still has the default: the routine's
 * name if it came from one, else the plan's day type or group, else its first
 * exercises ("Bench Press, Pull Up", "Bench Press + 2 more"). A name anyone
 * typed is kept, and with nothing to go on it stays "Workout".
 */
export function autoWorkoutName(
  workout: Pick<Workout, "name" | "exercises">,
  from: { routine?: string; plan?: string } = {},
): string {
  const name = workout.name.trim();
  if (name && name !== DEFAULT_WORKOUT_NAME) return workout.name;
  const given = from.routine?.trim() || from.plan?.trim();
  if (given) return given.slice(0, MAX);
  const names = [
    ...new Set(workout.exercises.map((ex) => ex.name.trim()).filter(Boolean)),
  ];
  if (!names.length) return DEFAULT_WORKOUT_NAME;
  const pair = names.join(", ");
  const auto =
    names.length <= 2 && pair.length <= MAX
      ? pair
      : `${names[0]} + ${names.length - 1} more`;
  return auto.length <= MAX ? auto : `${auto.slice(0, MAX - 1)}…`;
}
