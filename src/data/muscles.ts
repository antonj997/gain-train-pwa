// The muscles the muscle map draws, and how much an exercise trains each.
// The detailed map (exercise page, plan status) shows every muscle; the small
// exercise icon groups them into zones. Ids are stored in custom exercises, so
// they never change.
import type { MuscleGroup } from "./muscle-sets";

export const MUSCLES = [
  "chest",
  "upperChest",
  "frontDelts",
  "sideDelts",
  "rearDelts",
  "biceps",
  "brachialis",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "traps",
  "upperBack",
  "lats",
  "lowerBack",
  "glutes",
  "abductors",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
  "soleus",
  "tibialis",
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** The muscle group (the app's categories) each muscle belongs to. */
export const MUSCLE_GROUP: Record<Muscle, MuscleGroup> = {
  chest: "Chest",
  upperChest: "Chest",
  frontDelts: "Shoulders",
  sideDelts: "Shoulders",
  rearDelts: "Shoulders",
  biceps: "Arms",
  brachialis: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  abs: "Core",
  obliques: "Core",
  traps: "Back",
  upperBack: "Back",
  lats: "Back",
  lowerBack: "Back",
  glutes: "Glutes",
  abductors: "Glutes",
  quads: "Legs",
  hamstrings: "Legs",
  adductors: "Legs",
  calves: "Legs",
  soleus: "Legs",
  tibialis: "Legs",
};

/**
 * How much an exercise trains a muscle: 1 for a main muscle (a set counts as
 * one set for it), 0.5 for a helping muscle (half a set). Muscles it does not
 * train are left out.
 */
export const MUSCLE_LEVELS = [1, 0.5] as const;
export type MuscleLevel = (typeof MUSCLE_LEVELS)[number];
export type ExerciseMuscles = Partial<Record<Muscle, MuscleLevel>>;

export const isMuscle = (value: string): value is Muscle =>
  (MUSCLES as readonly string[]).includes(value);
