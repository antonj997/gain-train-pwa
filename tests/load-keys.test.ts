import test from "node:test";
import assert from "node:assert/strict";
import { newSet, type WorkoutSet } from "../src/data/model.ts";
import {
  allowedLoadKeys,
  applyExerciseCount,
  applyExerciseLoad,
  countHeading,
  defaultLoadKey,
  exerciseMeasure,
  loadHeading,
  loadKeyOf,
  loadMarker,
  withLoadKey,
  type LoadKey,
} from "../src/lib/load-keys.ts";

const KEYS: LoadKey[] = ["weight", "bw", "bwplus", "assisted"];

const bodyweight = (values: Partial<WorkoutSet> = {}): WorkoutSet => ({
  ...newSet(),
  load: "bodyweight",
  ...values,
});
const withKey = (key: LoadKey, values: Partial<WorkoutSet> = {}) => ({
  ...withLoadKey(newSet(), key),
  ...values,
});

test("loadKeyOf maps a set's load fields to one of four keys", () => {
  assert.equal(loadKeyOf({ ...newSet(), load: "weight" }), "weight");
  assert.equal(loadKeyOf(bodyweight()), "bw");
  assert.equal(loadKeyOf(bodyweight({ extraWeight: true })), "bwplus");
  assert.equal(loadKeyOf(bodyweight({ extraWeight: false })), "bw");
  assert.equal(loadKeyOf({ ...newSet(), load: "assisted" }), "assisted");
  // extraWeight only means something on a bodyweight set.
  assert.equal(
    loadKeyOf({ ...newSet(), load: "weight", extraWeight: true }),
    "weight",
  );
});

test("the exercise default is the most common key, ties to the earliest set", () => {
  assert.equal(
    defaultLoadKey([withKey("bwplus"), withKey("bw"), withKey("assisted")]),
    "bwplus",
  );
  assert.equal(
    defaultLoadKey([withKey("bw"), withKey("weight"), withKey("weight")]),
    "weight",
  );
  assert.equal(
    defaultLoadKey([
      withKey("assisted"),
      withKey("bw"),
      withKey("bw"),
      withKey("assisted"),
    ]),
    "assisted",
  );
  assert.equal(defaultLoadKey([]), "weight");
});

test("the exercise measure is the most common measure, reps when unset or empty", () => {
  const seconds = (): WorkoutSet => bodyweight({ measure: "seconds" });
  assert.equal(exerciseMeasure([]), "reps");
  assert.equal(exerciseMeasure([newSet(), newSet()]), "reps");
  assert.equal(exerciseMeasure([seconds(), seconds(), newSet()]), "seconds");
  assert.equal(exerciseMeasure([seconds(), newSet()]), "seconds");
  assert.equal(exerciseMeasure([newSet(), seconds()]), "reps");
  assert.equal(
    exerciseMeasure([{ ...newSet(), measure: "reps" }, seconds(), seconds()]),
    "seconds",
  );
});

test("a set that matches the exercise default has no marker", () => {
  for (const key of KEYS) assert.equal(loadMarker(withKey(key), key), "none");
});

test("a set that differs from the default shows its own key's marker", () => {
  assert.equal(loadMarker(withKey("bw"), "weight"), "bw");
  assert.equal(loadMarker(withKey("bwplus"), "weight"), "plus");
  assert.equal(loadMarker(withKey("assisted"), "bw"), "minus");
  assert.equal(loadMarker(withKey("weight"), "bw"), "kg");
});

test("each key has a column heading", () => {
  assert.equal(loadHeading("weight"), "kg");
  assert.equal(loadHeading("bw"), "BW");
  assert.equal(loadHeading("bwplus"), "+kg");
  assert.equal(loadHeading("assisted"), "Assist");
});

test("the count heading names reps, seconds or both", () => {
  const reps = newSet();
  const seconds = bodyweight({ measure: "seconds" });
  assert.equal(countHeading([reps, { ...reps, measure: "reps" }]), "Reps");
  assert.equal(countHeading([seconds, seconds]), "Sec");
  assert.equal(countHeading([reps, seconds]), "Reps/sec");
  assert.equal(countHeading([seconds, { ...reps, done: true }]), "Reps/sec");
});

