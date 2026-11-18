import test from "node:test";
import assert from "node:assert/strict";
import type {
  Exercise,
  Plan,
  RecordDoc,
  Workout,
  WorkoutSet,
} from "../src/data/model";
import { REST } from "../src/data/plans";
import { phaseEnd } from "../src/data/phase";
import { planMuscleSets } from "../src/data/plan-status";
import type { ExerciseMuscles } from "../src/data/muscles";
import {
  WEEK_HEAT,
  hardSetsPerMuscle,
  heatStep,
  planMuscleMap,
} from "../src/data/muscle-map";

const DAY = "6f1d2c3e-0000-4000-8000-000000000001";
const week = [DAY, REST, DAY, REST, DAY, REST, REST];
// 26 October 2026 is a Monday: week 1 is 26 Oct – 1 Nov, week 3 holds 12 Nov.
const plan = (): Plan => ({
  name: "Strength phase",
  startDate: "2026-10-26",
  endDate: phaseEnd("2026-10-26", 12),
  cycleWeeks: 4,
  template: [week, week, week, week],
  weekKinds: ["normal", "normal", "normal", "deload"],
  overrides: {},
  goalIds: [],
});
const TODAY = "2026-11-12"; // Thursday, week 3

const set = (change: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 80,
  load: "weight",
  section: "working",
  done: true,
  ...change,
});
const sets = (n: number) => Array.from({ length: n }, () => set());
const ex = (exerciseId: string, list: WorkoutSet[]): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: exerciseId,
  sets: list,
});
const workout = (
  date: string,
  exercises: Exercise[],
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
    duration: 50,
    startedAt: null,
    status,
    exercises,
  },
});

const MUSCLES_OF: Record<string, ExerciseMuscles> = {
  bench: { chest: 1, triceps: 0.5 },
  squat: { quads: 1, glutes: 1 },
  row: { lats: 1, upperBack: 1, biceps: 0.5 },
  bike: { quads: 0.5 },
};
const musclesOf = (id: string) => MUSCLES_OF[id] ?? {};

test("each hard set adds its level to each of the exercise's muscles", () => {
  const result = hardSetsPerMuscle(
    [
      {
        exercises: [
          ex("bench", [
            ...sets(3),
            set({ section: "warmup" }),
            set({ done: false }),
          ]),
          ex("row", sets(2)),
          ex("unknown", sets(5)),
        ],
      },
      { exercises: [ex("bench", sets(1))] },
    ],
    musclesOf,
  );
  assert.deepEqual(Object.fromEntries(result), {
    chest: 4,
    triceps: 2,
    lats: 2,
    upperBack: 2,
    biceps: 1,
  });
});

test("cardio sets are never hard sets, so cardio adds nothing", () => {
  const cardio = set({
    reps: null,
    weight: null,
    measure: "cardio",
    durationSec: 1200,
  });
  assert.equal(
    hardSetsPerMuscle([{ exercises: [ex("bike", [cardio])] }], musclesOf).size,
    0,
  );
});

const records = [
  // Plan weeks 1 and 2 (from Monday 26 Oct): finished.
  workout("2026-10-27", [ex("bench", sets(12)), ex("squat", sets(9))]),
  workout("2026-11-03", [ex("bench", sets(14)), ex("squat", sets(11))]),
  // Week 3, which holds TODAY (Thursday 12 Nov): so far.
  workout("2026-11-10", [ex("bench", sets(4)), ex("row", sets(1))]),
  // Outside the plan, and a workout still in progress.
  workout("2026-10-20", [ex("bench", sets(30))]),
  workout("2026-11-11", [ex("squat", sets(30))], "draft"),
];

test("the plan map: this week as it stands, the average over finished weeks", () => {
  const map = planMuscleMap(plan(), records, TODAY, musclesOf)!;
  assert.equal(map.week, 3);
  assert.equal(map.weeks, 2);
  assert.equal(map.ended, false);
  assert.deepEqual(map.thisWeek, {
    chest: 4,
    biceps: 0.5,
    triceps: 2,
    upperBack: 1,
    lats: 1,
  });
  assert.deepEqual(map.average, {
    chest: 13,
    triceps: 6.5,
    glutes: 10,
    quads: 10,
  });
});

test("a new week leaves the average alone; the first week has none", () => {
  const monday = planMuscleMap(
    plan(),
    records.slice(0, 2),
    "2026-11-09",
    musclesOf,
  )!;
  assert.equal(monday.weeks, 2);
  assert.deepEqual(monday.thisWeek, {});
  assert.equal(monday.average!.chest, 13);

  const first = planMuscleMap(
    plan(),
    records.slice(0, 1),
    "2026-10-29",
    musclesOf,
  )!;
  assert.equal(first.weeks, 0);
  assert.equal(first.average, null);
  assert.deepEqual(first.thisWeek, {
    chest: 12,
    triceps: 6,
    glutes: 9,
    quads: 9,
  });
});

test("after the end every week is finished and the average is to the half set", () => {
  const after = planMuscleMap(plan(), records, "2027-02-01", musclesOf)!;
  assert.equal(after.ended, true);
  assert.equal(after.week, 12);
  assert.equal(after.weeks, 12);
  assert.deepEqual(after.thisWeek, {});
  // 30 / 12 = 2.5; 15 / 12 = 1.25 → 1.5; 20 / 12 = 1.67 → 1.5. The single
  // row set (1 / 12, and 0.5 / 12 for the biceps) rounds to none: left out.
  assert.deepEqual(after.average, {
    chest: 2.5,
    triceps: 1.5,
    glutes: 1.5,
    quads: 1.5,
  });
});

test("the plan map is null where the sets per group are", () => {
  const categoriesOf = (id: string) =>
    ({ bench: { category: "Chest" }, squat: { category: "Legs" } })[id] ?? {};
  assert.equal(planMuscleMap(plan(), records, "2026-10-01", musclesOf), null);
  assert.equal(planMuscleMap(plan(), [], TODAY, musclesOf), null);
  assert.equal(
    planMuscleMap(plan(), [records[3]], TODAY, musclesOf),
    planMuscleSets(plan(), [records[3]], TODAY, categoriesOf),
  );
  // Both count the same weeks, whatever the day.
  for (const day of [
    "2026-10-27",
    "2026-11-01",
    "2026-11-02",
    TODAY,
    phaseEnd("2026-10-26", 12),
    "2027-02-01",
  ]) {
    const map = planMuscleMap(plan(), records, day, musclesOf)!;
    const groups = planMuscleSets(plan(), records, day, categoriesOf)!;
    assert.deepEqual(
      [map.week, map.weeks, map.ended],
      [groups.week, groups.weeks, groups.ended],
      day,
    );
  }
});

test("heat steps: untrained, under 5, 5–9, 10–14, 15–19 and 20 or more", () => {
  assert.deepEqual(WEEK_HEAT, [0.5, 5, 10, 15, 20]);
  const cases: [number, number][] = [
    [0, 0],
    [0.25, 0],
    [0.5, 1],
    [4.5, 1],
    [5, 2],
    [9.5, 2],
    [10, 3],
    [14.5, 3],
    [15, 4],
    [19.5, 4],
    [20, 5],
    [42, 5],
  ];
  for (const [sets, step] of cases) assert.equal(heatStep(sets), step, sets);
});
