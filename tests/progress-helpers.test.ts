import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, WorkoutSet } from "../src/data/model";
import {
  comparableSets,
  exerciseStats,
  loadEstimate,
  progressFor,
  recentBests,
  sparklinePoints,
} from "../src/data/analytics";
import { rankedRecords } from "../src/data/record-rank";
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

test("recent bests keep the latest per exercise inside the period, newest first", () => {
  const squat = "builtin:squat";
  const records = [
    workout("a", "2026-10-01", [set({ weight: 100 })]),
    workout("b", "2026-10-08", [set({ weight: 105 })]),
    workout("c", "2026-10-15", [set({ weight: 110 })]),
    workout("s1", "2026-10-02", [set({ weight: 120 })], squat),
    workout("s2", "2026-10-09", [set({ weight: 130 })], squat),
  ];
  const bests = recentBests(rankedRecords(records), "2026-10-05", "2026-10-31");
  assert.deepEqual(
    bests.map((b) => [b.exerciseId, b.workoutId]),
    [
      ["builtin:bench-press", "c"],
      [squat, "s2"],
    ],
  );
  assert.equal(
    recentBests(rankedRecords(records), "2026-10-05", "2026-10-31", 1).length,
    1,
  );
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

test("a bodyweight set with a logged bodyweight is estimated on the whole load", () => {
  const bw = (o: Partial<WorkoutSet>) =>
    set({ load: "bodyweight", weight: null, bodyWeightKg: 80, ...o });
  // 80 × (1 + 6/30) = 96; 90 × (1 + 7/30) = 111; 60 × (1 + 8/30) = 76.
  assert.equal(loadEstimate(bw({ reps: 6 })), 96);
  assert.equal(
    loadEstimate(bw({ reps: 7, weight: 10, extraWeight: true })),
    111,
  );
  assert.ok(
    Math.abs(
      loadEstimate(
        set({ load: "assisted", weight: 20, reps: 8, bodyWeightKg: 80 }),
      )! - 76,
    ) < 1e-9,
  );
  // No bodyweight logged, or more than 10 reps: no estimate.
  assert.equal(loadEstimate(bw({ reps: 6, bodyWeightKg: undefined })), null);
  assert.equal(loadEstimate(bw({ reps: 12 })), null);
  // Weighted sets keep their own estimate: 90 × (1 + 3/30) = 99.
  assert.ok(Math.abs(loadEstimate(set({ weight: 90, reps: 3 }))! - 99) < 1e-9);
});

test("sessions of one bodyweight exercise at different added weights share one trend", () => {
  const pull = (date: string, o: Partial<WorkoutSet>) =>
    workout(
      date,
      date,
      [set({ load: "bodyweight", weight: null, bodyWeightKg: 80, ...o })],
      "builtin:pull-up",
    );
  const records = [
    pull("2026-10-01", { reps: 8 }),
    pull("2026-10-08", { reps: 9, weight: 5, extraWeight: true }),
    pull("2026-10-15", { reps: 7, weight: 10, extraWeight: true }),
    pull("2026-10-22", { reps: 6, weight: 10, extraWeight: true }),
  ];
  const [item] = progressFor(records);
  const stats = exerciseStats(item);
  assert.equal(stats.weighted, true);
  assert.equal(stats.comparable.length, 4);
  // The best is the heaviest whole load: 90 × (1 + 7/30).
  assert.equal(stats.best.date, "2026-10-15");
  // Weighted and bodyweight never share a trend.
  assert.equal(
    comparableSets(
      set({ weight: 90, reps: 5 }),
      set({ load: "bodyweight", weight: null, reps: 5, bodyWeightKg: 90 }),
    ),
    false,
  );
});

test("without a logged bodyweight, bodyweight sessions compare only at the same added weight", () => {
  const a = set({ load: "bodyweight", weight: 10, extraWeight: true, reps: 7 });
  const b = set({ load: "bodyweight", weight: 5, extraWeight: true, reps: 9 });
  assert.equal(comparableSets(a, b), false);
  assert.equal(comparableSets(a, { ...a, reps: 6 }), true);
});

test("the bodyweight set now stands in for sets checked before one was set", () => {
  const pull = (date: string, o: Partial<WorkoutSet>) =>
    workout(
      date,
      date,
      [set({ load: "bodyweight", weight: null, ...o })],
      "builtin:pull-up",
    );
  const records = [
    pull("2026-10-01", { reps: 8 }),
    pull("2026-10-08", { reps: 7, weight: 10, extraWeight: true }),
    // Logged with its own bodyweight, which wins over the stand-in.
    pull("2026-10-15", {
      reps: 6,
      weight: 10,
      extraWeight: true,
      bodyWeightKg: 90,
    }),
  ];
  assert.equal(exerciseStats(progressFor(records)[0]).comparable.length, 1);
  const [item] = progressFor(records, 80);
  const stats = exerciseStats(item);
  assert.equal(stats.comparable.length, 3);
  assert.equal(item.points[2].set.bodyWeightKg, 90);
  assert.equal(item.points[0].set.bodyWeightKg, 80);
});
