import test from "node:test";
import assert from "node:assert/strict";
import {
  goalSchema,
  type Goal,
  type RecordDoc,
  type WorkoutSet,
} from "../src/data/model";
import { activeGoals, goalProgress, goalTitle } from "../src/data/goals";

const set = (
  weight: number,
  reps: number,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  load: "weight",
  section: "working",
  done: true,
  ...extra,
});
const workout = (
  date: string,
  sets: WorkoutSet[],
  exerciseId = "builtin:bench-press",
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
    exercises: [
      { id: crypto.randomUUID(), exerciseId, name: "Bench Press", sets },
    ],
  },
});
const created = new Date("2026-10-10T12:00:00").getTime();
const lift = (change: Partial<Goal> = {}): Goal => ({
  kind: "lift",
  targetKg: 110,
  reps: 1,
  exerciseId: "builtin:bench-press",
  exerciseName: "Bench Press",
  byDate: "2027-01-01",
  createdAt: created,
  ...change,
});
const noProfile = { bodyWeightKg: null };

test("a one-rep lift goal compares the heaviest set and shows the bar from the starting best", () => {
  const records = [
    workout("2026-10-01", [set(90, 5)]), // before the goal: the starting point
    workout("2026-10-20", [set(100, 3), set(95, 8)]),
  ];
  const p = goalProgress(lift(), records, noProfile, "2026-11-01");
  assert.equal(p.unit, "kg");
  assert.equal(p.start, 90);
  assert.equal(p.current, 100);
  assert.equal(p.target, 110);
  assert.equal(p.fraction, 0.5);
  assert.equal(p.met, false);
  assert.equal(p.reachedOn, null);
  assert.equal(p.daysLeft, 61);
});

test("a lift goal is reached on the first day a set meets it, and keeps that day", () => {
  const records = [
    workout("2026-10-01", [set(90, 5)]),
    workout("2026-10-20", [set(105, 2)]),
    workout("2026-11-05", [set(110, 1)]),
    workout("2026-11-12", [set(112.5, 1)]),
  ];
  const p = goalProgress(lift(), records, noProfile, "2026-11-20");
  assert.equal(p.met, true);
  assert.equal(p.reachedOn, "2026-11-05");
  assert.equal(p.fraction, 1);
  // A stored reachedOn wins.
  assert.equal(
    goalProgress(lift({ reachedOn: "2026-11-06" }), [], noProfile, "2026-11-20")
      .reachedOn,
    "2026-11-06",
  );
});

test("a lift goal with several reps compares estimated one-rep maxes", () => {
  const goal = lift({ targetKg: 100, reps: 5 }); // 100 x 5 is an estimated 116.7 kg
  const records = [workout("2026-10-20", [set(90, 5)])]; // estimated 105
  const p = goalProgress(goal, records, noProfile, "2026-11-01");
  assert.equal(p.unit, "kg e1RM");
  assert.ok(Math.abs(p.target - 116.667) < 0.01);
  assert.ok(Math.abs(p.current! - 105) < 0.01);
  assert.equal(p.met, false);
  assert.equal(p.start, 0);
  const done = goalProgress(
    goal,
    [workout("2026-10-21", [set(100, 5)])],
    noProfile,
    "2026-11-01",
  );
  assert.equal(done.met, true);
  assert.equal(done.reachedOn, "2026-10-21");
});

test("warm-ups, drops, unchecked sets and other exercises do not count", () => {
  const records = [
    workout("2026-10-20", [
      set(200, 1, { section: "warmup" }),
      set(200, 1, { done: false }),
      set(200, 1, { drop: true }),
    ]),
    workout("2026-10-21", [set(200, 1)], "builtin:squat"),
  ];
  const p = goalProgress(lift(), records, noProfile, "2026-11-01");
  assert.equal(p.current, null);
  assert.equal(p.fraction, 0);
  assert.equal(p.met, false);
});

test("a goal already met when it was made is reached on the day it was made", () => {
  const records = [workout("2026-10-01", [set(115, 1)])];
  const p = goalProgress(lift(), records, noProfile, "2026-11-01");
  assert.equal(p.met, true);
  assert.equal(p.reachedOn, "2026-10-10");
});

test("a bodyweight goal runs from the saved starting weight to the target, down or up", () => {
  const cut: Goal = {
    kind: "bodyweight",
    targetKg: 80,
    startKg: 90,
    byDate: "2026-12-31",
    createdAt: created,
  };
  const half = goalProgress(cut, [], { bodyWeightKg: 85 }, "2026-11-01");
  assert.deepEqual(
    [half.start, half.current, half.target, half.fraction, half.met],
    [90, 85, 80, 0.5, false],
  );
  assert.equal(half.daysLeft, 60);
  const reached = goalProgress(cut, [], { bodyWeightKg: 79.5 }, "2026-11-01");
  assert.equal(reached.met, true);
  assert.equal(reached.reachedOn, "2026-11-01");
  assert.equal(
    goalProgress(
      { ...cut, reachedOn: "2026-10-30" },
      [],
      { bodyWeightKg: 85 },
      "2026-11-01",
    ).reachedOn,
    "2026-10-30",
  );
  // Going the wrong way gives an empty bar, not a negative one.
  assert.equal(
    goalProgress(cut, [], { bodyWeightKg: 95 }, "2026-11-01").fraction,
    0,
  );

  const bulk: Goal = { ...cut, targetKg: 100, startKg: 90 };
  assert.equal(
    goalProgress(bulk, [], { bodyWeightKg: 95 }, "2026-11-01").fraction,
    0.5,
  );
  assert.equal(
    goalProgress(bulk, [], { bodyWeightKg: 101 }, "2026-11-01").met,
    true,
  );
  // Without a bodyweight there is nothing to compare.
  const none = goalProgress(cut, [], noProfile, "2026-11-01");
  assert.deepEqual([none.current, none.fraction, none.met], [null, 0, false]);
});

test("days left goes negative after the date", () => {
  assert.equal(
    goalProgress(lift({ byDate: "2026-10-25" }), [], noProfile, "2026-10-28")
      .daysLeft,
    -3,
  );
});

test("goals validate with a starting weight, are listed soonest first and have titles", () => {
  assert.equal(
    goalSchema.safeParse({
      kind: "bodyweight",
      targetKg: 80,
      startKg: 90,
      byDate: "2026-12-31",
      createdAt: created,
    }).success,
    true,
  );
  assert.equal(
    goalSchema.safeParse({
      kind: "bodyweight",
      targetKg: 80,
      startKg: 0,
      byDate: "2026-12-31",
      createdAt: created,
    }).success,
    false,
  );
  const record = (id: string, payload: Goal, deleted = false) =>
    ({
      id,
      kind: "goal",
      payload,
      revision: 1,
      localVersion: 1,
      dirty: false,
      deleted,
    }) as RecordDoc;
  const later = lift({ byDate: "2027-03-01" });
  const sooner = lift({ byDate: "2027-01-01" });
  assert.deepEqual(
    activeGoals({
      a: record("a", later),
      b: record("b", sooner),
      c: record("c", sooner, true),
    }).map((g) => g.id),
    ["b", "a"],
  );
  assert.equal(goalTitle(lift()), "Bench Press 110 kg × 1");
  assert.equal(
    goalTitle({
      kind: "bodyweight",
      targetKg: 80.5,
      byDate: "2026-12-31",
      createdAt: created,
    }),
    "Bodyweight 80.5 kg",
  );
});
