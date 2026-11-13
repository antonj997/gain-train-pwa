import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, Workout, WorkoutSet } from "../src/data/model";
import {
  exerciseRecords,
  exerciseSessions,
} from "../src/data/exercise-records";

const ID = "builtin:bench-press";
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
  sets: WorkoutSet[],
  date: string,
  {
    exerciseId = ID,
    status = "completed",
    name = "Push",
    extra = [],
  }: {
    exerciseId?: string;
    status?: Workout["status"];
    name?: string;
    extra?: Workout["exercises"];
  } = {},
): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name,
    date,
    duration: null,
    startedAt: null,
    status,
    exercises: [
      { id: crypto.randomUUID(), exerciseId, name: "Bench", sets },
      ...extra,
    ],
  } satisfies Workout,
});

test("sessions: newest first, checked valid sets only, one per workout", () => {
  const older = workout([set({ weight: 80 })], "2026-10-01");
  const skipped = workout([set({ done: false })], "2026-10-02");
  const draft = workout([set()], "2026-10-03", { status: "draft" });
  const other = workout([set()], "2026-10-04", { exerciseId: "builtin:squat" });
  const twice = workout(
    [set({ section: "warmup", weight: 40 }), set({ weight: 90 })],
    "2026-10-05",
    {
      name: "Upper",
      extra: [
        {
          id: crypto.randomUUID(),
          exerciseId: ID,
          name: "Bench",
          sets: [set({ weight: 70, reps: 10 }), set({ reps: null })],
        },
      ],
    },
  );
  const sessions = exerciseSessions([older, skipped, draft, other, twice], ID);
  assert.deepEqual(
    sessions.map((s) => [s.date, s.workoutName, s.sets.map((x) => x.weight)]),
    [
      ["2026-10-05", "Upper", [40, 90, 70]],
      ["2026-10-01", "Push", [80]],
    ],
  );
});

test("records ignore warm-ups and pick each best", () => {
  const a = workout(
    [
      set({ section: "warmup", weight: 140, reps: 3 }),
      set({ weight: 100, reps: 5 }),
      set({ weight: 80, reps: 12 }),
    ],
    "2026-10-01",
  );
  const b = workout(
    [set({ weight: 105, reps: 2 }), set({ weight: 90, reps: 8 })],
    "2026-10-08",
  );
  const r = exerciseRecords([a, b], ID);
  // 100 × 5 → 116.7; 90 × 8 → 114; 105 × 2 → 112; 80 × 12 has no estimate.
  assert.equal(r.bestE1rm?.set.weight, 100);
  assert.equal(r.bestE1rm?.workoutId, a.id);
  assert.equal(Math.round(r.bestE1rm!.value * 10) / 10, 116.7);
  assert.equal(r.heaviest?.set.weight, 105);
  assert.equal(r.heaviest?.workoutId, b.id);
  assert.equal(r.mostReps?.set.reps, 12);
  // 80 × 12 = 960 beats 100 × 5 = 500.
  assert.equal(r.bestSetVolume?.value, 960);
  // Session volumes: a 500 + 960 = 1460 (warm-up left out); b 210 + 720 = 930.
  assert.deepEqual(
    [r.bestSessionVolume?.value, r.bestSessionVolume?.workoutId],
    [1460, a.id],
  );
  assert.deepEqual(
    r.repsAtWeight.map((x) => [x.weight, x.reps]),
    [
      [105, 2],
      [100, 5],
      [90, 8],
      [80, 12],
    ],
  );
});

test("drops count for heaviest weight and session volume only", () => {
  const w = workout(
    [set({ weight: 100, reps: 5 }), set({ weight: 120, reps: 20, drop: true })],
    "2026-10-01",
  );
  const r = exerciseRecords([w], ID);
  assert.equal(r.bestE1rm?.set.weight, 100);
  assert.equal(r.heaviest?.set.weight, 120);
  assert.equal(r.mostReps?.set.reps, 5);
  assert.equal(r.bestSetVolume?.value, 500);
  assert.equal(r.bestSessionVolume?.value, 500 + 2400);
  assert.deepEqual(
    r.repsAtWeight.map((x) => x.weight),
    [100],
  );
});

test("a tie keeps the first time it was reached", () => {
  const first = workout([set({ weight: 100, reps: 5 })], "2026-10-01");
  const again = workout([set({ weight: 100, reps: 5 })], "2026-10-08");
  const r = exerciseRecords([again, first], ID);
  assert.equal(r.bestE1rm?.workoutId, first.id);
  assert.equal(r.bestSetVolume?.workoutId, first.id);
  assert.equal(r.mostReps?.workoutId, first.id);
  assert.equal(r.bestSessionVolume?.workoutId, first.id);
  assert.equal(r.repsAtWeight[0].workoutId, first.id);
  // Heaviest keeps its own rule: the most recent of equal sets.
  assert.equal(r.heaviest?.workoutId, again.id);
});

test("most reps: a tie goes to the heavier weight", () => {
  const w = workout(
    [set({ weight: 60, reps: 10 }), set({ weight: 70, reps: 10 })],
    "2026-10-01",
  );
  assert.equal(exerciseRecords([w], ID).mostReps?.set.weight, 70);
});

test("bodyweight, timed and cardio sets have no weight records", () => {
  const w = workout(
    [
      set({ load: "bodyweight", weight: null, reps: 12 }),
      set({ load: "bodyweight", weight: null, reps: 45, measure: "seconds" }),
      set({
        measure: "cardio",
        weight: null,
        reps: null,
        durationSec: 600,
        distanceM: 2000,
      }),
    ],
    "2026-10-01",
  );
  const r = exerciseRecords([w], ID);
  assert.equal(r.bestE1rm, null);
  assert.equal(r.heaviest, null);
  assert.equal(r.bestSetVolume, null);
  assert.equal(r.bestSessionVolume, null);
  assert.deepEqual(r.repsAtWeight, []);
  assert.equal(r.mostReps?.set.reps, 12);
});

test("no sessions, no records", () => {
  const r = exerciseRecords([], ID);
  assert.deepEqual(r, {
    bestE1rm: null,
    heaviest: null,
    mostReps: null,
    bestSetVolume: null,
    bestSessionVolume: null,
    repsAtWeight: [],
  });
});
