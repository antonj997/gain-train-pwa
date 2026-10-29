import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  newSet,
  type LocalState,
  type RecordDoc,
  type Workout,
} from "../src/data/model";
import {
  copyPhoneLogIn,
  copySummary,
  importRecordsIn,
  importSummary,
  parseImport,
  saveLibraryIn,
  saveRecordIn,
  startsRunning,
} from "../src/data/actions";
import { hiddenIds, libraryOf, libraryRecordId } from "../src/data/exercises";
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

test("a restore counts added, brought back and kept records", () => {
  const s = emptyState(),
    live = crypto.randomUUID(),
    gone = crypto.randomUUID(),
    fresh = crypto.randomUUID();
  s.records[live] = record(live, workout(null, "Live"));
  s.records[gone] = { ...record(gone, workout(null, "Gone")), deleted: true };
  const backup = [live, gone, fresh].map((id) =>
    record(id, workout(null, "Backup")),
  );
  const result = importRecordsIn(s, parseImport(backup));
  assert.deepEqual(result, { added: 1, restored: 1, kept: 1 });
  assert.equal((s.records[live].payload as Workout).name, "Live");
  assert.equal(s.records[gone].deleted, false);
  assert.match(importSummary(result), /1 record added/);
  assert.match(importSummary(result), /1 deleted record brought back/);
  assert.match(importSummary(result), /1 already here was kept/);
  assert.match(
    importSummary({ added: 0, restored: 0, kept: 4 }),
    /Nothing to restore/,
  );
});

const library = (
  id: string,
  hiddenExerciseIds: string[],
  groups?: { id: string; name: string }[],
): RecordDoc => ({
  id,
  kind: "library",
  payload: {
    hiddenExerciseIds,
    ...(groups
      ? {
          groups: groups.map((g) => ({ ...g, routineIds: [], categories: [] })),
        }
      : {}),
  },
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
});

test("copying the phone log merges its library and runs no second workout", () => {
  const account = crypto.randomUUID(),
    s = emptyState(),
    running = crypto.randomUUID(),
    phoneRunning = crypto.randomUUID(),
    deletedHere = crypto.randomUUID(),
    shared = crypto.randomUUID(),
    groupA = crypto.randomUUID(),
    groupB = crypto.randomUUID();
  s.records[running] = record(running, workout(5_000, "Account"));
  s.records[deletedHere] = {
    ...record(deletedHere, workout(null)),
    deleted: true,
  };
  s.records[shared] = record(shared, workout(null, "Account copy"));
  s.records[libraryRecordId(account)] = library(
    libraryRecordId(account),
    ["squat"],
    [{ id: groupA, name: "Legday" }],
  );
  const phone = [
    record(phoneRunning, workout(1_000, "Phone")),
    record(deletedHere, workout(null, "Deleted in the account")),
    record(shared, workout(null, "Phone copy")),
    library(
      libraryRecordId("phone"),
      ["bench", "squat"],
      [
        { id: groupA, name: "Phone legday" },
        { id: groupB, name: "Pushday" },
      ],
    ),
  ];
  const result = copyPhoneLogIn(s, account, parseImport(phone));
  assert.deepEqual(result, { added: 1, pastWorkouts: 1 });
  // The phone's running workout arrives as a past one; the account's runs on.
  assert.equal((s.records[phoneRunning].payload as Workout).startedAt, null);
  assert.deepEqual(
    runningWorkouts(s.records).map((r) => r.id),
    [running],
  );
  // Deleted in the account stays deleted; the account's copy is kept.
  assert.equal(s.records[deletedHere].deleted, true);
  assert.equal((s.records[shared].payload as Workout).name, "Account copy");
  // One library record: hidden ids of both, groups by id with the account's first.
  assert.equal(s.records[libraryRecordId("phone")], undefined);
  const merged = libraryOf(s.records, account);
  assert.deepEqual([...merged.hiddenExerciseIds].sort(), ["bench", "squat"]);
  assert.deepEqual(
    merged.groups?.map((g) => g.name),
    ["Legday", "Pushday"],
  );
  assert.match(copySummary(result), /Copied 1 record.*past workout/);
});

test("an earlier copy's second library record is folded in on the next save", () => {
  const account = crypto.randomUUID(),
    s = emptyState(),
    own = libraryRecordId(account),
    stray = libraryRecordId("phone");
  s.records[own] = library(own, ["squat"]);
  s.records[stray] = library(stray, ["bench"]);
  assert.deepEqual(hiddenIds(s.records), new Set(["squat", "bench"]));
  // Unhiding an exercise the phone's record hid now sticks.
  const next = libraryOf(s.records, account);
  saveLibraryIn(s, account, {
    ...next,
    hiddenExerciseIds: next.hiddenExerciseIds.filter((id) => id !== "bench"),
  });
  assert.equal(s.records[stray].deleted, true);
  assert.deepEqual(hiddenIds(s.records), new Set(["squat"]));
});

test("a record too large for the server is refused before it is queued", () => {
  const s = emptyState(),
    id = crypto.randomUUID();
  const huge = { ...workout(null), name: "Big" };
  huge.exercises = Array.from({ length: 100 }, () => ({
    id: crypto.randomUUID(),
    exerciseId: "x".repeat(200),
    name: "N".repeat(100),
    sets: Array.from({ length: 100 }, () => newSet()),
  }));
  assert.throws(() => saveRecordIn(s, id, "workout", huge), /too large/);
  assert.equal(s.records[id], undefined);
});
