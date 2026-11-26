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
import { t } from "../i18n";
export { DRAG_SLOP, DRAG_STEP_PX, dragIntent, dragSteps } from "./drag-step";

/**
 * The fields the pad types: the load and the reps, and with "Fråga efter
 * RIR" on (v6 B12) the reps in reserve, which its slider sets.
 */
export type PadField = "weight" | "reps" | "rir";
/** A field the pad's keys type (RIR takes the slider instead). */
export type PadKeyField = Exclude<PadField, "rir">;
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

/**
 * What a hardware key does on the pad while no field holds focus (a touch
 * screen with a keyboard attached): a digit, the decimal mark (either "." or
 * ","), backspace, or Enter for the pad's Next. Null for any other key.
 */
export function padKeyFor(key: string): PadKey | "next" | null {
  if (/^[0-9]$/.test(key)) return key as PadKey;
  if (key === "." || key === ",") return "decimal";
  if (key === "Backspace") return "backspace";
  if (key === "Enter") return "next";
  return null;
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

/** The default kg step: the barbell's (exercise-settings.ts). */
export const DEFAULT_KG_STEP = 2.5;

/**
 * One step of a field: the exercise's weight step in kg (v6 §D5; 2.5 when
 * not given), 5 lb in pounds, or 1 rep.
 */
export const padStep = (
  field: PadField,
  unit: WeightUnit,
  kgStep = DEFAULT_KG_STEP,
) => (field !== "weight" ? 1 : unit === "lb" ? 5 : kgStep);

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
  kgStep = DEFAULT_KG_STEP,
): number | null {
  if (!steps) return value;
  if (value === null && steps < 0) return null;
  const next = round((value ?? 0) + steps * padStep(field, unit, kgStep));
  return field !== "weight" ? Math.max(1, Math.round(next)) : Math.max(0, next);
}

/** One ± key in kg: `step` kg on a load, 1 on reps (v6 B1). */
export const stepValue = (
  field: PadField,
  value: number | null,
  direction: 1 | -1,
  step: number,
) => stepPadValue(value, direction, field, "kg", step);

/** The label of a step key: "+2,5", "−5", "+1". */
export function padStepLabel(
  field: PadField,
  unit: WeightUnit,
  direction: 1 | -1,
  mark = ".",
  kgStep = DEFAULT_KG_STEP,
) {
  return `${direction > 0 ? "+" : "−"}${padText(padStep(field, unit, kgStep), mark)}`;
}

/**
 * Why a key changed nothing (v6 B1), shown for a moment in place of the
 * pad's subline: a decimal on reps, backspace on an empty field, or a digit
 * past the field's length. Null when the key does something.
 */
export function padHint(
  key: PadKey,
  field: PadField,
  text: string,
  format: PadFormat = padFormat(field, "kg", text.includes(",") ? "," : "."),
): string | null {
  if (key === "decimal")
    return format.decimals === 0 ? t("pad.hintWhole") : null;
  if (key === "backspace") return text ? null : t("pad.hintEmpty");
  const digits = text.replace(format.mark, "").length;
  if (digits >= format.digits)
    return format.digits === 5 ? t("pad.hintFive") : t("pad.hintThree");
  return null;
}

/**
 * A drop's weight: 20 % under `kg`, rounded to the exercise's step (v6 B5:
 * 60 → 50 on a 5 kg step, 52.5 → 42.5 on 2.5). When that rounds back to
 * the weight it drops from (`from`, else `kg`), it goes one step lower;
 * never under 0.
 */
export function dropMinus20(kg: number, step: number, from = kg): number {
  const size = step > 0 ? step : DEFAULT_KG_STEP;
  let next = round(Math.round((kg * 0.8) / size) * size);
  if (next >= from) next = round(from - size);
  return Math.max(0, next);
}

