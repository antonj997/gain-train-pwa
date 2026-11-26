// Your own exercise (v6 §D6, §E3): its equipment is a real choice that sets
// the icon, the filter and the weight step, and its category is derived from
// its muscles. Pure, so it is tested (tests/custom-exercise.test.ts).

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
