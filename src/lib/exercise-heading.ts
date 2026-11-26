/**
 * The exercise heading's two lines in a live workout (v6 B1): the equipment
 * and its weight step ("Hantlar ±2 · kg per hand · per ben"), and the rep
 * range with the working sets counted live ("5–7 reps · 3 set"). Pure, so it
 * is tested (tests/exercise-heading.test.ts); the card is ExerciseCard.tsx.
 */
import { catalogueById } from "../data/catalogue";
import { formatDecimal, t, type MessageKey } from "../i18n";
import type { WeightUnit } from "./units";

const EQUIPMENT_KEYS: Readonly<Record<string, MessageKey>> = {
  barbell: "exercise.equip.barbell",
  dumbbell: "exercise.equip.dumbbell",
  machine: "exercise.equip.machine",
  cable: "exercise.equip.cable",
  kettlebell: "exercise.equip.kettlebell",
  bodyweight: "exercise.equip.bodyweight",
  band: "exercise.equip.band",
  smith: "exercise.equip.smith",
};

/** The step pounds use whatever the exercise's kg step: 5 lb (targets.ts). */
const LB_STEP = 5;

/**
 * Single-leg lifts by catalogue name: the load and reps are per leg. Any
 * catalogue name that starts "Single Leg" counts too.
 */
const PER_LEG = new Set([
  "Bulgarian Split Squat",
  "Split Squat",
  "Pistol Squat",
  "Single Leg Hip Thrust",
  "Single Leg Romanian Deadlift",
]);

/** Whether a built-in exercise is done one leg at a time. */
export function isPerLeg(exerciseId: string): boolean {
  const name = catalogueById.get(exerciseId)?.name;
  return !!name && (PER_LEG.has(name) || name.startsWith("Single Leg"));
}

/**
 * "Skivstång ±2,5", "Hantlar ±2 · kg per hand · per ben". Empty for an
 * exercise without a known equipment (the caller then shows no line).
 */
export function headingMeta({
  equipment,
  step,
  perHand = false,
  perLeg = false,
  unit = "kg",
}: {
  equipment?: string | null;
  /** The exercise's weight step in kg (weightStepOf). */
  step: number;
  /** Dumbbells: the weight is per hand. */
  perHand?: boolean;
  perLeg?: boolean;
  unit?: WeightUnit;
}): string {
  const key = equipment ? EQUIPMENT_KEYS[equipment] : undefined;
  if (!key) return "";
  const shown = unit === "lb" ? LB_STEP : step;
  const parts = [`${t(key)} ±${formatDecimal(shown)}`];
  if (perHand) parts.push(t("exercise.perHand", { unit }));
  if (perLeg) parts.push(t("exercise.perLeg"));
  return parts.join(" · ");
}

/** "5–7 reps · 3 set", or "3 set" with no range. */
export function headingRange(
  repRange: { min: number; max: number } | undefined | null,
  workingSets: number,
): string {
  const sets = t("count.set", { count: workingSets });
  if (!repRange) return sets;
  const range =
    repRange.min === repRange.max
      ? String(repRange.min)
      : `${repRange.min}–${repRange.max}`;
  return t("exercise.rangeLine", { range, sets });
}
