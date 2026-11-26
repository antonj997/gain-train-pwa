// Reps in reserve (RIR): an optional effort rating on a set, on v6's scale
// 0 (max), 1, 2, 3, 4, 5+ (easy). Pure, so it is tested
// (tests/load-none-rir-note.test.ts).
//
// Storage keeps the server's range: `rir` is 0–3, as the server trigger
// allows, and the finer 4 or 5 sits in the optional `rirHigh` behind a stored
// 3. A set with rir 3 and no rirHigh was written before v6, when 3 meant
// "3 or more", so it still reads "3+". Older apps keep rirHigh and read "3+",
// which stays true.
import { RIR_MAX, type WorkoutSet } from "../data/model";
import { t } from "../i18n";

/** A set's reps in reserve: 0 to 4, or 5 meaning "5 or more". */
export type Rir = 0 | 1 | 2 | 3 | 4 | 5;
/** The choices in the order they are offered. */
export const RIR_VALUES: readonly Rir[] = [0, 1, 2, 3, 4, 5];
/** The top of the scale; it reads "5+". */
export const RIR_TOP = 5;

type RirFields = Pick<WorkoutSet, "rir" | "rirHigh">;

const storedRir = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= RIR_MAX
    ? value
    : null;

/**
 * The set's reps in reserve, 0–5, or null when none was chosen or it is not
 * valid. rirHigh counts only behind a stored 3.
 */
export function rirOf(set: RirFields): Rir | null {
  const rir = storedRir(set.rir);
  if (rir === null) return null;
  if (rir === RIR_MAX && (set.rirHigh === 4 || set.rirHigh === 5))
    return set.rirHigh;
  return rir as Rir;
}

/** A set saved before v6 with rir 3, which then meant "3 or more". */
export const rirIsLegacyPlus = (set: RirFields) =>
  storedRir(set.rir) === RIR_MAX && rirOf(set) === RIR_MAX;

/**
 * "0" … "4" or "5+": the value on its own, as a choice reads it. A legacy
 * "3 or more" passes `legacyPlus` and reads "3+".
 */
export const rirValueText = (rir: Rir, legacyPlus = false) =>
  rir >= RIR_TOP || (legacyPlus && rir === RIR_MAX)
    ? `${rir}+`
    : String(rir);

/** A set's value text: rirValueText with the legacy "3+" applied. */
export function rirSetText(set: RirFields): string {
  const rir = rirOf(set);
  return rir === null ? "" : rirValueText(rir, rirIsLegacyPlus(set));
}

/** "RIR 2", "RIR 5+", a legacy "RIR 3+"; empty for a set without one. */
export function rirLabel(set: RirFields): string {
  const text = rirSetText(set);
  return text ? t("rir.label", { value: text }) : "";
}

/**
 * The set with its reps in reserve chosen (0–5, above 5 is 5+), or cleared
 * with null. 4 and 5 store as rir 3 with rirHigh; 0–3 drop rirHigh, so a
 * chosen 3 reads "3+" as before v6 (the two cannot be told apart in storage).
 * Anything that is not a whole number clears it. Unlike other values, it can
 * change on a checked set: it is picked after the set is done.
 */
export function withRir(set: WorkoutSet, rir: number | null): WorkoutSet {
  const result = { ...set };
  delete result.rirHigh;
  if (rir === null || !Number.isInteger(rir) || rir < 0) {
    delete result.rir;
    return result;
  }
  const value = Math.min(rir, RIR_TOP);
  if (value > RIR_MAX) {
    result.rir = RIR_MAX;
    result.rirHigh = value as 4 | 5;
  } else result.rir = value;
  return result;
}
