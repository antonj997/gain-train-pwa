// Your own exercise (v6 §D6, §E3): its equipment is a real choice that sets
// the icon, the filter and the weight step, and its category is derived from
// its muscles. Pure, so it is tested (tests/custom-exercise.test.ts).
import { catalogueById } from "../data/catalogue";
import { musclesLookup } from "../data/exercise-muscles";
import type { CustomExercise } from "../data/model";
import {
  MUSCLES,
  MUSCLE_GROUP,
  knownMuscles,
  type ExerciseMuscles,
} from "../data/muscles";
import { MUSCLE_GROUPS, type MuscleGroup } from "../data/muscle-sets";
import { swedishName } from "./exercise-name";
import { normalize } from "./exercise-search";

/** The equipment your own exercise can have, in the editor's order; the dumbbell is the default. */
export const CUSTOM_EQUIPMENT = [
  "dumbbell",
  "barbell",
  "kettlebell",
  "machine",
  "cable",
  "band",
  "bodyweight",
] as const;
export type CustomEquipment = (typeof CUSTOM_EQUIPMENT)[number];

export const isCustomEquipment = (value: unknown): value is CustomEquipment =>
  (CUSTOM_EQUIPMENT as readonly unknown[]).includes(value);

/**
 * The equipment of your own exercise: its `equipment`, else the equipment
 * glyph it chose as its icon before equipment was a choice, else the
 * dumbbell.
 */
export function equipmentOf(payload: {
  equipment?: unknown;
  icon?: unknown;
}): CustomEquipment {
  if (isCustomEquipment(payload.equipment)) return payload.equipment;
  if (isCustomEquipment(payload.icon)) return payload.icon;
  return "dumbbell";
}

/** The draft with its equipment: it also becomes the icon (v6 §D6). */
export function withEquipment<T extends { equipment?: string; icon?: string }>(
  payload: T,
  equipment: CustomEquipment,
): T {
  return { ...payload, equipment, icon: equipment };
}

/**
 * The category your own exercise shows under, from its muscles: the group
 * with the most main muscles (a tie goes to the first in MUSCLE_GROUPS
 * order); with no main muscle, the group with the most helping ones; with no
 * muscles, "Other". Every other group with a muscle becomes `categories`, in
 * MUSCLE_GROUPS order.
 */
export function derivedCategories(muscles: ExerciseMuscles): {
  category: string;
  categories: string[];
} {
  const main = new Map<MuscleGroup, number>();
  const any = new Map<MuscleGroup, number>();
  for (const muscle of MUSCLES) {
    const level = muscles[muscle];
    if (!level) continue;
    const group = MUSCLE_GROUP[muscle];
    any.set(group, (any.get(group) ?? 0) + 1);
    if (level === 1) main.set(group, (main.get(group) ?? 0) + 1);
  }
  const counts = main.size ? main : any;
  let category: MuscleGroup | null = null;
  for (const group of MUSCLE_GROUPS) {
    const count = counts.get(group) ?? 0;
    if (count > 0 && (category === null || count > counts.get(category)!))
      category = group;
  }
  if (!category) return { category: "Other", categories: [] };
  return {
    category,
    categories: MUSCLE_GROUPS.filter((g) => g !== category && any.has(g)),
  };
}

/** The draft with its category and `categories` derived from its chosen muscles. */
export function withDerivedCategory(data: CustomExercise): CustomExercise {
  const { category, categories } = derivedCategories(
    knownMuscles(data.muscles),
  );
  const { categories: _old, ...rest } = data;
  return categories.length
    ? { ...rest, category, categories }
    : { ...rest, category };
}

const squash = (text: string) => normalize(text).replace(/ /g, "");

/**
 * The catalogue exercise a typed name already is, by its stored (English)
 * or Swedish name, ignoring case, accents, spaces and punctuation
 * ("pallofpress" is Pallof Press). Your own exercises are left out.
 */
export function catalogueTwin<T extends { id: string; name: string }>(
  name: string,
  exercises: readonly T[],
): T | undefined {
  const key = squash(name);
  if (!key) return undefined;
  return exercises.find(
    (e) =>
      catalogueById.has(e.id) &&
      (squash(e.name) === key || squash(swedishName(e.id) ?? "") === key),
  );
}

/**
 * "Använd dess muskler": the draft with the catalogue exercise's muscles
 * and its equipment (when it is one your own exercise can have), and the
 * category that follows. The name stays as typed.
 */
export function withCatalogueMuscles(
  data: CustomExercise,
  exerciseId: string,
): CustomExercise {
  const builtin = catalogueById.get(exerciseId);
  if (!builtin) return data;
  const next: CustomExercise = {
    ...data,
    muscles: { ...musclesLookup({})(exerciseId) },
  };
  return withDerivedCategory(
    isCustomEquipment(builtin.equipment)
      ? withEquipment(next, builtin.equipment)
      : next,
  );
}
