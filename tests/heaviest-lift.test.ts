import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, Workout, WorkoutSet } from "../src/data/model";
import { heaviestLift } from "../src/data/analytics";

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
const record = (
  sets: WorkoutSet[],
  date = "2026-10-08",
  exerciseId = ID,
): RecordDoc => ({
  id: crypto.randomUUID(),
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
    exercises: [{ id: crypto.randomUUID(), exerciseId, name: "Bench", sets }],
  } satisfies Workout,
});
const pick = (records: RecordDoc[]) => {
  const found = heaviestLift(records, ID);
  return (
    found && {
      weight: found.set.weight,
      reps: found.set.reps,
      date: found.date,
    }
  );
};

test("the heaviest weight wins at any reps", () => {
  assert.deepEqual(
    pick([
      record(
        [set({ weight: 90, reps: 8 }), set({ weight: 100, reps: 2 })],
        "2026-10-27",
      ),
      record([set({ weight: 95, reps: 5 })], "2026-10-28"),
    ]),
    { weight: 100, reps: 2, date: "2026-10-27" },
  );
});

test("a tie on weight goes to the most reps, then the most recent", () => {
  assert.deepEqual(
    pick([
      record([set({ weight: 100, reps: 3 })], "2026-10-01"),
      record([set({ weight: 100, reps: 5 })], "2026-10-02"),
      record([set({ weight: 100, reps: 4 })], "2026-10-03"),
    ]),
    { weight: 100, reps: 5, date: "2026-10-02" },
  );
  const older = record([set({ weight: 100, reps: 5 })], "2026-10-01");
  const newer = record([set({ weight: 100, reps: 5 })], "2026-10-09");
  assert.equal(heaviestLift([older, newer], ID)?.workoutId, newer.id);
  assert.equal(heaviestLift([newer, older], ID)?.workoutId, newer.id);
});

test("drops count; warm-ups, unfinished sets and drafts do not", () => {
  assert.deepEqual(
    pick([
      record([
        set({ weight: 140, reps: 3, section: "warmup" }),
        set({ weight: 150, reps: 1, done: false }),
        set({ weight: 80, reps: 5 }),
        set({ weight: 110, reps: 4, drop: true }),
      ]),
    ]),
    { weight: 110, reps: 4, date: "2026-10-08" },
  );
  const draft = record([set({ weight: 200 })]);
  (draft.payload as Workout).status = "draft";
  assert.equal(pick([draft]), null);
});

test("bodyweight with added weight shows the added kg", () => {
  const found = heaviestLift(
    [
      record([
        set({ load: "bodyweight", extraWeight: true, weight: 20, reps: 5 }),
        set({ load: "bodyweight", extraWeight: true, weight: 25, reps: 2 }),
        set({ load: "bodyweight", reps: 12, weight: null }),
      ]),
    ],
    ID,
  );
  assert.equal(found?.set.weight, 25);
  assert.equal(found?.set.extraWeight, true);
});

test("the latest kind of load decides between barbell and added weight", () => {
  assert.equal(
    pick([
      record([set({ weight: 60 })], "2026-10-01"),
      record(
        [set({ load: "bodyweight", extraWeight: true, weight: 20 })],
        "2026-10-05",
      ),
    ])?.weight,
    20,
  );
});

test("assisted, bodyweight-only, timed and cardio exercises have no heaviest lift", () => {
  assert.equal(pick([record([set({ load: "assisted", weight: 30 })])]), null);
  assert.equal(
    pick([record([set({ load: "bodyweight", weight: null, reps: 10 })])]),
    null,
  );
  assert.equal(
    pick([
      record([
        set({ load: "bodyweight", measure: "seconds", weight: null, reps: 60 }),
      ]),
    ]),
    null,
  );
  assert.equal(
    pick([
      record([
        set({
          measure: "cardio",
          load: "weight",
          weight: null,
          reps: null,
          durationSec: 600,
        }),
      ]),
    ]),
    null,
  );
  assert.equal(pick([record([set()], "2026-10-08", "builtin:squat")]), null);
  assert.equal(pick([]), null);
});
