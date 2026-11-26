// The rest time an exercise gets when the rest timer is on and neither the
// exercise nor "all exercises" has its own (v6 §D7, effectiveRest in
// preferences.ts). Pure, so it is tested (tests/rest-tiers.test.ts).
import { catalogueById } from "./catalogue";
import type { ExerciseMuscles } from "./muscles";

/** Barbell compound 2:30, other compound 2:00, isolation 1:30. */
export type RestTier = 150 | 120 | 90;
export const REST_TIERS = {
  barbellCompound: 150,
  compound: 120,
  isolation: 90,
} as const satisfies Record<string, RestTier>;

/**
 * The catalogue's single-joint lifts, by catalogue name: flyes, pulldowns and
 * pullovers with straight arms, back and hip extensions, raises, shrugs,
 * curls, triceps extensions and pushdowns, leg curls and extensions, calf
 * raises, adduction and abduction, kickbacks, and crunch-type and held core
 * work. Everything else in the catalogue is a compound lift.
 */
export const ISOLATION_EXERCISES: ReadonlySet<string> = new Set([
  // Chest
  "Dumbbell Fly",
  "Incline Dumbbell Fly",
  "Cable Fly",
  "Cable Crossover",
  "Pec Deck Machine",
  // Back
  "Straight Arm Pulldown",
  "Dumbbell Pullover",
  "Hyperextension",
  "Superman",
  // Shoulders
  "Lateral Raise",
  "Cable Lateral Raise",
  "Front Raise",
  "Rear Delt Fly",
  "Cable Rear Delt Fly",
  "Reverse Pec Deck",
  "Shrugs",
  "Barbell Shrug",
  "Band Pull Apart",
  // Arms
  "Dumbbell Curl",
  "Barbell Curl",
  "EZ Bar Curl",
  "Hammer Curl",
  "Incline Dumbbell Curl",
  "Preacher Curl",
  "Concentration Curl",
  "Spider Curl",
  "Cable Curl",
  "Machine Curl",
  "Reverse Curl",
  "Wrist Curl",
  "Tricep Pushdown",
  "Rope Pushdown",
  "Reverse Grip Pushdown",
  "Cable Tricep Extension",
  "Overhead Tricep Extension",
  "Cable Overhead Tricep Extension",
  "Skull Crusher",
  "Dumbbell Tricep Kickback",
  "Machine Tricep Extension",
  // Legs
  "Leg Extension",
  "Leg Curl",
  "Lying Leg Curl",
  "Seated Leg Curl",
  "Nordic Hamstring Curl",
  "Hip Adduction Machine",
  "Calf Raise",
  "Standing Calf Raise",
  "Seated Calf Raise",
  "Wall Sit",
  // Glutes
  "Cable Kickback",
  "Glute Kickback Machine",
  "Hip Abduction Machine",
  "Reverse Hyperextension",
  "Banded Lateral Walk",
  // Core
  "Plank",
  "Side Plank",
  "Hollow Hold",
  "L-Sit",
  "Ab Wheel",
  "Cable Crunch",
  "Machine Crunch",
  "Crunch",
  "Sit Up",
  "Bicycle Crunch",
  "V-Up",
  "Leg Raise",
  "Hanging Leg Raise",
  "Toes To Bar",
  "Russian Twist",
  "Cable Woodchop",
  "Pallof Press",
  "Dumbbell Side Bend",
  "Dead Bug",
  "Mountain Climber",
]);

const BARBELL = new Set(["barbell", "smith"]);

/**
 * An exercise's rest tier. A built-in exercise goes by its catalogue entry
 * (name and equipment), whatever name its record kept; your own exercise is
 * an isolation lift when it has exactly one main muscle. A compound lift on a
 * barbell or smith machine gets 2:30, any other 2:00.
 */
export function restTier(exercise: {
  id: string;
  name: string;
  equipment?: string | null;
  muscles: ExerciseMuscles;
  custom?: boolean;
}): RestTier {
  const entry = exercise.custom ? undefined : catalogueById.get(exercise.id);
  const equipment = entry?.equipment ?? exercise.equipment ?? undefined;
  const isolation = entry
    ? ISOLATION_EXERCISES.has(entry.name)
    : exercise.custom
      ? Object.values(exercise.muscles).filter((level) => level === 1)
          .length === 1
      : ISOLATION_EXERCISES.has(exercise.name);
  if (isolation) return REST_TIERS.isolation;
  return equipment && BARBELL.has(equipment)
    ? REST_TIERS.barbellCompound
    : REST_TIERS.compound;
}
