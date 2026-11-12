import test from "node:test";
import assert from "node:assert/strict";
import type { WorkoutSet } from "../src/data/model";
import {
  dragIntent,
  dragSteps,
  padAfterCheck,
  padFields,
  padFormat,
  padNext,
  padStepLabel,
  padText,
  padValue,
  pressPadKey,
  stepPadValue,
  type PadEntry,
  type PadKey,
} from "../src/lib/number-pad";

const kg = padFormat("weight", "kg", ",");
const lb = padFormat("weight", "lb", ".");
const reps = padFormat("reps", "kg", ",");
const type = (
  keys: PadKey[],
  format = kg,
  start: PadEntry = { text: "87,5", fresh: true },
) => keys.reduce((entry, key) => pressPadKey(entry, key, format), start).text;

test("the first digit replaces what the field showed, the next ones add", () => {
  assert.equal(type(["9"]), "9");
  assert.equal(type(["9", "0"]), "90");
  assert.equal(type(["0", "5"]), "5");
});

test("one decimal mark, in the language's own, and only for a load", () => {
  assert.equal(type(["decimal"]), "0,");
  assert.equal(type(["9", "2", "decimal", "5"]), "92,5");
  assert.equal(type(["9", "decimal", "decimal", "5"]), "9,5");
  assert.equal(type(["9", "decimal", "5"], reps), "95");
});

test("kg take two decimals, lb one, and a load at most five digits", () => {
  assert.equal(type(["1", "decimal", "2", "5", "5"]), "1,25");
  assert.equal(type(["1", "decimal", "2", "5"], lb), "1.2");
  assert.equal(type(["1", "2", "3", "4", "5", "6"]), "12345");
  assert.equal(type(["1", "2", "3", "4"], reps), "123");
});

test("backspace clears a fresh field and otherwise takes one character", () => {
  assert.equal(type(["backspace"]), "");
  assert.equal(type(["9", "2", "backspace"]), "9");
  assert.equal(type(["9", "decimal", "backspace"]), "9");
});

test("text and value go both ways with either decimal mark", () => {
  assert.equal(padValue("87,5"), 87.5);
  assert.equal(padValue("87.5"), 87.5);
  assert.equal(padValue("87,"), 87);
  assert.equal(padValue(""), null);
  assert.equal(padText(87.5, ","), "87,5");
  assert.equal(padText(0.1 + 0.2, "."), "0.3");
  assert.equal(padText(null), "");
});

test("steps: ±2.5 kg, ±5 lb, ±1 rep, never under 0 kg or 1 rep", () => {
  assert.equal(stepPadValue(87.5, 1, "weight", "kg"), 90);
  assert.equal(stepPadValue(87.5, -3, "weight", "kg"), 80);
  assert.equal(stepPadValue(190, 1, "weight", "lb"), 195);
  assert.equal(stepPadValue(1, -1, "weight", "kg"), 0);
  assert.equal(stepPadValue(5, 2, "reps", "kg"), 7);
  assert.equal(stepPadValue(1, -1, "reps", "kg"), 1);
  assert.equal(stepPadValue(null, 1, "weight", "kg"), 2.5);
  assert.equal(stepPadValue(null, -1, "reps", "kg"), null);
  assert.equal(stepPadValue(60, 0, "weight", "kg"), 60);
});

test("step keys read +2,5 / −5 / +1", () => {
  assert.equal(padStepLabel("weight", "kg", 1, ","), "+2,5");
  assert.equal(padStepLabel("weight", "lb", -1), "−5");
  assert.equal(padStepLabel("reps", "kg", 1), "+1");
});

test("a drag on a field steps once per 14 px, up is more", () => {
  assert.equal(dragSteps(200, 190), 0);
  assert.equal(dragSteps(200, 186), 1);
  assert.equal(dragSteps(200, 158), 3);
  assert.equal(dragSteps(200, 230), -2);
  assert.equal(dragIntent(1, 4), "pending");
  assert.equal(dragIntent(2, -9), "step");
  assert.equal(dragIntent(6, 2), "select");
});

const set = (o: Partial<WorkoutSet>): WorkoutSet =>
  ({
    id: "x",
    reps: 5,
    weight: 80,
    load: "weight",
    section: "working",
    done: false,
    ...o,
  }) as WorkoutSet;

test("the pad types a load and reps; plain bodyweight only reps, holds and cardio nothing it does not own", () => {
  assert.deepEqual(padFields(set({})), ["weight", "reps"]);
  assert.deepEqual(padFields(set({ load: "bodyweight", weight: null })), [
    "reps",
  ]);
  assert.deepEqual(padFields(set({ load: "bodyweight", extraWeight: true })), [
    "weight",
    "reps",
  ]);
  assert.deepEqual(
    padFields(set({ measure: "seconds", load: "bodyweight" })),
    [],
  );
  assert.deepEqual(padFields(set({ measure: "seconds" })), ["weight"]);
  assert.deepEqual(padFields(set({ measure: "cardio" })), []);
});

const bench = {
  sets: [
    set({ id: "w", section: "warmup", done: true }),
    set({ id: "s1" }),
    set({ id: "d1", drop: true }),
    set({ id: "s2" }),
  ],
};
const dips = { sets: [set({ id: "p1", load: "bodyweight", weight: null })] };
const plank = {
  sets: [
    set({ id: "t1", measure: "seconds", load: "bodyweight", weight: null }),
  ],
};

test("Next goes kg → reps → each drop → check the set", () => {
  const ex = [bench, dips];
  assert.deepEqual(padNext(ex, { setId: "s1", field: "weight" }), {
    kind: "field",
    target: { setId: "s1", field: "reps" },
  });
  assert.deepEqual(padNext(ex, { setId: "s1", field: "reps" }), {
    kind: "field",
    target: { setId: "d1", field: "weight" },
  });
  assert.deepEqual(padNext(ex, { setId: "d1", field: "reps" }), {
    kind: "check",
    setId: "s1",
  });
  assert.deepEqual(padNext(ex, { setId: "s2", field: "reps" }), {
    kind: "check",
    setId: "s2",
  });
  assert.deepEqual(padNext(ex, { setId: "p1", field: "reps" }), {
    kind: "check",
    setId: "p1",
  });
  assert.deepEqual(padNext(ex, { setId: "gone", field: "reps" }), {
    kind: "close",
  });
});

test("after a check the pad goes to the first open set's first field, outside that set's drops", () => {
  assert.deepEqual(padAfterCheck([bench, dips], "s1"), {
    setId: "s2",
    field: "weight",
  });
  const done = {
    sets: bench.sets.map((s) => (s.id === "s2" ? s : { ...s, done: true })),
  };
  assert.deepEqual(padAfterCheck([done, dips], "s2"), {
    setId: "p1",
    field: "reps",
  });
  // The next open set has no field the pad types (a timed hold): the pad closes.
  assert.equal(padAfterCheck([{ sets: [set({ id: "a" })] }, plank], "a"), null);
  // Nothing left.
  assert.equal(
    padAfterCheck([{ sets: [set({ id: "a", done: true })] }], "a"),
    null,
  );
});
