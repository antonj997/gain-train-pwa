import test from "node:test";
import assert from "node:assert/strict";
import { catalogue, catalogueById } from "../src/data/catalogue";
import { MUSCLES_BY_NAME } from "../src/data/exercise-muscles";
import { ISOLATION_EXERCISES, restTier } from "../src/data/rest-tiers";
import type { ExerciseMuscles } from "../src/data/muscles";

const builtin = (name: string) => {
  const entry = catalogue.find((e) => e.name === name);
  assert.ok(entry, name);
  return {
    id: entry.id,
    name: entry.name,
    equipment: entry.equipment,
    muscles: MUSCLES_BY_NAME[entry.name] ?? {},
  };
};

test("rest tiers pinned by the spec", () => {
  for (const name of ["Squat", "Bench Press", "Deadlift"])
    assert.equal(restTier(builtin(name)), 150, name);
  for (const name of ["Bulgarian Split Squat", "Leg Press", "Pull Up"])
    assert.equal(restTier(builtin(name)), 120, name);
  for (const name of [
    "Standing Calf Raise",
    "Lateral Raise",
    "Dumbbell Curl",
    "Tricep Pushdown",
    "Lying Leg Curl",
  ])
    assert.equal(restTier(builtin(name)), 90, name);
});

test("your own exercise: one main muscle is isolation", () => {
  const own = (muscles: ExerciseMuscles, equipment?: string) => ({
    id: "3b0c1d9e-0000-4000-8000-000000000001",
    name: "Knästående pallofpress",
    equipment,
    muscles,
    custom: true,
  });
  assert.equal(restTier(own({ abs: 1, obliques: 0.5 }, "cable")), 90);
  assert.equal(restTier(own({ quads: 1, glutes: 1 }, "dumbbell")), 120);
  assert.equal(restTier(own({ quads: 1, glutes: 1 }, "barbell")), 150);
  assert.equal(restTier(own({ quads: 1, glutes: 1 })), 120);
  // A custom one named like a catalogue isolation lift still goes by muscles.
  assert.equal(
    restTier({ ...own({ biceps: 1, forearms: 1 }), name: "Dumbbell Curl" }),
    120,
  );
});

test("ISOLATION_EXERCISES names catalogue exercises only", () => {
  const names = new Set(catalogue.map((e) => e.name));
  for (const name of ISOLATION_EXERCISES) assert.ok(names.has(name), name);
  // No barbell or smith compound sits in it by mistake.
  for (const name of ["Squat", "Bench Press", "Deadlift", "Overhead Press"])
    assert.equal(ISOLATION_EXERCISES.has(name), false, name);
  // A built-in goes by its catalogue entry, whatever name the record kept.
  const curl = catalogueById.get("builtin:dumbbell-curl");
  assert.ok(curl);
  assert.equal(restTier({ id: curl.id, name: "Biceps", muscles: {} }), 90);
});
