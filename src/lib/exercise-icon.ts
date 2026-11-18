// Which icon an exercise shows in its avatar, routine badge and Library
// glyphs, and the tint behind it. Pure, so it is tested
// (tests/exercise-icon.test.ts).
import { catalogueById } from "../data/catalogue";
import type { RecordDoc } from "../data/model";
import type { ExerciseMuscles } from "../data/muscles";
import {
  MUSCLES_BY_NAME,
  customIconOf,
  customMuscles,
  isCardioExercise,
  musclesFromCategories,
} from "../data/exercise-muscles";
import type { EquipmentIconKind } from "../components/muscles/equipment-shapes";

export type ExerciseIconChoice =
  | { kind: "muscles"; muscles: ExerciseMuscles; cardio: boolean }
  | { kind: "equipment"; equipment: EquipmentIconKind };

const DUMBBELL: ExerciseIconChoice = {
  kind: "equipment",
  equipment: "dumbbell",
};
const NO_MUSCLES: ExerciseMuscles = {};

/**
 * The icon an exercise shows: a built-in one its muscle figure (the heart
 * figure for cardio); your own exercise its chosen equipment glyph, or the
 * muscle figure when it chose "body"; a shared exercise (its icon isn't
 * shared) the dumbbell. A built-in id this version doesn't know goes by the
 * category it came with.
 */
export function exerciseIcon(
  records: Record<string, RecordDoc>,
  exerciseId: string,
  category?: string,
): ExerciseIconChoice {
  const builtin = catalogueById.get(exerciseId);
  if (builtin) {
    if (isCardioExercise(builtin))
      return { kind: "muscles", muscles: NO_MUSCLES, cardio: true };
    return {
      kind: "muscles",
      muscles:
        MUSCLES_BY_NAME[builtin.name] ??
        musclesFromCategories(builtin.category, builtin.categories),
      cardio: false,
    };
  }
  const record = records[exerciseId];
  if (record?.kind === "exercise") {
    const icon = customIconOf(record.payload);
    if (icon !== "body") return { kind: "equipment", equipment: icon };
    return {
      kind: "muscles",
      muscles: customMuscles(record.payload),
      cardio: isCardioExercise(record.payload),
    };
  }
  if (exerciseId.startsWith("builtin:")) {
    if (category === "Cardio")
      return { kind: "muscles", muscles: NO_MUSCLES, cardio: true };
    const muscles = musclesFromCategories(category);
    if (Object.keys(muscles).length)
      return { kind: "muscles", muscles, cardio: false };
  }
  return DUMBBELL;
}

/** The CSS key of a main category's tint: "full-body"; anything unknown is "other". */
export function categoryTone(category: string | undefined): string {
  const known = [
    "Chest",
    "Back",
    "Shoulders",
    "Arms",
    "Legs",
    "Glutes",
    "Core",
    "Cardio",
    "Full body",
  ];
  return category && known.includes(category)
    ? category.toLowerCase().replace(" ", "-")
    : "other";
}
