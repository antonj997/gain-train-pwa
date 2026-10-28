import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, WorkoutSet } from "../src/data/model";
import {
  newBestWorkoutIds,
  recentBests,
  sparklinePoints,
} from "../src/data/analytics";
import { historyPeriod } from "../src/data/summary";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
const workout = (
  id: string,
  date: string,
  sets: WorkoutSet[],
  exerciseId = "builtin:bench-press",
): RecordDoc => ({
  id,
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name: "Push",
    date,
    duration: null,
    startedAt: null,
    status: "completed",
    exercises: [{ id: id + "x", exerciseId, name: exerciseId, sets }],
  },
});

test("a workout is a new best only when it beats every earlier session", () => {
  const records = [
    workout("a", "2026-10-01", [set({ weight: 100 })]),
    workout("b", "2026-10-08", [set({ weight: 105 })]),
    workout("c", "2026-10-15", [set({ weight: 100 })]),
    workout("d", "2026-10-22", [set({ weight: 110 })]),
  ];
  assert.deepEqual([...newBestWorkoutIds(records)].sort(), ["b", "d"]);
});

test("the first session of an exercise is a starting point, not a best", () => {
  assert.equal(
    newBestWorkoutIds([workout("a", "2026-10-01", [set()])]).size,
    0,
  );
});

test("a heavier drop never makes a new best", () => {
  // The drop's estimate (120) would beat the 110 of the set above it.
  const records = [
    workout("a", "2026-10-01", [set({ weight: 100, reps: 3 })]),
    workout("b", "2026-10-08", [
      set({ weight: 90, reps: 5 }),
      set({ weight: 90, reps: 10, drop: true }),
    ]),
  ];
  assert.equal(newBestWorkoutIds(records).size, 0);
});

test("unchecked, warm-up and deleted work does not count", () => {
  const deleted = workout("d", "2026-10-22", [set({ weight: 200 })]);
  deleted.deleted = true;
  const records = [
    workout("a", "2026-10-01", [set({ weight: 100 })]),
    workout("b", "2026-10-08", [set({ weight: 150, done: false })]),
    workout("c", "2026-10-15", [set({ weight: 150, section: "warmup" })]),
    deleted,
  ];
  assert.equal(newBestWorkoutIds(records).size, 0);
});

test("recent bests keep the latest per exercise inside the period, newest first", () => {
  const squat = "builtin:squat";
  const records = [
    workout("a", "2026-10-01", [set({ weight: 100 })]),
    workout("b", "2026-10-08", [set({ weight: 105 })]),
    workout("c", "2026-10-15", [set({ weight: 110 })]),
    workout("s1", "2026-10-02", [set({ weight: 120 })], squat),
    workout("s2", "2026-10-09", [set({ weight: 130 })], squat),
  ];
  const bests = recentBests(records, "2026-10-05", "2026-10-31");
  assert.deepEqual(
    bests.map((b) => [b.exerciseId, b.workoutId]),
    [
      ["builtin:bench-press", "c"],
      [squat, "s2"],
    ],
  );
  assert.equal(recentBests(records, "2026-10-05", "2026-10-31", 1).length, 1);
});

test("sparkline points scale to the box with the highest value at the top", () => {
  assert.equal(sparklinePoints([10, 20, 30]), "2,26 32,14 62,2");
  assert.equal(sparklinePoints([30, 10]), "2,2 62,26");
});

test("sparkline draws flat lines for one value, equal values and none", () => {
  assert.equal(sparklinePoints([50]), "2,14 62,14");
  assert.equal(sparklinePoints([7, 7, 7]), "2,14 32,14 62,14");
  assert.equal(sparklinePoints([]), "");
});

test("progress periods cover 4 weeks, 3 months and a year against the same length before", () => {
  assert.deepEqual(historyPeriod("4w", "2026-10-28"), {
    start: "2026-10-01",
    end: "2026-10-28",
    days: 28,
    previousStart: "2026-09-03",
    previousEnd: "2026-09-30",
    previousDays: 28,
  });
  const quarter = historyPeriod("3m", "2026-10-28");
  assert.equal(quarter.start, "2026-07-29");
  assert.equal(quarter.previousEnd, "2026-07-28");
  assert.equal(historyPeriod("12m", "2026-10-28").start, "2025-10-29");
});