/**
 * The fields of a set the pad types, in Next's order. A plain bodyweight set
 * and a set with no load have no load to type, a timed set counts seconds
 * (its own field) and cardio keeps its own inputs. With `askRir` (v6 B12) a
 * set of reps ends with its RIR; a drop takes its set's.
 */
export function padFields(set: WorkoutSet, askRir = false): PadField[] {
  if (set.measure === "cardio") return [];
  const fields: PadField[] = [];
  if (hasWeightField(set)) fields.push("weight");
  if (set.measure !== "seconds") fields.push("reps");
  if (askRir && rirField(set)) fields.push("rir");
  return fields;
}

/** Whether a set takes an RIR: a set of reps that is not a drop. */
export const rirField = (set: WorkoutSet) =>
  !isDrop(set) && set.measure !== "cardio" && set.measure !== "seconds";

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
export function padNext(
  exercises: PadExercise[],
  current: PadTarget,
  askRir = false,
): PadNext {
  const found = locate(exercises, current.setId);
  if (!found) return { kind: "close" };
  const { sets, index } = found;
  const { start, end } = dropGroup(sets, index);
  // A drop with no set above it (older app versions) has no check.
  const check: PadNext = isDrop(sets[start])
    ? { kind: "close" }
    : { kind: "check", setId: sets[start].id };
  // RIR comes last, once the set and its drops are typed (v6 B12).
  if (current.field === "rir") return check;
  const fields = padFields(sets[index]);
  const at = fields.indexOf(current.field);
  if (at >= 0 && at < fields.length - 1)
    return {
      kind: "field",
      target: { setId: current.setId, field: fields[at + 1] },
    };
  for (let i = index + 1; i < end; i++) {
    const next = padFields(sets[i]);
    if (next.length)
      return { kind: "field", target: { setId: sets[i].id, field: next[0] } };
  }
  if (askRir && !isDrop(sets[start]) && rirField(sets[start]))
    return { kind: "field", target: { setId: sets[start].id, field: "rir" } };
  return check;
}

/**
 * Where the pad goes once a set is checked: the first field of the next
 * unchecked set below that set's group in the same exercise. Nowhere (the pad
 * closes) at the end of the exercise, when that set has no field the pad
 * types, or when every set below is checked: it never jumps to another
 * exercise.
 */
export function padAfterCheck(
  exercises: PadExercise[],
  checkedId: string,
): PadTarget | null {
  const found = locate(exercises, checkedId);
  if (!found) return null;
  const { sets } = found;
  const group = dropGroup(sets, found.index);
  for (let i = group.end; i < sets.length; i++) {
    const set = sets[i];
    if (set.done) continue;
    const fields = padFields(set);
    return fields.length ? { setId: set.id, field: fields[0] } : null;
  }
  return null;
}

/** Where a field the pad types sits on screen (its box in the row). */
export type PadFieldBox = PadTarget & {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * The pad field under a point, or null. Hit by the fields' boxes rather than
 * the elements under the point, since an open sheet's backdrop covers the
 * page (and the page takes no pointer events while it is open).
 */
export function padFieldAt(
  boxes: readonly PadFieldBox[],
  x: number,
  y: number,
): PadTarget | null {
  const hit = boxes.find(
    (box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
  );
  return hit ? { setId: hit.setId, field: hit.field } : null;
}

/**
 * Whether an event on a digit, decimal, backspace or ± key presses it. Keys
 * press on pointerdown, like the phone's own keyboard: each finger (or pen,
 * or a mouse's main button) presses once, as it lands, so two quick or
 * overlapping taps both count. That pointer's click is ignored, since iOS
 * delays clicks and drops one when a second touch starts first. A click
 * with no pointer (detail 0: Enter or Space on a focused key, or assistive
 * technology) presses it too.
 */
export function padKeyPresses(event: {
  type: string;
  pointerType?: string;
  button?: number;
  detail?: number;
}): boolean {
  if (event.type === "pointerdown")
    return event.pointerType !== "mouse" || event.button === 0;
  if (event.type === "click") return event.detail === 0;
  return false;
}
