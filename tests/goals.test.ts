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

const near = (actual: number | null, expected: number, within = 1e-6) =>
  assert.ok(
    actual !== null && Math.abs(actual - expected) < within,
    `${actual} is not ${expected}`,
  );

test("a one-rep lift goal compares strength and shows the bar from the starting best", () => {
  const records = [
    workout("2026-10-01", [set(90, 5)]), // before the goal: 105 estimated
    workout("2026-10-20", [set(100, 2), set(95, 1)]), // 106.7 estimated; a single is its load
  ];
  const p = goalProgress(lift(), records, noProfile, "2026-11-01");
  assert.equal(p.unit, "kg e1RM");
  near(p.start, 105);
  near(p.current, 100 * (1 + 2 / 30));
  // 110 × 1 is 110 kg of strength: a single is its own load.
  assert.equal(p.target, 110);
  near(p.fraction, (100 * (1 + 2 / 30) - 105) / 5);
  assert.equal(p.source?.date, "2026-10-20");
  assert.deepEqual([p.source?.set.weight, p.source?.set.reps], [100, 2]);
  assert.equal(p.met, false);
  assert.equal(p.reachedOn, null);
  assert.equal(p.daysLeft, 61);
});

test("now is the best session of the last four weeks, else the latest", () => {
  const records = [
    workout("2026-09-01", [set(100, 5)]), // 116.7, but long ago
    workout("2026-10-20", [set(90, 5)]), // 105
    workout("2026-10-28", [set(90, 3)]), // 99
  ];
  near(goalProgress(lift(), records, noProfile, "2026-11-01").current, 105);
  // Nothing in the last four weeks: the latest session.
  near(goalProgress(lift(), records, noProfile, "2027-01-30").current, 99);
});

test("a lift goal is reached only by the real lift, on the first day it is done", () => {
  const records = [
    workout("2026-10-01", [set(90, 5)]),
    // 105 × 2 is about 112 kg of strength: above the target, but not the lift.
    workout("2026-10-20", [set(105, 2)]),
    workout("2026-11-05", [set(110, 1)]),
    workout("2026-11-12", [set(112.5, 1)]),
  ];
  const before = goalProgress(
    lift(),
    records.slice(0, 2),
    noProfile,
    "2026-10-25",
  );
  assert.equal(before.met, false);
  assert.ok(before.current! > 110);
  // Strong enough is not done: the bar stops just short of full.
  assert.equal(before.fraction, 0.99);
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

test("a lift goal with several reps compares strength and needs the weight for the reps", () => {
  const goal = lift({ targetKg: 100, reps: 5 }); // 100 × 5 is an estimated 116.7 kg
  const records = [workout("2026-10-20", [set(90, 5)])]; // estimated 105
  const p = goalProgress(goal, records, noProfile, "2026-11-01");
  assert.equal(p.unit, "kg e1RM");
  near(p.target, 116.667, 0.01);
  near(p.current, 105, 0.01);
  assert.equal(p.met, false);
  // Nothing before the goal: the bar starts at the first session after it.
  near(p.start, 105, 0.01);
  // More strength, too light or too few reps: not met.
  for (const short of [set(95, 8), set(100, 4), set(102.5, 3)])
    assert.equal(
      goalProgress(
        goal,
        [workout("2026-10-21", [short])],
        noProfile,
        "2026-11-01",
      ).met,
      false,
    );
  // The weight for more reps than asked is met.
  const done = goalProgress(
    goal,
    [
      workout("2026-10-21", [set(100, 5)]),
      workout("2026-10-22", [set(100, 7)]),
    ],
    noProfile,
    "2026-11-01",
  );
  assert.equal(done.met, true);
  assert.equal(done.reachedOn, "2026-10-21");
});

test("an estimated-1RM goal is met by strength itself", () => {
  const goal = lift({ targetKg: 120, reps: 1, estimated: true });
  const p = goalProgress(
    goal,
    [workout("2026-10-21", [set(105, 5)])], // 122.5
    noProfile,
    "2026-11-01",
  );
  assert.equal(p.target, 120);
  assert.equal(p.met, true);
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
