/**
 * The workout's number pad (mockup v5, B7): what each key does to the text
 * being typed, the ±2.5 kg (±5 lb) and ±1 rep steps, the drag on a field that
 * steps without the pad, and where Next goes (kg → reps → the drops → check
 * the set → the next set's kg). Pure, so it is tested; the pad itself is
 * components/workout/NumberPad.tsx.
 */
import type { WorkoutSet } from "../data/model";
import { dropGroup, isDrop } from "../data/drops";
import { hasWeightField } from "./set-load";
import type { WeightUnit } from "./units";
export { DRAG_SLOP, DRAG_STEP_PX, dragIntent, dragSteps } from "./drag-step";

/** The two fields the pad types: the load and the reps. */
export type PadField = "weight" | "reps";
export type PadKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "decimal"
  | "backspace";

/**
 * The text on the field. `fresh` until the first key: the next digit
 * replaces the text instead of adding to it, as a selected field would.
 */
export type PadEntry = { text: string; fresh: boolean };

export type PadFormat = {
  /** The language's decimal mark, "." or ",". */
  mark: string;
  /** Decimals allowed: 2 for kg, 1 for lb, 0 for reps. */
  decimals: number;
  /** Digits allowed in all, decimals included. */
  digits: number;
};

/** How a field's text is typed: kg to two decimals, lb to one, reps whole. */
export function padFormat(
  field: PadField,
  unit: WeightUnit,
  mark: string,
): PadFormat {
  return field === "reps"
    ? { mark, decimals: 0, digits: 3 }
    : { mark, decimals: unit === "lb" ? 1 : 2, digits: 5 };
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** A value as the pad writes it: "87,5", "120", "" for none. */
export function padText(value: number | null, mark = "."): string {
  if (value === null || !Number.isFinite(value)) return "";
  return String(round(value)).replace(".", mark);
}

/** The pad's text as a number; null when empty. Either decimal mark reads. */
export function padValue(text: string): number | null {
  const value = text.replace(",", ".");
  if (!value || value === ".") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The text after one key. Keys that would break the format do nothing. */
export function pressPadKey(
  entry: PadEntry,
  key: PadKey,
  format: PadFormat,
): PadEntry {
  const { text, fresh } = entry;
  if (key === "backspace")
    return { text: fresh ? "" : text.slice(0, -1), fresh: false };
  if (key === "decimal") {
    if (format.decimals === 0) return entry;
    if (fresh || !text) return { text: `0${format.mark}`, fresh: false };
    if (text.includes(format.mark)) return entry;
    return { text: text + format.mark, fresh: false };
  }
  if (fresh || text === "0") return { text: key, fresh: false };
  const [, decimals = ""] = text.split(format.mark);
  const digits = text.replace(format.mark, "").length;
  if (digits >= format.digits) return entry;
  if (text.includes(format.mark) && decimals.length >= format.decimals)
    return entry;
  return { text: text + key, fresh: false };
}

/** One step of a field: 2.5 kg, 5 lb or 1 rep. */
export const padStep = (field: PadField, unit: WeightUnit) =>
  field === "reps" ? 1 : unit === "lb" ? 5 : 2.5;

/**
 * A value `steps` steps on (negative steps back). A load never goes under 0
 * and reps never under 1; an empty field steps up from 0 and stays empty
 * stepping down.
 */
export function stepPadValue(
  value: number | null,
  steps: number,
  field: PadField,
  unit: WeightUnit,
): number | null {
  if (!steps) return value;
  if (value === null && steps < 0) return null;
  const next = round((value ?? 0) + steps * padStep(field, unit));
  return field === "reps" ? Math.max(1, Math.round(next)) : Math.max(0, next);
}

/** The label of a step key: "+2,5", "−5", "+1". */
export function padStepLabel(
  field: PadField,
  unit: WeightUnit,
  direction: 1 | -1,
  mark = ".",
) {
  return `${direction > 0 ? "+" : "−"}${padText(padStep(field, unit), mark)}`;
}

/**
 * The fields of a set the pad types, in Next's order. A plain bodyweight set
 * and a set with no load have no load to type, a timed set counts seconds
 * (its own field) and cardio keeps its own inputs.
 */
export function padFields(set: WorkoutSet): PadField[] {
  if (set.measure === "cardio") return [];
  const fields: PadField[] = [];
  if (hasWeightField(set)) fields.push("weight");
  if (set.measure !== "seconds") fields.push("reps");
  return fields;
}

export type PadTarget = { setId: string; field: PadField };
type PadExercise = { sets: WorkoutSet[] };

/** What Next does: move to another field, check a set, or close the pad. */
export type PadNext =
  | { kind: "field"; target: PadTarget }
  | { kind: "check"; setId: string }
  | { kind: "close" };

function locate(exercises: PadExercise[], setId: string) {
  for (const exercise of exercises) {
    const index = exercise.sets.findIndex((s) => s.id === setId);
    if (index >= 0) return { sets: exercise.sets, index };
  }
  return null;
}

/**
 * Where Next goes from a field: the set's reps after its load, then each of
 * its drops in turn, then a check of the set (drops are checked with it).
 */
export function padNext(exercises: PadExercise[], current: PadTarget): PadNext {
  const found = locate(exercises, current.setId);
  if (!found) return { kind: "close" };
  const { sets, index } = found;
  const fields = padFields(sets[index]);
  const at = fields.indexOf(current.field);
  if (at >= 0 && at < fields.length - 1)
    return {
      kind: "field",
      target: { setId: current.setId, field: fields[at + 1] },
    };
  const { start, end } = dropGroup(sets, index);
  for (let i = index + 1; i < end; i++) {
    const next = padFields(sets[i]);
    if (next.length)
      return { kind: "field", target: { setId: sets[i].id, field: next[0] } };
  }
  // A drop with no set above it (older app versions) has no check.
  if (isDrop(sets[start])) return { kind: "close" };
  return { kind: "check", setId: sets[start].id };
}

/**
 * Where the pad goes once a set is checked: the first field of the first
 * unchecked set in the workout outside that set's group, or nowhere when that
 * set has no field the pad types (or every set is checked).
 */
export function padAfterCheck(
  exercises: PadExercise[],
  checkedId: string,
): PadTarget | null {
  const found = locate(exercises, checkedId);
  const group = found ? dropGroup(found.sets, found.index) : null;
  for (const exercise of exercises)
    for (let i = 0; i < exercise.sets.length; i++) {
      const set = exercise.sets[i];
      if (set.done) continue;
      if (
        found &&
        group &&
        exercise.sets === found.sets &&
        i >= group.start &&
        i < group.end
      )
        continue;
      const fields = padFields(set);
      return fields.length ? { setId: set.id, field: fields[0] } : null;
    }
  return null;
}
