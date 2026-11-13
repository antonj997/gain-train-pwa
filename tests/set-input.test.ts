import test from "node:test";
import assert from "node:assert/strict";
import {
  createSetInputSelection,
  isUnfinishedInput,
  parseSetNumber,
  changeSetNumber,
  getSetInputText,
  isSetInputEditKey,
} from "../src/lib/set-input";
import { isTap } from "../src/lib/touch";
import {
  changeSetLoad,
  changeSetMeasure,
  changeExtraWeight,
} from "../src/lib/set-load";
import { newSet, validSet, validate, type Workout } from "../src/data/model";
import {
  parseWorkoutDraft,
  parseRoutineDraft,
  writeDraft,
  readDraft,
} from "../src/lib/drafts";
import { getSetIssues } from "../src/lib/workout-editor";

function input() {
  const captures = new Set<number>();
  const ranges: [number, number][] = [];
  const focus: unknown[] = [];
  let selects = 0;
  const field = {
    value: "125.5",
    readOnly: false,
    focus: (options: unknown) => focus.push(options),
    select: () => selects++,
    setSelectionRange: (a: number, b: number) => ranges.push([a, b]),
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id),
  };
  let prevented = 0;
  const event = (x: number, y: number, pointerId = 1) => ({
    currentTarget: field as unknown as HTMLInputElement,
    pointerId,
    clientX: x,
    clientY: y,
    button: 0,
    isPrimary: true,
    preventDefault: () => prevented++,
  });
  return {
    field,
    captures,
    ranges,
    focus,
    event,
    selects: () => selects,
    prevented: () => prevented,
  };
}

test("a tap selects all, while a selection dragged below a set input is captured and bounded horizontally", () => {
  const host = input();
  const selection = createSetInputSelection((_, x) =>
    Math.max(0, Math.min(5, Math.round(x / 10))),
  );
  selection.onPointerDown(host.event(10, 20));
  assert.deepEqual(host.focus, [{ preventScroll: true }]);
  assert.equal(host.selects(), 1);
  assert.equal(host.captures.has(1), true);
  selection.onPointerMove(host.event(30, 900));
  assert.deepEqual(host.ranges.at(-1), [1, 3]);
  selection.onPointerMove(host.event(1000, 1600));
  assert.deepEqual(host.ranges.at(-1), [1, 5]);
  assert.equal(host.prevented(), 3);
  selection.onPointerUp(host.event(1000, 1600));
  assert.equal(host.captures.size, 0);
  selection.onClick({
    currentTarget: host.field as unknown as HTMLInputElement,
    detail: 1,
    preventDefault() {},
  });
  assert.equal(
    host.selects(),
    1,
    "the synthesized click must not overwrite a partial selection",
  );
});

test("another pointer cannot move a selection; cancel and disposal release capture", () => {
  const host = input();
  const selection = createSetInputSelection((_, x) => Math.round(x / 10));
  selection.onPointerDown(host.event(10, 20));
  selection.onPointerMove(host.event(30, 50, 2));
  assert.equal(host.ranges.length, 0);
  selection.onPointerCancel(host.event(10, 20));
  assert.equal(host.captures.size, 0);
  selection.onPointerDown(host.event(10, 20));
  selection.dispose();
  assert.equal(host.captures.size, 0);
});

test("a tap on a locked input warns without focusing, selecting, or starting a drag", () => {
  const host = input();
  host.field.readOnly = true;
  let warnings = 0;
  const selection = createSetInputSelection(
    () => 0,
    () => warnings++,
  );
  selection.onPointerDown({ ...host.event(10, 20), timeStamp: 1000 });
  assert.equal(warnings, 0, "the notice waits for the tap to end");
  assert.equal(host.prevented(), 0, "scrolling must stay possible");
  assert.equal(selection.pointerFocus(1050), true);
  selection.onPointerUp({ ...host.event(14, 24), timeStamp: 1150 });
  assert.equal(warnings, 1);
  assert.equal(host.selects(), 0);
  assert.equal(host.focus.length, 0);
  assert.equal(host.captures.size, 0);
  assert.equal(host.prevented(), 0);
  // The click that follows a tap does not warn twice; a keyboard click does.
  const click = (detail: number) =>
    selection.onClick({
      currentTarget: host.field as unknown as HTMLInputElement,
      detail,
      preventDefault() {},
    });
  click(1);
  assert.equal(warnings, 1);
  click(0);
  assert.equal(warnings, 2);
  // Focus long after any pointer comes from the keyboard.
  assert.equal(selection.pointerFocus(5000), false);
});

test("a drag that starts on a locked input scrolls instead of warning", () => {
  const host = input();
  host.field.readOnly = true;
  let warnings = 0;
  const selection = createSetInputSelection(
    () => 0,
    () => warnings++,
  );
  // Moved too far.
  selection.onPointerDown({ ...host.event(10, 200), timeStamp: 0 });
  selection.onPointerUp({ ...host.event(12, 120), timeStamp: 200 });
  // Held too long.
  selection.onPointerDown({ ...host.event(10, 200), timeStamp: 1000 });
  selection.onPointerUp({ ...host.event(10, 200), timeStamp: 1800 });
  // Taken over by the browser to scroll.
  selection.onPointerDown({ ...host.event(10, 200), timeStamp: 3000 });
  selection.onPointerCancel(host.event(10, 200));
  selection.onPointerUp({ ...host.event(10, 200), timeStamp: 3100 });
  assert.equal(warnings, 0);
  assert.equal(host.prevented(), 0);
});

