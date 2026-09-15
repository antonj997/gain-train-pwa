import test from "node:test";
import assert from "node:assert/strict";
import {
  historyPeriod,
  weekStart,
  summarize,
  metricChange,
} from "../src/data/summary";
import { type Workout, newSet, validate } from "../src/data/model";

test("rolling history uses two non-overlapping 30-day windows across year boundaries", () => {
  assert.deepEqual(historyPeriod("", "2026-01-10"), {
    start: "2025-12-12",
    end: "2026-01-10",
    days: 30,
    previousStart: "2025-11-12",
    previousEnd: "2025-12-11",
    previousDays: 30,
  });
});
test("calendar comparisons handle leap years and partial current months", () => {
  const leap = historyPeriod("2024-03", "2026-09-14");
  assert.equal(leap.days, 31);
  assert.equal(leap.previousDays, 29);
  assert.equal(leap.previousEnd, "2024-02-29");
  const partial = historyPeriod("2026-09", "2026-09-14");
  assert.equal(partial.days, 14);
  assert.equal(partial.previousEnd, "2026-08-14");
});
test("weeks begin on Monday across month and year boundaries", () => {
  assert.equal(weekStart("2026-01-01"), "2025-12-29");
  assert.equal(weekStart("2026-01-04"), "2025-12-29");
  assert.equal(weekStart("2026-01-05"), "2026-01-05");
});
test("summary excludes missing durations and unchecked sets, counts zero-minute sessions", () => {
  const workout: Workout = {
    name: "Test",
    date: "2026-09-14",
    duration: 0,
    status: "completed",
    startedAt: null,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "bench",
        name: "Bench",
        sets: [
          { ...newSet(), weight: 20, reps: 5, done: true },
          { ...newSet(), weight: 20, reps: 5 },
        ],
      },
    ],
  };
  const summary = summarize(
    [workout, { ...workout, duration: null }, { ...workout, duration: 60 }],
    30,
  );
  assert.equal(summary.duration, 30);
  assert.equal(summary.minutes, 60);
  assert.equal(summary.sets, 3);
  assert.equal(summary.volume, 300);
  const assisted = {
    ...workout,
    exercises: workout.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((set) => ({ ...set, load: "assisted" as const })),
    })),
  };
  assert.equal(summarize([assisted], 30).volume, 0);
  assert.equal(summary.perWeek, 0.7);
  assert.equal(summarize([], 30).duration, null);
  assert.equal(metricChange(null, 20), "No comparison");
  assert.equal(metricChange(1.04, 1, 1), "→ No change");
});
test("routine origin survives validation while old workouts remain valid", () => {
  const workout = {
    name: "Routine session",
    date: "2026-09-14",
    duration: null,
    status: "draft",
    startedAt: null,
    exercises: [],
  };
  assert.doesNotThrow(() => validate("workout", workout));
  const routineId = crypto.randomUUID();
  assert.equal(
    (validate("workout", { ...workout, routineId }) as Workout).routineId,
    routineId,
  );
});
