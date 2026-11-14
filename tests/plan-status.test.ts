import test from "node:test";
import assert from "node:assert/strict";
import type {
  Exercise,
  Plan,
  RecordDoc,
  Workout,
  WorkoutSet,
} from "../src/data/model";
import { REST, currentPlan, resolveCell, typeCell } from "../src/data/plans";
import { phaseEnd } from "../src/data/phase";
import { moveDay, skipDay } from "../src/data/plan-moves";
import {
  adherenceBand,
  currentPlanWeek,
  liftStatus,
  nextPlannedDay,
  otherLifts,
  pausedCountUntil,
  phaseStatus,
  planAdherence,
  planLifts,
  planMuscleSets,
  workoutsPerWeek,
} from "../src/data/plan-status";

const PUSH = "6f1d2c3e-0000-4000-8000-000000000001";
const LEGS = "6f1d2c3e-0000-4000-8000-000000000002";
const PULL = "6f1d2c3e-0000-4000-8000-000000000003";
const row = (...cells: (string | null)[]) =>
  Array.from({ length: 7 }, (_, i) => cells[i] ?? null);
const week = row(PUSH, REST, LEGS, REST, PULL, REST, REST);
// 26 October 2026 is a Monday: week 1 is 26 Oct – 1 Nov, week 3 holds 12 Nov.
const plan = (change: Partial<Plan> = {}): Plan & { id: string } => ({
  id: "6f1d2c3e-0000-4000-8000-000000000009",
  name: "Strength phase",
  startDate: "2026-10-26",
  endDate: phaseEnd("2026-10-26", 12),
  cycleWeeks: 4,
  template: [week, week, week, week],
  weekKinds: ["normal", "normal", "normal", "deload"],
  overrides: {},
  goalIds: [],
  ...change,
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
const ex = (exerciseId: string, sets: WorkoutSet[]): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: exerciseId,
  sets,
});
const workout = (
  date: string,
  exercises: Exercise[] = [ex("other", [set()])],
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

test("the phase reads week n of N, the next deload and the days left", () => {
  const status = phaseStatus(plan(), TODAY);
  assert.deepEqual(status, {
    kind: "running",
    week: 3,
    weeks: 12,
    daysLeft: 66,
    deloadNow: false,
    // Week 4 starts Monday 16 November.
    nextDeload: { week: 4, inDays: 4 },
  });
  const inDeload = phaseStatus(plan(), "2026-11-17");
  assert.equal(inDeload.kind === "running" && inDeload.deloadNow, true);
  assert.deepEqual(
    inDeload.kind === "running" ? inDeload.nextDeload : null,
    { week: 8, inDays: 27 },
  );
  assert.deepEqual(phaseStatus(plan(), "2026-10-20"), {
    kind: "upcoming",
    weeks: 12,
    daysUntil: 6,
  });
  assert.deepEqual(phaseStatus(plan(), "2027-02-01"), {
    kind: "ended",
    weeks: 12,
  });
  // No deload in the cycle: none ahead.
  const plain = phaseStatus(plan({ weekKinds: undefined }), TODAY);
  assert.equal(plain.kind === "running" && plain.nextDeload, null);
});

test("planned workouts a week count workout cells, not rest or empty", () => {
  assert.deepEqual(workoutsPerWeek(plan()), { min: 3, max: 3 });
  assert.deepEqual(
    workoutsPerWeek(
      plan({ cycleWeeks: 2, template: [week, row(PUSH, null, LEGS)] }),
    ),
    { min: 2, max: 3 },
  );
  assert.equal(workoutsPerWeek(plan({ template: [row(REST)] })), null);
});

/** The seeded month: done, missed, moved and skipped days. */
function seededPlan() {
  let p: Plan = plan();
  // Wed 4 Nov skipped to rest; Mon 9 Nov's push moved to Tue 10 Nov.
  p = skipDay(p, "2026-11-04");
  p = moveDay(p, "2026-11-09", "2026-11-10");
  return p;
}
const DONE = new Set([
  "2026-10-26",
  "2026-10-28",
  "2026-10-30",
  // 2 Nov missed; 4 Nov skipped
  "2026-11-06",
  "2026-11-07", // an extra Saturday workout
  "2026-11-10", // the moved push
  "2026-11-11",
]);

test("adherence counts planned days to yesterday; moves count on their new date", () => {
  const a = planAdherence(seededPlan(), DONE, TODAY);
  assert.equal(a.planned, 7);
  assert.equal(a.done, 6);
  assert.equal(a.missed, 1);
  assert.equal(a.percent, 86);
  assert.equal(a.band, "good");
  assert.equal(a.moved, 1);
  assert.equal(a.skipped, 1);
  assert.equal(a.weeks.length, 12);
  const states = (w: number) => a.weeks[w - 1].days.map((d) => d.state);
  assert.deepEqual(states(1), ["done", "done", "done"]);
  assert.deepEqual(states(2), ["missed", "done"]);
  // Tue 10 and Wed 11 done, Fri 13 still to come this week.
  assert.deepEqual(states(3), ["done", "done", "upcoming"]);
  assert.deepEqual(states(4), ["future", "future", "future"]);
});

test("today counts once a workout is done, else it is still to come", () => {
  const p = plan({ overrides: { [TODAY]: LEGS } });
  const open = planAdherence(p, new Set(), TODAY);
  const day = (a: typeof open) =>
    a.weeks[2].days.find((d) => d.date === TODAY)!.state;
  assert.equal(day(open), "upcoming");
  const done = planAdherence(p, new Set([TODAY]), TODAY);
  assert.equal(day(done), "done");
  assert.equal(done.planned, open.planned + 1);
  assert.equal(done.done, open.done + 1);
  // An override that puts a workout on a rest day counts as moved.
  assert.equal(done.moved, 1);
});

test("extra workouts never push adherence past 100 %", () => {
  const every = new Set<string>();
  for (let d = 26; d <= 31; d++) every.add(`2026-10-${d}`);
  for (let d = 1; d <= 11; d++) every.add(`2026-11-${String(d).padStart(2, "0")}`);
  const a = planAdherence(plan(), every, TODAY);
  assert.equal(a.percent, 100);
  assert.equal(a.done, a.planned);
});

test("the bands: 85 % and up follows, 65–84 % a little behind, under 65 % not followed", () => {
  assert.equal(adherenceBand(100), "good");
  assert.equal(adherenceBand(85), "good");
  assert.equal(adherenceBand(84), "behind");
  assert.equal(adherenceBand(65), "behind");
  assert.equal(adherenceBand(64), "off");
  const none = planAdherence(plan(), new Set(), "2026-10-26");
  assert.equal(none.planned, 0);
  assert.equal(none.percent, null);
  assert.equal(none.band, null);
});

test("deleted routines and day types follow the resolver passed in", () => {
  const names = { routines: [{ id: PUSH, payload: { name: "Push" } }], groups: [] };
  const isWorkout = (cell: string | null | undefined) => {
    const day = resolveCell(cell, names);
    return !!day && day.kind !== "rest";
  };
  // LEGS and PULL are not routines here: only Mondays (26 Oct, 2 and 9 Nov) are planned.
  const a = planAdherence(plan(), new Set(), TODAY, { isWorkout });
  assert.equal(a.planned, 3);
  const typed = plan({ template: Array(4).fill(row(typeCell("legs"))) });
  assert.equal(planAdherence(typed, new Set(), TODAY, { isWorkout }).planned, 3);
});

test("a paused plan stops counting after its last workout", () => {
  const p = plan({ paused: true });
  const until = pausedCountUntil(p, DONE, TODAY);
  assert.equal(until, "2026-11-11");
  assert.equal(pausedCountUntil(plan(), DONE, TODAY), undefined);
  assert.equal(pausedCountUntil(p, [], TODAY), "2026-10-25");
  const a = planAdherence(p, new Set(["2026-10-26"]), TODAY, {
    countUntil: "2026-10-26",
  });
  assert.equal(a.planned, 1);
  assert.equal(a.done, 1);
  assert.deepEqual(
    a.weeks[0].days.map((d) => d.state),
    ["done", "paused", "paused"],
  );
});

test("the next planned day skips today once it is done, and a paused plan has none", () => {
  const p = plan({ overrides: { [TODAY]: LEGS } });
  assert.equal(nextPlannedDay(p, TODAY, false), TODAY);
  assert.equal(nextPlannedDay(p, TODAY, true), "2026-11-13");
  assert.equal(nextPlannedDay(plan(), "2026-10-01", false), "2026-10-26");
  assert.equal(nextPlannedDay(plan({ paused: true }), TODAY, false), null);
  assert.equal(nextPlannedDay(plan(), "2027-01-17", false), null);
});

test("a lift is on plan within half a step, ahead or behind past it", () => {
  assert.equal(liftStatus(85, 85, 2.5), "on");
  assert.equal(liftStatus(86.25, 85, 2.5), "on");
  assert.equal(liftStatus(87.5, 85, 2.5), "ahead");
  assert.equal(liftStatus(83.75, 85, 2.5), "on");
  assert.equal(liftStatus(82.5, 85, 2.5), "behind");
});

test("the current plan week clamps to the phase", () => {
  assert.equal(currentPlanWeek(plan(), TODAY), 3);
  assert.equal(currentPlanWeek(plan(), "2026-01-01"), 1);
  assert.equal(currentPlanWeek(plan(), "2028-01-01"), 12);
});

test("progression rows: start and now inside the plan, planned this week, status", () => {
  // Bench 80 → 100 kg over 12 weeks with deloads at 4, 8, 12: 9 training
  // weeks, 2.5 kg a step. Week 3 plans 85 kg.
  const p = plan({
    progression: [
      { exerciseId: "bench", name: "Bench", reps: 5, startKg: 80, targetKg: 100, level: "intermediate" },
      { exerciseId: "squat", name: "Squat", reps: 5, startKg: 100, targetKg: 120, level: "intermediate" },
      { exerciseId: "row", name: "Row", reps: 8, startKg: 70, targetKg: 90, level: "intermediate" },
      { exerciseId: "dips", name: "Dips", reps: 6, startKg: 10, targetKg: 20, level: "intermediate" },
    ],
  });
  const records = [
    // Before the plan: not its start.
    workout("2026-10-20", [ex("bench", [set({ weight: 70 })])]),
    workout("2026-10-26", [
      ex("bench", [set({ weight: 80 }), set({ weight: 77.5 })]),
      ex("squat", [set({ weight: 100 })]),
      ex("row", [set({ weight: 70, reps: 8 })]),
    ]),
    workout("2026-11-11", [
      ex("bench", [set({ weight: 85 }), set({ weight: 85, section: "warmup" })]),
      ex("squat", [set({ weight: 110 })]),
      ex("row", [set({ weight: 70, reps: 8 })]),
    ]),
  ];
  const rows = planLifts(p, records, TODAY, () => "barbell");
  const by = Object.fromEntries(rows.map((r) => [r.exerciseId, r]));
  assert.equal(by.bench.start?.weight, 80);
  assert.equal(by.bench.now?.weight, 85);
  assert.equal(by.bench.plannedKg, 85);
  assert.equal(by.bench.status, "on");
  assert.equal(by.squat.plannedKg, 105);
  assert.equal(by.squat.status, "ahead");
  assert.equal(by.row.plannedKg, 75);
  assert.equal(by.row.status, "behind");
  // No session yet: the item's start weight, no status.
  assert.equal(by.dips.start, null);
  assert.equal(by.dips.now, null);
  assert.equal(by.dips.startKg, 10);
  assert.equal(by.dips.status, null);
});

test("a lift done last week is judged against last week's plan", () => {
  const p = plan({
    progression: [
      { exerciseId: "bench", name: "Bench", reps: 5, startKg: 80, targetKg: 100, level: "intermediate" },
    ],
  });
  // Week 2 plans 82.5; this week (3) plans 85.
  const records = [workout("2026-11-06", [ex("bench", [set({ weight: 82.5 })])])];
  const [bench] = planLifts(p, records, TODAY, () => "barbell");
  assert.equal(bench.plannedKg, 85);
  assert.equal(bench.status, "on");
});

test("bodyweight lifts compare the added weight", () => {
  const p = plan({
    progression: [
      { exerciseId: "dips", name: "Dips", reps: 6, startKg: 10, targetKg: 20, level: "intermediate" },
    ],
  });
  const bw = (weight: number) =>
    set({ load: "bodyweight", extraWeight: true, weight, reps: 6 });
  const records = [workout("2026-11-11", [ex("dips", [bw(10)])])];
  const [dips] = planLifts(p, records, TODAY, () => "bodyweight");
  // Week 3 of 10 → 20 kg on a 1.25 kg step plans 12.5 kg; 10 is behind.
  assert.equal(dips.plannedKg, 12.5);
  assert.equal(dips.status, "behind");
});

test("other lifts: the most trained exercises inside the plan without a progression", () => {
  const p = plan({
    progression: [
      { exerciseId: "bench", name: "Bench", reps: 5, startKg: 80, targetKg: 100, level: "intermediate" },
    ],
  });
  const body = (reps: number, weight: number | null = null) =>
    set({ load: "bodyweight", extraWeight: weight !== null, weight, reps });
  const records = [
    workout("2026-10-01", [ex("curl", [set()]), ex("curl", [set()])]),
    workout("2026-10-27", [ex("pullup", [body(8)]), ex("bench", [set()]), ex("ohp", [set({ weight: 40 })])]),
    workout("2026-11-03", [ex("pullup", [body(7, 5)]), ex("ohp", [set({ weight: 42.5 })]), ex("run", [set({ measure: "cardio", reps: null, weight: null, durationSec: 600 })])]),
    workout("2026-11-10", [ex("pullup", [body(6, 10)]), ex("lunge", [set()])]),
    workout("2026-11-11", [ex("a", [set()]), ex("b", [set()]), ex("c", [set()])]),
  ];
  const rows = otherLifts(p, records, TODAY);
  assert.deepEqual(
    rows.map((r) => r.exerciseId),
    ["pullup", "ohp", "a", "b"],
  );
  assert.equal(rows[0].sessions, 3);
  assert.equal(rows[0].start.reps, 8);
  assert.equal(rows[0].now.weight, 10);
  assert.equal(otherLifts(p, records, TODAY, 2).length, 2);
});

test("muscle sets: the weekly average over the plan's weeks so far", () => {
  const categoriesOf = (id: string) =>
    ({
      bench: { category: "Chest", categories: ["Arms", "Shoulders"] },
      squat: { category: "Legs" },
    })[id] ?? {};
  const sets = (n: number) => Array.from({ length: n }, () => set());
  const records = [
    workout("2026-10-27", [ex("bench", sets(12)), ex("squat", sets(9))]),
    workout("2026-11-03", [ex("bench", sets(12)), ex("squat", sets(9))]),
    workout("2026-11-10", [ex("bench", sets(12)), ex("squat", sets(9))]),
    // Outside the plan.
    workout("2026-10-20", [ex("bench", sets(30))]),
  ];
  const result = planMuscleSets(plan(), records, TODAY, categoriesOf)!;
  assert.equal(result.weeks, 3);
  assert.deepEqual(
    result.rows.map((r) => [r.group, r.sets, r.status]),
    [
      ["Chest", 12, "in"],
      ["Legs", 9, "under"],
      ["Shoulders", 6, "under"],
      ["Arms", 6, "under"],
    ],
  );
  assert.deepEqual(result.under, ["Legs", "Shoulders", "Arms"]);
  assert.equal(result.scale, 24);
  assert.equal(planMuscleSets(plan(), records, "2026-10-01", categoriesOf), null);
  assert.equal(planMuscleSets(plan(), [], TODAY, categoriesOf), null);
});

test("the current plan: running, else the next, else a paused one holding today", () => {
  const a = { ...plan(), id: "a" };
  const later = { ...plan({ startDate: "2027-02-01", endDate: "2027-03-01" }), id: "b" };
  assert.equal(currentPlan([a, later], TODAY)?.id, "a");
  assert.equal(currentPlan([later], TODAY)?.id, "b");
  const paused = { ...a, paused: true };
  assert.equal(currentPlan([paused, later], TODAY)?.id, "b");
  assert.equal(currentPlan([paused], TODAY)?.id, "a");
  assert.equal(currentPlan([], TODAY), null);
});
