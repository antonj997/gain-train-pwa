import { z } from "zod";
import type { WorkoutSet } from "../data/model";
import { capturePointer, releasePointer } from "./pointer-capture";

// Raw unfinished input belongs to local editor recovery, never saved records.
export const setInputTextSchema = z.object({
  weight: z.string().max(32).optional(),
  reps: z.string().max(32).optional(),
  durationSec: z.string().max(32).optional(),
  distanceM: z.string().max(32).optional(),
  level: z.string().max(32).optional(),
  calories: z.string().max(32).optional(),
});
export type InputField = keyof z.infer<typeof setInputTextSchema>;
type EditableSet = WorkoutSet & {
  inputText?: z.infer<typeof setInputTextSchema>;
};

export function getSetInputText(set: WorkoutSet, field: InputField) {
  return (set as EditableSet).inputText?.[field];
}

export function hasSetInputText(set: WorkoutSet) {
  return (
    ["weight", "reps", "durationSec", "distanceM", "level", "calories"] as const
  ).some((field) => getSetInputText(set, field) !== undefined);
}

export function clearSetInputText(
  set: WorkoutSet,
  ...fields: InputField[]
): WorkoutSet {
  const result: EditableSet = { ...set };
  const inputText = { ...result.inputText };
  for (const field of fields) delete inputText[field];
  if (Object.keys(inputText).length) result.inputText = inputText;
  else delete result.inputText;
  return result;
}

export function changeSetNumber(
  set: WorkoutSet,
  field: InputField,
  value: number | null,
  unfinishedText?: string,
): WorkoutSet {
  if (set.done) return set;
  const next: EditableSet = clearSetInputText(
    { ...set, [field]: value },
    field,
  );
  if (unfinishedText !== undefined)
    next.inputText = { ...next.inputText, [field]: unfinishedText };
  return next;
}

export function isSetInputEditKey(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}) {
  return (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    (event.key.length === 1 || ["Backspace", "Delete"].includes(event.key))
  );
}

type PointerInputEvent = {
  currentTarget: HTMLInputElement;
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
  isPrimary: boolean;
  preventDefault: () => void;
};

export function parseSetNumber(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) return NaN;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Find a horizontal caret boundary without starting native selection scrolling. */
function inputCaretAtPoint(input: HTMLInputElement, clientX: number) {
  const style = input.ownerDocument.defaultView!.getComputedStyle(input);
  const context = input.ownerDocument.createElement("canvas").getContext("2d");
  const rect = input.getBoundingClientRect();
  const left = parseFloat(style.paddingLeft) || 0;
  const right = parseFloat(style.paddingRight) || 0;
  const border = parseFloat(style.borderLeftWidth) || 0;
  if (context)
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = (text: string) =>
    context?.measureText(text).width ??
    text.length * parseFloat(style.fontSize) * 0.6;
  const textWidth = width(input.value);
  const contentWidth = input.clientWidth - left - right;
  const alignment =
    style.textAlign === "center"
      ? Math.max(0, (contentWidth - textWidth) / 2)
      : 0;
  const x = clientX - rect.left - border - left - alignment + input.scrollLeft;
  for (let index = 0; index < input.value.length; index++) {
    if (
      x <
      (width(input.value.slice(0, index)) +
        width(input.value.slice(0, index + 1))) /
        2
    )
      return index;
  }
  return input.value.length;
}

/**
 * Only gestures beginning on this input are captured. Native selection dragging
 * is prevented, so moving below the field cannot ask the browser to scroll the
 * document. Keyboard selection and ordinary scrolling outside the input remain native.
 */
export function createSetInputSelection(
  pointAt = inputCaretAtPoint,
  onLockedAttempt: () => void = () => {},
) {
  let gesture: {
    input: HTMLInputElement;
    pointerId: number;
    x: number;
    anchor: number;
  } | null = null;
  let suppressClick = false;
  const release = () => {
    const active = gesture;
    gesture = null;
    if (active) releasePointer(active.input, active.pointerId);
  };
  return {
    onPointerDown(event: PointerInputEvent) {
      if (!event.isPrimary || event.button !== 0 || gesture) return;
      event.preventDefault();
      const input = event.currentTarget;
      if (input.readOnly) {
        onLockedAttempt();
        return;
      }
      input.focus({ preventScroll: true });
      input.select();
      suppressClick = true;
      gesture = {
        input,
        pointerId: event.pointerId,
        x: event.clientX,
        anchor: pointAt(input, event.clientX),
      };
      capturePointer(input, event.pointerId);
    },
    onPointerMove(event: PointerInputEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      if (Math.abs(event.clientX - gesture.x) < 4) return;
      const target = pointAt(gesture.input, event.clientX);
      gesture.input.setSelectionRange(
        Math.min(gesture.anchor, target),
        Math.max(gesture.anchor, target),
        target < gesture.anchor ? "backward" : "forward",
      );
    },
    onPointerUp(event: PointerInputEvent) {
      if (gesture?.pointerId !== event.pointerId) return;
      event.preventDefault();
      release();
    },
    onPointerCancel(event: PointerInputEvent) {
      if (gesture?.pointerId === event.pointerId) release();
    },
    onLostPointerCapture() {
      gesture = null;
    },
    onClick(event: {
      currentTarget: HTMLInputElement;
      detail: number;
      preventDefault: () => void;
    }) {
      event.preventDefault();
      if (event.currentTarget.readOnly) onLockedAttempt();
      else if (!suppressClick || event.detail === 0)
        event.currentTarget.select();
      suppressClick = false;
    },
    dispose: release,
  };
}