test("isTap allows 10 px and 500 ms, and never a scroll", () => {
  const start = { x: 100, y: 100, time: 0 };
  assert.equal(isTap(start, { x: 106, y: 108, time: 499 }), true);
  assert.equal(isTap(start, { x: 100, y: 111, time: 100 }), false);
  assert.equal(isTap(start, { x: 100, y: 100, time: 501 }), false);
  assert.equal(isTap(start, { x: 100, y: 100, time: 100 }, true), false);
  assert.equal(isTap(start, { x: 100, y: 100, time: -5 }), false);
});

test("decimal and comma entry remains numeric while malformed entries cannot become a valid saved value", () => {
  assert.equal(parseSetNumber(""), null);
  assert.equal(parseSetNumber("  "), null);
  assert.equal(parseSetNumber("72,5"), 72.5);
  assert.equal(parseSetNumber("75."), 75);
  assert.equal(parseSetNumber("-2"), -2);
  assert.ok(Number.isNaN(parseSetNumber("-")));
  assert.ok(Number.isNaN(parseSetNumber("1e3")));
  assert.ok(Number.isNaN(parseSetNumber("Infinity")));
});

test("unfinished numeric text survives set remounts and draft recovery without entering saved records", () => {
  const original = { ...newSet(), weight: 75, reps: 8 };
  const set = changeSetNumber(original, "weight", null, "1e");
  assert.equal(set.weight, null);
  assert.equal(getSetInputText(set, "weight"), "1e");
  assert.equal(validSet(set), false);
  assert.match(getSetIssues(set).weight ?? "", /number|weight|kg/i);
  const workout: Workout = {
    name: "Test",
    date: "2026-10-26",
    status: "draft",
    duration: null,
    startedAt: 1,
    exercises: [
      {
        id: crypto.randomUUID(),
        name: "Bench",
        exerciseId: "bench",
        sets: [set],
      },
    ],
  };
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  assert.equal(writeDraft(storage, "test", workout), true);
  const recovered = readDraft(storage, "test", parseWorkoutDraft)!;
  assert.equal(getSetInputText(recovered.exercises[0].sets[0], "weight"), "1e");
  assert.throws(() => validate("workout", recovered), /finish entering/i);
  const routine = parseRoutineDraft({
    id: crypto.randomUUID(),
    data: { name: "Plan", exercises: workout.exercises },
  })!;
  assert.equal(
    getSetInputText(routine.data.exercises[0].sets[0], "weight"),
    "1e",
  );
  const corrected = changeSetNumber(set, "weight", 12.5);
  assert.equal(getSetInputText(corrected, "weight"), undefined);
  assert.equal(validSet(corrected), true);
  const saved = validate("workout", {
    ...workout,
    exercises: [{ ...workout.exercises[0], sets: [corrected] }],
  }) as Workout;
  assert.equal(saved.exercises[0].sets[0].weight, 12.5);
  assert.equal("inputText" in saved.exercises[0].sets[0], false);
  assert.equal(
    changeSetNumber({ ...original, done: true }, "weight", 90).weight,
    75,
  );
});

test("locked fields allow copy, select-all and browser shortcuts, while mode changes clear only discarded input", () => {
  for (const key of ["c", "a", "f"]) {
    assert.equal(isSetInputEditKey({ key, ctrlKey: true }), false);
    assert.equal(isSetInputEditKey({ key, metaKey: true }), false);
  }
  assert.equal(isSetInputEditKey({ key: "Backspace" }), true);
  assert.equal(isSetInputEditKey({ key: "2" }), true);
  assert.equal(isSetInputEditKey({ key: "Tab" }), false);
  const both = changeSetNumber(
    changeSetNumber(newSet(), "weight", null, "."),
    "reps",
    null,
    "-",
  );
  const bw = changeSetLoad(both, "bodyweight");
  assert.equal(getSetInputText(bw, "weight"), undefined);
  assert.equal(getSetInputText(bw, "reps"), "-");
  const timed = changeSetMeasure(bw, "seconds");
  assert.equal(getSetInputText(timed, "reps"), undefined);
  const extra = changeSetNumber(
    changeExtraWeight(timed, true),
    "weight",
    null,
    ".",
  );
  assert.equal(
    getSetInputText(changeExtraWeight(extra, false), "weight"),
    undefined,
  );
});

test("a number pad field on a touch screen (inputmode none) never takes focus from a tap, but the tap still opens the pad", () => {
  const host = input();
  Object.assign(host.field, { inputMode: "none" });
  let taps = 0;
  const selection = createSetInputSelection(
    () => 0,
    undefined,
    () => ({ tap: () => taps++ }),
  );
  selection.onPointerDown(host.event(10, 20));
  assert.deepEqual(host.focus, []);
  assert.equal(host.selects(), 0);
  selection.onPointerUp(host.event(10, 20));
  assert.equal(taps, 1);
});

test('text kept beside a value (the number pad\'s "87,") is no fault; text with no value is unfinished', () => {
  const typed = changeSetNumber(
    newSet({ reps: 5, weight: 80, load: "weight" }),
    "weight",
    87,
    "87,",
  );
  assert.equal(getSetInputText(typed, "weight"), "87,");
  assert.equal(isUnfinishedInput(typed, "weight"), false);
  assert.equal(validSet(typed), true);
  assert.deepEqual(getSetIssues(typed), {});
  const broken = changeSetNumber(typed, "weight", null, "8x");
  assert.equal(isUnfinishedInput(broken, "weight"), true);
  assert.equal(validSet(broken), false);
  assert.ok(getSetIssues(broken).weight);
});
