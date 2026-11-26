import test from "node:test";
import assert from "node:assert/strict";
import type { Library } from "../src/data/model";
import {
  WEIGHT_STEPS,
  defaultWeightStep,
  exerciseNote,
  restOf,
  weightStepOf,
  withExerciseNote,
  withRest,
  withWeightStep,
} from "../src/lib/exercise-settings";

const lib = (extra: Partial<Library> = {}): Library => ({
  hiddenExerciseIds: [],
  ...extra,
});

test("defaultWeightStep follows the equipment (spec §D5)", () => {
  assert.equal(defaultWeightStep("barbell"), 2.5);
  assert.equal(defaultWeightStep("smith"), 2.5);
  assert.equal(defaultWeightStep("cable"), 2.5);
  assert.equal(defaultWeightStep("dumbbell"), 2);
  assert.equal(defaultWeightStep("machine"), 5);
  assert.equal(defaultWeightStep("kettlebell"), 4);
  assert.equal(defaultWeightStep("bodyweight"), 1.25);
  assert.equal(defaultWeightStep("band"), 2.5);
  assert.equal(defaultWeightStep(undefined), 2.5);
  assert.equal(defaultWeightStep(null), 2.5);
  assert.equal(defaultWeightStep("rowing boat"), 2.5);
  assert.deepEqual([...WEIGHT_STEPS], [0.5, 1, 1.25, 2, 2.5, 4, 5]);
});

test("weight step: own, else the equipment default; the default clears it", () => {
  const id = "builtin:squat";
  assert.equal(weightStepOf(lib(), id, "barbell"), 2.5);
  const two = withWeightStep(lib(), id, 2);
  assert.deepEqual(two.weightSteps, { [id]: 2 });
  assert.equal(weightStepOf(two, id, "barbell"), 2);
  assert.equal(weightStepOf(two, "builtin:other", "machine"), 5);
  const back = withWeightStep(two, id, 2.5, "barbell");
  assert.equal(id in (back.weightSteps ?? {}), false);
  assert.equal(weightStepOf(back, id, "barbell"), 2.5);
  // Without the equipment, 2.5 is the default too.
  assert.equal(
    id in (withWeightStep(lib(), id, 2.5).weightSteps ?? {}),
    false,
  );
  assert.equal(id in (withWeightStep(two, id, null).weightSteps ?? {}), false);
  // A dumbbell exercise keeps a chosen 2.5, which is not its default.
  assert.deepEqual(
    withWeightStep(lib(), "builtin:dumbbell-curl", 2.5, "dumbbell").weightSteps,
    { "builtin:dumbbell-curl": 2.5 },
  );
  // A value a newer app saved that is not a positive number is ignored.
  const odd = lib({ weightSteps: { [id]: -1 } });
  assert.equal(weightStepOf(odd, id, "barbell"), 2.5);
  // Others are kept.
  const both = withWeightStep(withWeightStep(lib(), "a", 1), "b", 4);
  assert.deepEqual(withWeightStep(both, "a", null).weightSteps, { b: 4 });
});

test("exercise note: trimmed, at most 300 characters, empty removes", () => {
  const id = "builtin:squat";
  assert.equal(exerciseNote(lib(), id), "");
  const noted = withExerciseNote(lib(), id, "  Hälarna i golvet ");
  assert.equal(exerciseNote(noted, id), "Hälarna i golvet");
  assert.equal(id in (withExerciseNote(noted, id, "  ").exerciseNotes ?? {}), false);
  assert.equal(
    exerciseNote(withExerciseNote(lib(), id, "x".repeat(400)), id).length,
    300,
  );
});

test("rest: an own time (0 = off), absent follows the preference", () => {
  const id = "builtin:lateral-raise";
  assert.equal(restOf(lib(), id), undefined);
  const off = withRest(lib(), id, 0);
  assert.deepEqual(off.restSeconds, { [id]: 0 });
  assert.equal(restOf(off, id), 0);
  assert.equal(restOf(withRest(lib(), id, 95), id), 95);
  assert.equal(restOf(withRest(lib(), id, 900), id), 600);
  assert.equal(restOf(withRest(lib(), id, 92.4), id), 92);
  assert.equal(id in (withRest(off, id, null).restSeconds ?? {}), false);
  assert.equal(restOf(lib({ restSeconds: { [id]: -3 } }), id), undefined);
});
