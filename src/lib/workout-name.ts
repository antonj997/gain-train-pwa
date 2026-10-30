import type { Workout } from "../data/model";
import { LANGUAGES, t, translate } from "../i18n";

/** The name a workout gets when nobody names it, as stored before languages existed. */
export const DEFAULT_WORKOUT_NAME = "Workout";
/** The default name in every language, so a renamed default is still "unnamed". */
const DEFAULT_NAMES = new Set(
  LANGUAGES.map((language) => translate(language, "workout.defaultName")),
);
export const isDefaultWorkoutName = (name: string) =>
  DEFAULT_NAMES.has(name.trim());
/** A workout's name for display: the default name reads in the current language. */
export const workoutTitle = (name: string) =>
  !name.trim() || isDefaultWorkoutName(name) ? t("workout.defaultName") : name;

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
  if (name && !isDefaultWorkoutName(name)) return workout.name;
  const given = from.routine?.trim() || from.plan?.trim();
  if (given) return given.slice(0, MAX);
  const names = [
    ...new Set(workout.exercises.map((ex) => ex.name.trim()).filter(Boolean)),
  ];
  if (!names.length) return t("workout.defaultName");
  const pair = names.join(", ");
  const auto =
    names.length <= 2 && pair.length <= MAX
      ? pair
      : t("workout.andMore", { first: names[0], count: names.length - 1 });
  return auto.length <= MAX ? auto : `${auto.slice(0, MAX - 1)}…`;
}
