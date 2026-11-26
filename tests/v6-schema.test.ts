import test from "node:test";
import assert from "node:assert/strict";
import {
  RecordValidationError,
  SCHEMA_VERSION,
  validate,
  type WorkoutSet,
} from "../src/data/model";
import { setCurrentLanguage } from "../src/i18n";

setCurrentLanguage("en");

const set = (overrides: Record<string, unknown> = {}) =>
  ({
    id: crypto.randomUUID(),
    reps: 5,
    weight: 100,
    load: "weight",
    section: "working",
    done: true,
    ...overrides,
  }) as WorkoutSet;
const workout = (sets: WorkoutSet[], exercise: Record<string, unknown> = {}) => ({
  name: "Benpass",
  date: "2026-11-19",
  duration: 50,
  startedAt: null,
  status: "completed" as const,
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "builtin:squat",
      name: "Squat",
      sets,
      ...exercise,
    },
  ],
});

test("a set keeps rirHigh 5 with rir 3", () => {
  const saved = validate("workout", workout([set({ rir: 3, rirHigh: 5 })]));
  assert.equal(saved.exercises[0].sets[0].rir, 3);
  assert.equal(saved.exercises[0].sets[0].rirHigh, 5);
  const four = validate("workout", workout([set({ rir: 3, rirHigh: 4 })]));
  assert.equal(four.exercises[0].sets[0].rirHigh, 4);
});

test("rirHigh 6 is invalid, and rir itself still stops at 3", () => {
  assert.throws(
    () => validate("workout", workout([set({ rir: 3, rirHigh: 6 })])),
    RecordValidationError,
  );
  assert.throws(
    () => validate("workout", workout([set({ rir: 3, rirHigh: 3 })])),
    RecordValidationError,
  );
  // The server trigger allows rir 0–3 only; RIR 5 is written as 3 + rirHigh.
  assert.throws(
    () => validate("workout", workout([set({ rir: 5 })])),
    RecordValidationError,
  );
});

test("library keeps exerciseNotes, weightSteps and restSeconds", () => {
  const library = validate("library", {
    hiddenExerciseIds: [],
    exerciseNotes: { "builtin:squat": "Hälarna i golvet" },
    weightSteps: { "builtin:squat": 2.5, "custom:abc": 1.25 },
    restSeconds: { "builtin:squat": 180, "builtin:lateral-raise": 0 },
  });
  assert.equal(library.exerciseNotes?.["builtin:squat"], "Hälarna i golvet");
  assert.equal(library.weightSteps?.["custom:abc"], 1.25);
  assert.equal(library.restSeconds?.["builtin:lateral-raise"], 0);
});

test("the per-exercise library fields reject values out of range", () => {
  const bad = [
    { exerciseNotes: { "builtin:squat": "x".repeat(301) } },
    { weightSteps: { "builtin:squat": 0 } },
    { weightSteps: { "builtin:squat": 25 } },
    { restSeconds: { "builtin:squat": 601 } },
    { restSeconds: { "builtin:squat": 90.5 } },
    { restSeconds: { "builtin:squat": -1 } },
  ];
  for (const fields of bad)
    assert.throws(
      () => validate("library", { hiddenExerciseIds: [], ...fields }),
      RecordValidationError,
      JSON.stringify(fields),
    );
  // A note of exactly 300 characters is fine.
  validate("library", {
    hiddenExerciseIds: [],
    exerciseNotes: { "builtin:squat": "x".repeat(300) },
  });
});

test("an exercise keeps fatigue lowered", () => {
  const saved = validate(
    "workout",
    workout([set()], { fatigue: "lowered" }),
  );
  assert.equal(saved.exercises[0].fatigue, "lowered");
  assert.throws(
    () => validate("workout", workout([set()], { fatigue: "raised" })),
    RecordValidationError,
  );
});

test("no SCHEMA_VERSION bump", () => {
  assert.equal(SCHEMA_VERSION, 2);
});

test("merging two libraries keeps both sides' per-exercise settings, base first", async () => {
  const { mergeLibraries } = await import("../src/data/exercises");
  const merged = mergeLibraries(
    {
      hiddenExerciseIds: [],
      exerciseNotes: { a: "mine" },
      weightSteps: { a: 2 },
      restSeconds: { a: 0 },
    },
    {
      hiddenExerciseIds: [],
      exerciseNotes: { a: "theirs", b: "other" },
      weightSteps: { b: 5 },
      restSeconds: { a: 120, b: 90 },
    },
  );
  assert.deepEqual(merged.exerciseNotes, { a: "mine", b: "other" });
  assert.deepEqual(merged.weightSteps, { a: 2, b: 5 });
  assert.deepEqual(merged.restSeconds, { a: 0, b: 90 });
  const none = mergeLibraries({ hiddenExerciseIds: [] }, { hiddenExerciseIds: [] });
  assert.equal("exerciseNotes" in none, false);
});
