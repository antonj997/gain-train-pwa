import { t, type MessageKey } from "../i18n";

// Categories and equipment are stored in English (records and the shared
// library refer to them); only their labels follow the chosen language.
const CATEGORY_KEYS: Record<string, MessageKey> = {
  Chest: "category.Chest",
  Back: "category.Back",
  Shoulders: "category.Shoulders",
  Arms: "category.Arms",
  Legs: "category.Legs",
  Glutes: "category.Glutes",
  Core: "category.Core",
  Cardio: "category.Cardio",
  "Full body": "category.FullBody",
  Other: "category.Other",
};
const EQUIPMENT_KEYS: Record<string, MessageKey> = {
  barbell: "equipment.barbell",
  dumbbell: "equipment.dumbbell",
  machine: "equipment.machine",
  cable: "equipment.cable",
  bodyweight: "equipment.bodyweight",
  kettlebell: "equipment.kettlebell",
  band: "equipment.band",
  smith: "equipment.smith",
  "cardio machine": "equipment.cardioMachine",
};

/** A category's name to show ("Legs", "Ben"); an unknown one as stored. */
export const categoryLabel = (category: string) =>
  CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category;

/** An equipment type's name to show ("barbell", "skivstång"); an unknown one as stored. */
export const equipmentLabel = (equipment: string) =>
  EQUIPMENT_KEYS[equipment] ? t(EQUIPMENT_KEYS[equipment]) : equipment;
