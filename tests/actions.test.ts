import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  newSet,
  type LocalState,
  type RecordDoc,
  type Workout,
} from "../src/data/model";
import { saveRecordIn, startsRunning } from "../src/data/actions";
import { WorkoutInProgressError } from "../src/data/workout-start";
import { runningWorkouts } from "../src/data/selectors";

const workout = (startedAt: number | null, name = "Push"): Workout => ({
  name,
  date: "2026-10-28",
  duration: null,
  startedAt,
  status: "draft",
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "bench",
      name: "Bench Press",
      sets: [newSet()],
    },
  ],
});
const record = (id: string, payload: Workout): RecordDoc => ({
  id,
  kind: "workout",
  payload,
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
});
/** Two started drafts, as after a pull brought one from another device. */
function twoRunning(): { s: LocalState; mine: string; theirs: string } {
  const s = emptyState(),
    mine = crypto.randomUUID(),
    theirs = crypto.randomUUID();
  s.records[mine] = record(mine, workout(2_000, "Mine"));
  s.records[theirs] = record(theirs, workout(1_000, "Theirs"));
  return { s, mine, theirs };
}

test("a workout that is already running keeps saving after sync brings a second one", () => {
  const { s, mine, theirs } = twoRunning();
  const edited = { ...workout(2_000, "Mine"), exercises: [] };
  saveRecordIn(s, mine, "workout", edited);
  assert.equal(s.records[mine].localVersion, 2);
  assert.equal(s.records[mine].dirty, true);
  // The other device's workout can be resumed and saved here too.
  saveRecordIn(s, theirs, "workout", workout(1_000, "Theirs"));
  assert.equal(s.records[theirs].localVersion, 2);
});

test("finishing the running workout works while another one is running", () => {
  const { s, mine } = twoRunning();
  const finished: Workout = {
    ...workout(2_000, "Mine"),
    status: "completed",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "bench",
        name: "Bench Press",
        sets: [{ ...newSet(), weight: 60, reps: 5, done: true }],
      },
    ],
  };
  saveRecordIn(s, mine, "workout", finished, 5_000);
  const saved = s.records[mine].payload as Workout;
  assert.equal(saved.status, "completed");
  assert.equal(saved.completedAt, 5_000);
});

test("starting a second workout on this phone is still refused", () => {
  const s = emptyState(),
    running = crypto.randomUUID(),
    past = crypto.randomUUID(),
    fresh = crypto.randomUUID();
  s.records[running] = record(running, workout(1_000));
  s.records[past] = record(past, workout(null));
  // A new started draft, and a past draft that gains a start time.
  assert.throws(
    () => saveRecordIn(s, fresh, "workout", workout(3_000)),
    WorkoutInProgressError,
  );
  assert.throws(
    () => saveRecordIn(s, past, "workout", workout(3_000)),
    WorkoutInProgressError,
  );
  assert.equal(s.records[fresh], undefined);
  // Past drafts save as before.
  saveRecordIn(s, past, "workout", { ...workout(null), name: "Legs" });
  assert.equal((s.records[past].payload as Workout).name, "Legs");
});

test("only a transition into running counts as starting", () => {
  const running = record("a", workout(1_000));
  assert.equal(startsRunning(running, workout(1_000)), false);
  assert.equal(startsRunning(undefined, workout(1_000)), true);
  assert.equal(startsRunning(record("b", workout(null)), workout(1)), true);
  assert.equal(
    startsRunning({ ...running, deleted: true }, workout(1_000)),
    true,
  );
  assert.equal(startsRunning(undefined, workout(null)), false);
});

test("the most recently started workout is the running one", () => {
  const { s, mine, theirs } = twoRunning();
  const past = crypto.randomUUID();
  s.records[past] = record(past, workout(null));
  assert.deepEqual(
    runningWorkouts(s.records).map((r) => r.id),
    [mine, theirs],
  );
});
