import { z } from "zod";
import type { WorkoutSet } from "../data/model";
import { capturePointer, releasePointer } from "./pointer-capture";
import { isTap, type TapPoint } from "./touch";
import { dragIntent, dragSteps } from "./drag-step";

/**
 * What a press on an editable field can do besides select text: a tap (the
 * number pad opens) and a drag up or down that steps the value (`step` gets
 * the steps made so far and the change since the last call).
 */
export type SetInputGestures = {
  tap?: () => void;
  stepStart?: () => void;
  step?: (total: number, delta: number) => void;
  stepEnd?: () => void;
};

// Raw unfinished input belongs to local editor recovery, never saved records.
export const setInputTextSchema = z.object({
  weight: z.string().max(32).optional(),
  reps: z.string().max(32).optional(),
  durationSec: z.string().max(32).optional(),
  distanceM: z.string().max(32).optional(),
  level: z.string().max(32).optional(),
  calories: z.string().max(32).optional(),
  inclinePct: z.string().max(32).optional(),
  heartRate: z.string().max(32).optional(),
  holdSec: z.string().max(32).optional(),
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
    [
      "weight",
      "reps",
      "durationSec",
      "distanceM",
      "level",
      "calories",
      "inclinePct",
      "heartRate",
      "holdSec",
    ] as const
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

/** A checked set is left as it is, unless `unlocked` (editing a finished workout). */
export function changeSetNumber(
  set: WorkoutSet,
  field: InputField,
  value: number | null,
  unfinishedText?: string,
  unlocked = false,
): WorkoutSet {
  if (set.done && !unlocked) return set;
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
  timeStamp?: number;
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
 * A read-only (checked) field captures nothing: a drag that starts on it
 * scrolls the page, and only a real tap reports the locked attempt.
 */
export function createSetInputSelection(
  pointAt = inputCaretAtPoint,
  onLockedAttempt: () => void = () => {},
  gestures: () => SetInputGestures = () => ({}),
) {
  let gesture: {
    input: HTMLInputElement;
    pointerId: number;
    x: number;
    y: number;
    anchor: number;
    /** Undecided, a drag that steps the value, or a text selection. */
    mode: "pending" | "step" | "select";
    steps: number;
  } | null = null;
  let suppressClick = false;
  // A locked field's gesture: scrolling comes first, so it is only watched,
  // never prevented, and the notice waits for a real tap (isTap).
  let tap: (TapPoint & { pointerId: number; scrolled: boolean }) | null = null;
  let lastPointerAt = -Infinity;
  const onScroll = () => {
    if (tap) tap.scrolled = true;
  };
  const watchScroll = (on: boolean) => {
    if (typeof document === "undefined") return;
    if (on) document.addEventListener("scroll", onScroll, true);
    else document.removeEventListener("scroll", onScroll, true);
  };
  const endTap = () => {
    if (tap) watchScroll(false);
    tap = null;
  };
  const now = (event: { timeStamp?: number }) => event.timeStamp ?? Date.now();
  const release = () => {
    const active = gesture;
    gesture = null;
    endTap();
    if (active) releasePointer(active.input, active.pointerId);
    if (active?.mode === "step") gestures().stepEnd?.();
    return active;
  };
  return {
    onPointerDown(event: PointerInputEvent) {
      if (!event.isPrimary || event.button !== 0 || gesture) return;
      const input = event.currentTarget;
      lastPointerAt = now(event);
      if (input.readOnly) {
        endTap();
        tap = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          time: now(event),
          scrolled: false,
        };
        watchScroll(true);
        return;
      }
      event.preventDefault();
      // A field the number pad types on a touch screen never takes focus: on
      // iPhone each move of focus (and the checked field going away) hides
      // and shows the keyboard state and shifts the view, so the pad would
      // seem to close and open. The pad draws the field's ring itself.
      if (input.inputMode !== "none") {
        input.focus({ preventScroll: true });
        input.select();
      }
      suppressClick = true;
      gesture = {
        input,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        anchor: pointAt(input, event.clientX),
        mode: "pending",
        steps: 0,
      };
      capturePointer(input, event.pointerId);
    },
    onPointerMove(event: PointerInputEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      const handlers = gestures();
      if (gesture.mode === "pending") {
        const dx = event.clientX - gesture.x;
        const intent = handlers.step
          ? dragIntent(dx, event.clientY - gesture.y)
          : Math.abs(dx) < 4
            ? "pending"
            : "select";
        if (intent === "pending") return;
        gesture.mode = intent;
        if (intent === "step") handlers.stepStart?.();
      }
      if (gesture.mode === "step") {
        const steps = dragSteps(gesture.y, event.clientY);
        if (steps !== gesture.steps) {
          const delta = steps - gesture.steps;
          gesture.steps = steps;
          handlers.step?.(steps, delta);
        }
        return;
      }
      if (Math.abs(event.clientX - gesture.x) < 4) return;
      const target = pointAt(gesture.input, event.clientX);
      gesture.input.setSelectionRange(
        Math.min(gesture.anchor, target),
        Math.max(gesture.anchor, target),
        target < gesture.anchor ? "backward" : "forward",
      );
    },
    onPointerUp(event: PointerInputEvent) {
      lastPointerAt = now(event);
      if (tap?.pointerId === event.pointerId) {
        const start = tap;
        endTap();
        if (
          isTap(
            start,
            { x: event.clientX, y: event.clientY, time: now(event) },
            start.scrolled,
          )
        )
          onLockedAttempt();
        return;
      }
      if (gesture?.pointerId !== event.pointerId) return;
      event.preventDefault();
      // A press that did not step the value is a tap: the pad opens.
      if (release()?.mode !== "step") gestures().tap?.();
    },
    onPointerCancel(event: PointerInputEvent) {
      // The browser took the touch over to scroll.
      if (tap?.pointerId === event.pointerId) endTap();
      if (gesture?.pointerId === event.pointerId) release();
    },
    /**
     * Whether a focus belongs to a pointer that just went down or up; that
     * pointer's tap decides on the notice, so focus only warns from a keyboard.
     */
    pointerFocus(timeStamp = Date.now()) {
      return tap !== null || timeStamp - lastPointerAt < 1000;
    },
    onLostPointerCapture() {
      const active = gesture;
      gesture = null;
      if (active?.mode === "step") gestures().stepEnd?.();
    },
    onClick(event: {
      currentTarget: HTMLInputElement;
      detail: number;
      preventDefault: () => void;
    }) {
      event.preventDefault();
      // A tap on a locked field already warned on pointerup; a click with no
      // pointer (detail 0) comes from a keyboard or assistive technology.
      if (event.currentTarget.readOnly) {
        if (event.detail === 0) onLockedAttempt();
      } else if (!suppressClick || event.detail === 0)
        event.currentTarget.select();
      suppressClick = false;
    },
    dispose: () => {
      release();
    },
  };
}