test("the default and headings of an exercise with no sets do not throw", () => {
  assert.equal(loadHeading(defaultLoadKey([])), "kg");
  assert.equal(countHeading([]), "Reps");
});

test("withLoadKey round-trips through loadKeyOf for every key", () => {
  for (const from of KEYS)
    for (const to of KEYS)
      assert.equal(
        loadKeyOf(withLoadKey(withKey(from), to)),
        to,
        `${from}>${to}`,
      );
});

test("changing the key clears the weight, keeping the key does not", () => {
  const loaded = { ...newSet(), weight: 60, reps: 5 };
  for (const to of ["bw", "bwplus", "assisted"] as const) {
    const changed = withLoadKey(loaded, to);
    assert.equal(changed.weight, null, to);
    assert.equal(changed.reps, 5, to);
  }
  assert.equal(withLoadKey(loaded, "weight"), loaded);
  const plus = { ...withKey("bwplus"), weight: 10 };
  assert.equal(withLoadKey(plus, "bwplus"), plus);
  assert.equal(withLoadKey(plus, "bw").weight, null);
  assert.equal(withLoadKey(plus, "bw").extraWeight, undefined);
});

test("withLoadKey leaves a checked set unchanged", () => {
  const done = { ...newSet(), weight: 60, reps: 5, done: true };
  for (const key of KEYS) assert.equal(withLoadKey(done, key), done);
});

test("applying a load changes unchecked sets and overwrites their exceptions", () => {
  const checked = { ...withKey("assisted"), weight: 20, reps: 8, done: true };
  const exception = { ...withKey("bwplus"), weight: 10, reps: 6 };
  const matching = { ...newSet(), weight: 80, reps: 5 };
  const result = applyExerciseLoad([checked, exception, matching], "weight");
  assert.equal(result[0], checked);
  assert.equal(loadKeyOf(result[1]), "weight");
  assert.equal(result[1].weight, null);
  assert.equal(result[1].reps, 6);
  assert.equal(result[2], matching);
  assert.deepEqual(result.map(loadKeyOf), ["assisted", "weight", "weight"]);
});

test("applying a load keeps drop and section on the sets it changes", () => {
  const drop = { ...newSet(), drop: true as const };
  const warmup = { ...newSet(), section: "warmup" as const };
  const [a, b] = applyExerciseLoad([drop, warmup], "bw");
  assert.equal(a.drop, true);
  assert.equal(b.section, "warmup");
  assert.equal(loadKeyOf(a), "bw");
  assert.equal(loadKeyOf(b), "bw");
});

test("applying seconds makes unchecked sets bodyweight and leaves checked sets", () => {
  const checked = { ...newSet(), weight: 60, reps: 5, done: true };
  const loaded = { ...newSet(), weight: 60, reps: 5 };
  const assisted = withKey("assisted");
  const plus = withKey("bwplus");
  const result = applyExerciseCount(
    [checked, loaded, assisted, plus],
    "seconds",
  );
  assert.equal(result[0], checked);
  assert.deepEqual(result.slice(1).map(loadKeyOf), ["bw", "bw", "bwplus"]);
  assert.deepEqual(
    result.slice(1).map((s) => s.measure),
    ["seconds", "seconds", "seconds"],
  );
  assert.deepEqual(
    result.slice(1).map((s) => [s.reps, s.weight]),
    [
      [null, null],
      [null, null],
      [null, null],
    ],
  );
});

test("applying reps puts unchecked timed sets back on reps", () => {
  const timed = bodyweight({ measure: "seconds", reps: 30 });
  const checked = bodyweight({ measure: "seconds", reps: 30, done: true });
  const result = applyExerciseCount([timed, checked], "reps");
  assert.equal(result[0].measure, "reps");
  assert.equal(result[0].reps, null);
  assert.equal(result[1], checked);
});

test("a timed exercise only allows the bodyweight keys", () => {
  assert.deepEqual(allowedLoadKeys("seconds"), ["bw", "bwplus"]);
  assert.deepEqual(allowedLoadKeys("reps"), KEYS);
});
