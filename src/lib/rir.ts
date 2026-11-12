// Reps in reserve (RIR): an optional, one-tap effort rating on a set. Pure, so
// it is tested (tests/rir.test.ts).
import { RIR_MAX, type WorkoutSet } from "../data/model";
import { t } from "../i18n";

/** A set's reps in reserve: 0, 1, 2, or 3 meaning "3 or more". */
export type Rir = 0 | 1 | 2 | 3;
/** The choices in the order they are offered. */
export const RIR_VALUES: readonly Rir[] = [0, 1, 2, 3];

/** The set's reps in reserve, or null when none was chosen or it is not valid. */
export function rirOf(set: Pick<WorkoutSet, "rir">): Rir | null {
  const value = set.rir;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= RIR_MAX
    ? (value as Rir)
    : null;
}

/** "0", "1", "2" or "3+": the value on its own, as a choice reads it. */
export const rirValueText = (rir: Rir) =>
  rir >= RIR_MAX ? `${RIR_MAX}+` : String(rir);

/** "RIR 2", "RIR 3+"; empty for a set without one. */
export function rirLabel(set: Pick<WorkoutSet, "rir">): string {
  const rir = rirOf(set);
  return rir === null ? "" : t("rir.label", { value: rirValueText(rir) });
}

/**
 * The set with its reps in reserve chosen, or cleared with null. Values above
 * 3 store as 3 ("3+"); anything else that is not a whole number clears it.
 * Unlike other values, it can change on a checked set: it is picked after the
 * set is done.
 */
export function withRir(set: WorkoutSet, rir: number | null): WorkoutSet {
  const result = { ...set };
  if (rir === null || !Number.isInteger(rir) || rir < 0) delete result.rir;
  else result.rir = Math.min(rir, RIR_MAX);
  return result;
}
