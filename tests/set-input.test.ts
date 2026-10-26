import test from "node:test";
import assert from "node:assert/strict";
import {
  createSetInputSelection,
  parseSetNumber,
  changeSetNumber,
  getSetInputText,
  isSetInputEditKey,
} from "../src/lib/set-input";
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

test("locked input gestures warn without focusing, selecting, or starting a drag", () => {
  const host = input();
  host.field.readOnly = true;
  let warnings = 0;
  const selection = createSetInputSelection(
    () => 0,
    () => warnings++,
  );
  selection.onPointerDown(host.event(10, 20));
  assert.equal(warnings, 1);
  assert.equal(host.selects(), 0);
  assert.equal(host.focus.length, 0);
  assert.equal(host.captures.size, 0);
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
