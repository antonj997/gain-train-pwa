import type { Library } from "../data/model";
import type { WeightUnit } from "./units";

/**
 * Each exercise's own weight unit. The default is the device's (Settings,
 * training preferences); an exercise switched to the other unit from its kg
 * or lb heading keeps that unit in the synced library's `weightUnits`, by
 * exercise id, built-in or custom. Weights are stored in kg either way, so a
 * unit only changes how that exercise's weights are shown and typed.
 */
export type WeightUnitOverrides = Readonly<Record<string, WeightUnit>>;

const isUnit = (value: unknown): value is WeightUnit =>
  value === "kg" || value === "lb";

/** The saved overrides; a value this app does not know is left out. */
export function weightUnitOverrides(
  library: Pick<Library, "weightUnits">,
): Record<string, WeightUnit> {
  const out: Record<string, WeightUnit> = {};
  for (const [id, unit] of Object.entries(library.weightUnits ?? {}))
    if (isUnit(unit)) out[id] = unit;
  return out;
}

/** An exercise's unit: its own if it has one, else the default. */
export const exerciseWeightUnit = (
  overrides: WeightUnitOverrides,
  exerciseId: string,
  fallback: WeightUnit,
): WeightUnit =>
  Object.prototype.hasOwnProperty.call(overrides, exerciseId) &&
  isUnit(overrides[exerciseId])
    ? overrides[exerciseId]
    : fallback;

/**
 * The library with one exercise's unit chosen. The default unit clears the
 * exercise's own, so it follows the default again when Settings changes it.
 * Other exercises' units (and values a newer app saved) are kept.
 */
export function withExerciseWeightUnit(
  library: Library,
  exerciseId: string,
  unit: WeightUnit,
  defaultUnit: WeightUnit,
): Library {
  const { [exerciseId]: _old, ...others } = library.weightUnits ?? {};
  const next =
    unit === defaultUnit ? others : { ...others, [exerciseId]: unit };
  return { ...library, weightUnits: next };
}
