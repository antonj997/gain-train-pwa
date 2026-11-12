import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, Workout, WorkoutSet } from "../src/data/model";
import {
  MUSCLE_SCALE_MIN,
  WEEKLY_SET_GUIDE,
  guideStatus,
  hardSetsByMuscle,
  isHardSet,
  weeklyMuscleSets,
} from "../src/data/muscle-sets";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 8,
  weight: 60,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
const exercise = (exerciseId: string, sets: WorkoutSet[]) => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: exerciseId,
  sets,
});
const record = (
  date: string,
  exercises: Workout["exercises"],
  status: Workout["status"] = "completed",
): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name: "W",
    date,
    duration: null,
    startedAt: null,
    status,
    exercises,
  },
});

test("hard sets are checked working sets; drops ride with their set", () => {
  assert.ok(isHardSet(set()));
  assert.ok(!isHardSet(set({ done: false })));
  assert.ok(!isHardSet(set({ section: "warmup" })));
  assert.ok(!isHardSet(set({ section: "winddown" })));
  assert.ok(!isHardSet(set({ drop: true })));
  assert.ok(!isHardSet(set({ reps: null })));
  assert.ok(
    !isHardSet(
      set({ measure: "cardio", reps: null, weight: null, durationSec: 600 }),
    ),
  );
  // A plank with no load is still a working set.
  assert.ok(
    isHardSet(set({ load: "none", weight: null, measure: "seconds", reps: 60 })),
  );
});

test("the main group counts 1 and each other group 0.5", () => {
  const lookup = (id: string) =>
    ({
      bench: { category: "Chest", categories: ["Arms", "Shoulders"] },
      curl: { category: "Arms" },
      clean: { category: "Full body", categories: ["Legs", "Back"] },
      run: { category: "Cardio" },
      mystery: {},
    })[id] ?? {};
  const sets = hardSetsByMuscle(
    [
      {
        exercises: [
          exercise("bench", [
            set({ section: "warmup" }),
            set(),
            set(),
            set({ drop: true, weight: 40 }),
            set(),
          ]),
          exercise("curl", [set(), set({ done: false })]),
          exercise("clean", [set(), set()]),
          exercise("run", [set()]),
          exercise("mystery", [set()]),
        ],
      },
    ],
    lookup,
  );
  assert.deepEqual(Object.fromEntries(sets), {
    Chest: 3,
    Arms: 1 + 1.5,
    Shoulders: 1.5,
    Legs: 1,
    Back: 1,
  });
});

test("the guide's status: under 10, 10 to 20, over 20", () => {
  assert.equal(WEEKLY_SET_GUIDE.min, 10);
  assert.equal(WEEKLY_SET_GUIDE.max, 20);
  assert.equal(guideStatus(9.5), "under");
  assert.equal(guideStatus(10), "in");
  assert.equal(guideStatus(20), "in");
  assert.equal(guideStatus(20.5), "over");
});

test("this week's sets by group, listing groups trained in the four weeks before", () => {
  // 2026-11-12 is a Thursday; the week runs 9–15 November.
  const records = [
    record("2026-11-09", [
      exercise("builtin:bench-press", Array.from({ length: 12 }, () => set())),
    ]),
    record("2026-11-11", [exercise("builtin:squat", [set(), set()])]),
    // Last week: Barbell Row, so Back is listed with 0 sets (and Arms with its half).
    record("2026-11-03", [exercise("builtin:barbell-row", [set()])]),
    // Five weeks back: too old to list Core.
    record("2026-10-05", [exercise("builtin:plank", [set()])]),
    // A draft and next week's workout count nothing.
    record("2026-11-10", [exercise("builtin:squat", [set()])], "draft"),
    record("2026-11-16", [exercise("builtin:squat", [set()])]),
  ];
  const week = weeklyMuscleSets(records, "2026-11-12");
  assert.equal(week.start, "2026-11-09");
  assert.equal(week.end, "2026-11-15");
  assert.deepEqual(
    week.rows.map((row) => [row.group, row.sets, row.status]),
    [
      ["Chest", 12, "in"],
      ["Back", 0, "under"],
      ["Legs", 2, "under"],
      ["Shoulders", 6, "under"],
      ["Arms", 6, "under"],
      ["Glutes", 1, "under"],
    ],
  );
  assert.equal(week.scale, MUSCLE_SCALE_MIN);
});

test("custom exercises count by their own categories; the scale grows past 24", () => {
  const custom: RecordDoc = {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "exercise",
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted: false,
    payload: {
      name: "Sled pull",
      category: "Back",
      categories: ["Legs"],
      note: "",
      favourite: false,
    },
  };
  const records = [
    custom,
    record("2026-11-10", [
      exercise(custom.id, Array.from({ length: 30 }, () => set())),
    ]),
  ];
  const week = weeklyMuscleSets(records, "2026-11-15");
  assert.deepEqual(
    week.rows.map((row) => [row.group, row.sets, row.status]),
    [
      ["Back", 30, "over"],
      ["Legs", 15, "in"],
    ],
  );
  assert.equal(week.scale, 30);
});

test("an empty log lists nothing", () => {
  assert.deepEqual(weeklyMuscleSets([], "2026-11-12").rows, []);
});
