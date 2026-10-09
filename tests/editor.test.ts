import test from "node:test";
import assert from "node:assert/strict";
import {
  getSetIssues,
  finishWorkout,
  resizePlannedSets,
} from "../src/lib/workout-editor.ts";
import { newSet, type Workout } from "../src/data/model.ts";

test("invalid checked sets explain their fields and cannot silently vanish on save", () => {
  const set = { ...newSet(), done: true, reps: 8, weight: -5 };
  assert.match(getSetIssues(set).weight ?? "", /0/);
  const workout: Workout = {
    name: "Session",
    date: "2026-10-08",
    duration: null,
    startedAt: null,
    status: "draft",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "bench",
        name: "Bench",
        sets: [set],
      },
    ],
  };
  assert.throws(() => finishWorkout(workout, 100000), /checked|completed/i);
});

test("bodyweight needs no weight and timed results require whole positive seconds", () => {
  assert.deepEqual(
    getSetIssues({ ...newSet(), load: "bodyweight", reps: 12 }),
    {},
  );
  const seconds = {
    ...newSet(),
    load: "bodyweight" as const,
    measure: "seconds" as const,
    reps: 2.5,
  };
  assert.match(getSetIssues(seconds).reps ?? "", /seconds/);
});

test("finishing keeps only completed results and computes elapsed minutes", () => {
  const workout: Workout = {
    name: "Session",
    date: "2026-10-08",
    duration: null,
    startedAt: 1000,
    status: "draft",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "bench",
        name: "Bench",
        sets: [{ ...newSet(), weight: 20, reps: 8, done: true }, newSet()],
      },
    ],
  };
  const result = finishWorkout(workout, 181000);
  assert.equal(result.duration, 3);
  assert.equal(result.completedAt, 181000);
  assert.equal(result.exercises[0].sets.length, 1);
  assert.equal(workout.status, "draft");
  assert.equal(workout.exercises[0].sets.length, 2);
});

test("editing an old completed workout preserves its completion time", () => {
  const workout: Workout = {
    name: "Session",
    date: "2026-10-08",
    duration: 25,
    startedAt: null,
    status: "completed",
    completedAt: 100,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "pushup",
        name: "Push Up",
        sets: [{ ...newSet(), load: "bodyweight", reps: 8, done: true }],
      },
    ],
  };
  assert.equal(finishWorkout(workout, 500).completedAt, 100);
  const legacy = {
    ...workout,
    completedAt: undefined,
    duration: null,
    startedAt: 100,
  };
  assert.equal(finishWorkout(legacy, 500).completedAt, undefined);
  assert.equal(finishWorkout(legacy, 600000).duration, null);
});

test("routine resizing preserves existing planned sets and copies their settings", () => {
  const exercise = {
    id: crypto.randomUUID(),
    exerciseId: "bench",
    name: "Bench",
    sets: [{ ...newSet(), reps: 5, weight: 30, section: "warmup" as const }],
  };
  const result = resizePlannedSets(exercise, 3);
  assert.equal(result.sets.length, 3);
  assert.equal(result.sets[0].id, exercise.sets[0].id);
  assert.equal(result.sets[2].section, "warmup");
  assert.equal(result.sets[2].weight, 30);
  assert.equal(new Set(result.sets.map((s) => s.id)).size, 3);
  assert.equal(resizePlannedSets(result, 1).sets.length, 1);
});
