import { formatDecimal } from "../i18n";
import { local, storageKeys } from "./storage";

/**
 * The unit weights are shown and typed in. Storage is always kilograms:
 * pounds are only a way of showing a value and reading one typed in.
 */
export type WeightUnit = "kg" | "lb";

/** One international avoirdupois pound, exactly. */
export const KG_PER_LB = 0.45359237;

export const parseWeightUnit = (value: unknown): WeightUnit =>
  value === "lb" ? "lb" : "kg";

// The unit every label is built in, like the i18n module's language: helpers
// outside React read it here, and the training preferences change it.
let current: WeightUnit = parseWeightUnit(
  local.getItem(storageKeys.weightUnit),
);
export const getWeightUnit = () => current;
export function setCurrentWeightUnit(unit: WeightUnit) {
  current = unit;
}

const round = (value: number, decimals: number) => {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
};

/**
 * A stored kilogram value in the unit: kilograms as they are, pounds to one
 * decimal (a trailing ".0" drops when formatted).
 */
export function toUnit(kg: number, unit: WeightUnit = current): number {
  return unit === "lb" ? round(kg / KG_PER_LB, 1) : kg;
}

/**
 * A value typed in the unit, as kilograms to store. Pounds keep three decimals
 * (grams), so the stored value shows the same pounds again: no drift.
 */
export function fromUnit(value: number, unit: WeightUnit = current): number {
  return unit === "lb" ? round(value * KG_PER_LB, 3) : value;
}

/**
 * The number a set field shows. Pounds typed with two decimals ("132.25") come
 * back as typed, so a field never rewrites what was just entered; any other
 * stored value shows to one decimal like a label.
 */
export function toUnitField(kg: number, unit: WeightUnit = current): number {
  if (unit === "kg") return kg;
  const typed = round(kg / KG_PER_LB, 2);
  return fromUnit(typed, unit) === kg ? typed : round(kg / KG_PER_LB, 1);
}

/** A weight's number in the unit and the language: "60", "132.3", "132,3". */
export const formatWeightValue = (kg: number, unit: WeightUnit = current) =>
  formatDecimal(toUnit(kg, unit));

/** A weight with its unit: "60 kg", "132.3 lb". */
export const formatWeight = (kg: number, unit: WeightUnit = current) =>
  `${formatWeightValue(kg, unit)} ${unit}`;
