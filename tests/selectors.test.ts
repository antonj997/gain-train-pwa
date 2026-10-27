import test from "node:test";
import assert from "node:assert/strict";
import {
  completedWorkouts,
  customExercises,
  doneSetCount,
  draftWorkouts,
  routines,
  setCount,
  workouts,
} from "../src/data/selectors";
import {
  favouriteMarker,
  favouriteNote,
  favouriteIds,
  ownExercises,
} from "../src/data/exercises";
import { newWorkout } from "../src/data/start";
import { durationLabel } from "../src/lib/labels";
import { daysAgo, isoDate } from "../src/lib/dates";
import { historyPath, workoutPath } from "../src/lib/routes";
import type { RecordDoc, Workout, WorkoutSet } from "../src/data/model";

const base = { revision: 1, localVersion: 1, dirty: false, deleted: false };
const set = (done: boolean, reps: number | null = 5): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps,
  weight: 50,
  load: "weight",
  section: "working",
  done,
});
const workout = (
  id: string,
  date: string,
  status: Workout["status"],
  extra: Partial<RecordDoc> = {},
): RecordDoc =>
  ({
    ...base,
    id,
    kind: "workout",
    payload: {
      name: id,
      date,
      duration: null,
      startedAt: null,
      status,
      exercises: [
        {
          id: crypto.randomUUID(),
          exerciseId: "builtin:squat",
          name: "Squat",
          sets: [set(true), set(false), set(true, null)],
        },
      ],
    },
    ...extra,
  }) as RecordDoc;
const records: Record<string, RecordDoc> = Object.fromEntries(
  [
    workout("old", "2026-10-01", "completed"),
    workout("new", "2026-10-20", "completed"),
    workout("removed", "2026-10-25", "completed", { deleted: true }),
    workout("draft", "2026-10-26", "draft"),
    {
      ...base,
      id: "routine",
      kind: "routine",
      payload: { name: "Push", exercises: [] },
    } as RecordDoc,
    {
      ...base,
      id: "mine",
      kind: "exercise",
      payload: {
        name: "Landmine",
        category: "Shoulders",
        note: "",
        favourite: true,
      },
    } as RecordDoc,
    {
      ...base,
      id: "marker",
      kind: "exercise",
      payload: {
        name: "Squat",
        category: "Legs",
        note: favouriteNote("builtin:squat"),
        favourite: true,
      },
    } as RecordDoc,
  ].map((r) => [r.id, r]),
);

test("workout queries skip deleted records and sort newest first", () => {
  assert.deepEqual(
    workouts(records).map((r) => r.id),
    ["draft", "new", "old"],
  );
  assert.deepEqual(
    completedWorkouts(records).map((r) => r.id),
    ["new", "old"],
  );
  assert.deepEqual(
    draftWorkouts(Object.values(records)).map((r) => r.id),
    ["draft"],
  );
  assert.deepEqual(
    routines(records).map((r) => r.id),
    ["routine"],
  );
  assert.equal(customExercises(records).length, 2);
});

test("set counts include only checked valid sets as done", () => {
  const payload = records.draft.payload as Workout;
  assert.equal(doneSetCount(payload), 1);
  assert.equal(setCount(payload), 3);
});

test("favourite markers are hidden from the user's own exercises", () => {
  assert.deepEqual(
    ownExercises(records).map((e) => e.id),
    ["mine"],
  );
  assert.equal(favouriteMarker(records, "builtin:squat")?.id, "marker");
  assert.equal(favouriteIds(records).has("builtin:squat"), true);
  assert.equal(favouriteIds(records).has("mine"), true);
  assert.equal(favouriteIds(records).has("builtin:deadlift"), false);
});

test("new workouts start blank, from a routine, or as a past session", () => {
  const routine = records.routine as Extract<RecordDoc, { kind: "routine" }>;
  const blank = newWorkout([], {}, 1000);
  assert.equal(blank.name, "Workout");
  assert.equal(blank.startedAt, 1000);
  assert.equal(newWorkout([], { past: true }, 1000).startedAt, null);
  const fromRoutine = newWorkout([], { routine }, 1000);
  assert.equal(fromRoutine.name, "Push");
  assert.equal(fromRoutine.routineId, "routine");
});

test("shared labels, dates and routes", () => {
  assert.equal(durationLabel(0), "<1 min");
  assert.equal(durationLabel(45), "45 min");
  assert.equal(isoDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(daysAgo(30, new Date(2026, 2, 1)), "2026-01-30");
  assert.equal(workoutPath("a"), "/workout/a");
  assert.equal(historyPath("a"), "/history?workout=a");
  assert.equal(historyPath(), "/history");
});
