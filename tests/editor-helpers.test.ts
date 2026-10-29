import test from "node:test";
import assert from "node:assert/strict";
import { lastSessions } from "../src/data/workouts";
import {
  addExercises,
  assertNotFuture,
  finishWorkout,
  workoutContentKey,
} from "../src/lib/workout-editor";
import type { Workout, WorkoutRecord, WorkoutSet } from "../src/data/model";

const set = (done: boolean, reps = 5): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps,
  weight: 60,
  load: "weight",
  section: "working",
  done,
});
const workout = (
  date: string,
  sets: WorkoutSet[],
  exerciseId = "builtin:squat",
): Workout => ({
  name: "Legs",
  date,
  duration: null,
  startedAt: null,
  status: "completed",
  exercises: [{ id: crypto.randomUUID(), exerciseId, name: "Squat", sets }],
});
const record = (payload: Workout): WorkoutRecord => ({
  id: crypto.randomUUID(),
  kind: "workout",
  payload,
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
});

test("last sessions pick the newest session with a completed set per exercise", () => {
  const newest = workout("2026-10-20", [set(false)]);
  const middle = workout("2026-10-10", [set(true, 8)]);
  const oldest = workout("2026-10-01", [set(true, 3)]);
  const bench = workout("2026-10-05", [set(true)], "builtin:bench-press");
  const sessions = lastSessions([newest, middle, bench, oldest].map(record));
  assert.equal(sessions.get("builtin:squat")?.date, "2026-10-10");
  assert.equal(sessions.get("builtin:squat")?.sets[0].reps, 8);
  assert.equal(sessions.get("builtin:bench-press")?.date, "2026-10-05");
  assert.equal(sessions.has("builtin:deadlift"), false);
});

test("content key ignores key order and save timestamps but not entries", () => {
  const entry = workout("2026-10-10", [set(true)]);
  const reordered = JSON.parse(
    JSON.stringify({
      ...entry,
      schemaVersion: 1,
      createdAt: 5,
      completedAt: 9,
    }),
  );
  const flipped = Object.fromEntries(
    Object.entries(reordered).reverse(),
  ) as Workout;
  assert.equal(workoutContentKey(flipped), workoutContentKey(entry));
  assert.notEqual(
    workoutContentKey({ ...entry, name: "Other" }),
    workoutContentKey(entry),
  );
});

test("future dates are refused, including when finishing", () => {
  const future = workout("2999-01-01", [set(true)]);
  assert.throws(() => assertNotFuture(future), /today or an earlier date/);
  assert.throws(() => finishWorkout(future), /today or an earlier date/);
  assert.doesNotThrow(() => assertNotFuture(workout("2020-01-01", [])));
});

test("added exercises start from last time's checked valid sets, or one fresh set", () => {
  const last = new Map([
    [
      "builtin:squat",
      { date: "2026-01-01", sets: [set(true, 5), set(false, 8), set(true, 0)] },
    ],
  ]);
  const next = addExercises(
    workout("2026-01-02", []),
    [
      { id: "builtin:squat", name: "Squat" },
      { id: "custom:run", name: "Run", category: "Cardio" },
    ],
    last,
    () => "new-id",
  );
  const [, squat, run] = next.exercises;
  assert.equal(next.exercises.length, 3);
  assert.equal(squat.id, "new-id");
  assert.deepEqual(
    squat.sets.map((s) => [s.reps, s.done]),
    [[5, false]],
  );
  assert.equal(run.name, "Run");
  assert.equal(run.sets.length, 1);
  assert.equal(run.sets[0].done, false);
});
