import { catalogueById } from "../data/catalogue";
import type { Workout } from "../data/model";
import { LANGUAGES, t, translate } from "../i18n";
import { categoryLabel } from "./catalogue-labels";

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

/** Main category by exercise id, for exercises outside the catalogue. */
export type CategoryLookup = ReadonlyMap<string, string>;

/**
 * The categories a workout trained, most common first: each exercise counts
 * once for its main category only, so a back day's rows don't make it "Arms"
 * through their secondary focus. Ties go to the category with more sets, then
 * to the one that came first. At most three, so the name stays short.
 */
export function workoutCategories(
  exercises: Workout["exercises"],
  custom: CategoryLookup = new Map(),
): string[] {
  const tally = new Map<
    string,
    { exercises: number; sets: number; first: number }
  >();
  exercises.forEach((ex, index) => {
    const category =
      catalogueById.get(ex.exerciseId)?.category ?? custom.get(ex.exerciseId);
    if (!category || category === "Other") return;
    const entry = tally.get(category) ?? {
      exercises: 0,
      sets: 0,
      first: index,
    };
    entry.exercises += 1;
    entry.sets += ex.sets.length;
    tally.set(category, entry);
  });
  return [...tally.entries()]
    .sort(
      ([, a], [, b]) =>
        b.exercises - a.exercises || b.sets - a.sets || a.first - b.first,
    )
    .slice(0, 3)
    .map(([category]) => category);
}

/** "Back", "Back & Arms", "Chest, Shoulders & Arms" in the current language. */
const joinCategories = (categories: string[]) => {
  const labels = categories.map(categoryLabel);
  return labels.length <= 1
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
};

/**
 * A workout's name, filled in when it still has the default: the routine's
 * name if it came from one, else the plan's day type or group, else the
 * categories it trained ("Back & Arms"), else its first exercises ("Bench
 * Press, Pull Up") when none of them has a known category. A name anyone
 * typed is kept, and with nothing to go on it stays "Workout".
 */
export function autoWorkoutName(
  workout: Pick<Workout, "name" | "exercises">,
  from: { routine?: string; plan?: string } = {},
  custom?: CategoryLookup,
): string {
  const name = workout.name.trim();
  if (name && !isDefaultWorkoutName(name)) return workout.name;
  const given = from.routine?.trim() || from.plan?.trim();
  if (given) return given.slice(0, MAX);
  const categories = workoutCategories(workout.exercises, custom);
  if (categories.length) return joinCategories(categories).slice(0, MAX);
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
