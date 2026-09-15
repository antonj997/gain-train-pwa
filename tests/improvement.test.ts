import test from "node:test";
import assert from "node:assert/strict";
import { improvementRate } from "../src/data/summary";
import { type RecordDoc, newSet } from "../src/data/model";
const workout = (
  date: string,
  reps: number,
  load: "weight" | "bodyweight" = "bodyweight",
): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  deleted: false,
  dirty: false,
  revision: 1,
  localVersion: 1,
  payload: {
    name: "Test",
    date,
    duration: 30,
    startedAt: null,
    status: "completed",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "pull-up",
        name: "Pull Up",
        sets: [{ ...newSet(), reps, weight: 20, load, done: true }],
      },
    ],
  },
});
test("improvement uses pre-period baseline and excludes future sessions", () => {
  const records = [
    workout("2026-08-01", 5),
    workout("2026-09-02", 8),
    workout("2026-10-01", 3),
  ];
  assert.equal(improvementRate(records, "2026-09-01", "2026-09-30"), 100);
});
test("first sessions and incompatible loads do not count as improvement", () => {
  assert.equal(
    improvementRate([workout("2026-09-01", 5)], "2026-09-01", "2026-09-30"),
    null,
  );
  assert.equal(
    improvementRate(
      [workout("2026-08-01", 5, "weight"), workout("2026-09-01", 8)],
      "2026-09-01",
      "2026-09-30",
    ),
    null,
  );
});
test("uses first in-period session when no prior baseline exists", () => {
  assert.equal(
    improvementRate(
      [workout("2026-09-01", 5), workout("2026-09-20", 5)],
      "2026-09-01",
      "2026-09-30",
    ),
    0,
  );
  assert.equal(
    improvementRate(
      [workout("2026-09-01", 5), workout("2026-09-20", 6)],
      "2026-09-01",
      "2026-09-30",
    ),
    100,
  );
});
