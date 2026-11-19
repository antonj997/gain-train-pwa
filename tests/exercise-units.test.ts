import test from "node:test";
import assert from "node:assert/strict";
import {
  exerciseWeightUnit,
  weightUnitOverrides,
  withExerciseWeightUnit,
} from "../src/lib/exercise-units";
import { mergeLibraries } from "../src/data/exercises";
import { labelSet, newSet, validate, type Library } from "../src/data/model";
import { loadHeading } from "../src/lib/load-keys";
import { shortSetText, targetRowText } from "../src/lib/set-target";
import { workoutTargets } from "../src/data/targets";
import { setCurrentWeightUnit } from "../src/lib/units";
import { setCurrentLanguage } from "../src/i18n";

const empty: Library = { hiddenExerciseIds: [] };

test("an exercise without a unit of its own follows the default", () => {
  assert.equal(exerciseWeightUnit({}, "builtin:squat", "kg"), "kg");
  assert.equal(exerciseWeightUnit({}, "builtin:squat", "lb"), "lb");
  // Inherited keys are not units.
  assert.equal(exerciseWeightUnit({}, "toString", "kg"), "kg");
});

test("an exercise's own unit wins over the default", () => {
  const overrides = { "builtin:bench-press": "lb" } as const;
  assert.equal(
    exerciseWeightUnit(overrides, "builtin:bench-press", "kg"),
    "lb",
  );
  // Others still follow the default, whatever it is.
  assert.equal(exerciseWeightUnit(overrides, "builtin:squat", "kg"), "kg");
  assert.equal(exerciseWeightUnit(overrides, "builtin:squat", "lb"), "lb");
});

test("choosing a unit changes only that exercise", () => {
  const library = withExerciseWeightUnit(
    { ...empty, weightUnits: { "builtin:squat": "lb" } },
    "builtin:bench-press",
    "lb",
    "kg",
  );
  assert.deepEqual(library.weightUnits, {
    "builtin:squat": "lb",
    "builtin:bench-press": "lb",
  });
  const units = weightUnitOverrides(library);
  assert.equal(exerciseWeightUnit(units, "builtin:deadlift", "kg"), "kg");
});

test("choosing the default unit clears the exercise's own, so it follows Settings again", () => {
  const library = withExerciseWeightUnit(
    { ...empty, weightUnits: { "builtin:bench-press": "lb", x: "lb" } },
    "builtin:bench-press",
    "kg",
    "kg",
  );
  assert.deepEqual(library.weightUnits, { x: "lb" });
  // With pounds as the default, kilograms is the exercise's own.
  assert.deepEqual(
    withExerciseWeightUnit(empty, "builtin:bench-press", "kg", "lb")
      .weightUnits,
    { "builtin:bench-press": "kg" },
  );
});

test("a unit this app does not know is ignored, not lost", () => {
  const library: Library = {
    ...empty,
    weightUnits: { a: "lb", b: "st", c: "kg" },
  };
  assert.deepEqual(weightUnitOverrides(library), { a: "lb", c: "kg" });
  // Changing another exercise keeps the newer app's value.
  assert.equal(
    withExerciseWeightUnit(library, "d", "lb", "kg").weightUnits?.b,
    "st",
  );
});

test("the library validates weightUnits and merges them like cardioFields", () => {
  const withUnits = { ...empty, weightUnits: { "builtin:squat": "lb" } };
  assert.deepEqual(validate("library", withUnits).weightUnits, {
    "builtin:squat": "lb",
  });
  assert.throws(() =>
    validate("library", { ...empty, weightUnits: { "": "lb" } }),
  );
  assert.throws(() => validate("library", { ...empty, weightUnits: { a: 3 } }));
  // The account's own library wins for an exercise both have.
  assert.deepEqual(
    mergeLibraries(withUnits, {
      ...empty,
      weightUnits: { "builtin:squat": "kg", "builtin:dip": "kg" },
    }).weightUnits,
    { "builtin:squat": "lb", "builtin:dip": "kg" },
  );
  assert.equal("weightUnits" in mergeLibraries(empty, empty), false);
});

test("labels read in the exercise's unit, whatever the default is", () => {
  setCurrentLanguage("en");
  setCurrentWeightUnit("kg");
  const set = { ...newSet(), weight: 100, reps: 5, done: true };
  assert.equal(labelSet(set), "100 kg × 5");
  assert.equal(labelSet(set, true, "lb"), "220.5 lb × 5");
  assert.equal(loadHeading("weight", "lb"), "lb");
  assert.equal(loadHeading("weight"), "kg");
  assert.equal(shortSetText(set, set, "lb"), "220.5 × 5");
  assert.equal(
    targetRowText({ weight: 45.359, reps: 6 }, set, "lb"),
    "Target 100 × 6",
  );
});

test("each exercise's targets step on its own unit's grid", () => {
  setCurrentWeightUnit("kg");
  const finished = (sets: { weight: number; reps: number }[], day: string) => ({
    id: crypto.randomUUID(),
    kind: "workout" as const,
    deleted: false,
    revision: 1,
    payload: {
      name: "Push",
      date: day,
      duration: 50,
      startedAt: null,
      status: "completed" as const,
      exercises: ["builtin:bench-press", "builtin:squat"].map((exerciseId) => ({
        id: crypto.randomUUID(),
        exerciseId,
        name: exerciseId,
        sets: sets.map((s) => ({ ...newSet(), ...s, done: true })),
      })),
    },
  });
  const last = finished([{ weight: 100, reps: 12 }], "2026-11-01");
  const current = {
    id: "now",
    payload: {
      ...last.payload,
      date: "2026-11-08",
      status: "draft" as const,
      // A deload week: 10 % lighter, rounded to the unit's plates.
      plan: { planId: crypto.randomUUID(), week: 4, weeks: 4, deload: true },
      exercises: last.payload.exercises.map((ex) => ({
        ...ex,
        id: crypto.randomUUID(),
        sets: ex.sets.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          done: false,
        })),
      })),
    },
  };
  const targets = workoutTargets([last], current, (id) =>
    id === "builtin:bench-press" ? "lb" : "kg",
  );
  const [bench, squat] = current.payload.exercises.map(
    (ex) => targets.get(ex.sets[0].id)!.target.weight,
  );
  // 90 kg is 198.4 lb: 200 lb on the pound grid, 90 kg on the kilogram one.
  assert.equal(bench, 90.718);
  assert.equal(squat, 90);
});
