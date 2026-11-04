import test from "node:test";
import assert from "node:assert/strict";
import {
  planSchema,
  validate,
  workoutSchema,
  type Exercise,
  type Plan,
  type WorkoutSet,
} from "../src/data/model";
import {
  applyPlanStart,
  cyclePreset,
  deloadOf,
  deloadWeeks,
  endsOnWeek,
  isDeloadWeek,
  keepWorkingSets,
  kindsForCycle,
  phaseEnd,
  phaseWeek,
  phaseWeeks,
  planHoldsRoutine,
  planStartFor,
  progressionWeeks,
  trimProgression,
  weekKindsOf,
  withCyclePreset,
  withWeekKind,
  withWeekOneCopied,
} from "../src/data/phase";

const ROUTINE = "6f1d2c3e-0000-4000-8000-000000000002";
const PLAN_ID = "6f1d2c3e-0000-4000-8000-000000000009";
const row = (...cells: (string | null)[]) =>
  Array.from({ length: 7 }, (_, i) => cells[i] ?? null);
// 2026-11-04 is a Wednesday; week 1 is 2–8 November.
const plan = (change: Partial<Plan> = {}): Plan & { id: string } => ({
  id: PLAN_ID,
  name: "Autumn phase",
  startDate: "2026-11-04",
  endDate: phaseEnd("2026-11-04", 12),
  cycleWeeks: 4,
  template: [row(null, null, ROUTINE), row(), row(), row()],
  weekKinds: ["normal", "normal", "normal", "deload"],
  overrides: {},
  goalIds: [],
  ...change,
});

test("a phase counts Monday-to-Sunday weeks from its first day", () => {
  assert.equal(phaseEnd("2026-11-04", 12), "2027-01-24");
  assert.equal(phaseWeeks(plan()), 12);
  assert.equal(endsOnWeek(plan()), true);
  assert.equal(endsOnWeek(plan({ endDate: "2027-01-20" })), false);
  assert.equal(phaseWeeks(plan({ endDate: "2026-11-08" })), 1);
  assert.deepEqual(phaseWeek(plan(), "2026-11-04"), { week: 1, weeks: 12, deload: false });
  assert.deepEqual(phaseWeek(plan(), "2026-11-09"), { week: 2, weeks: 12, deload: false });
  assert.deepEqual(phaseWeek(plan(), "2026-11-25"), { week: 4, weeks: 12, deload: true });
  assert.deepEqual(phaseWeek(plan(), "2026-12-23"), { week: 8, weeks: 12, deload: true });
  assert.equal(phaseWeek(plan(), "2026-11-03"), null);
  assert.equal(phaseWeek(plan(), "2027-01-25"), null);
  assert.deepEqual(deloadWeeks(plan()), [4, 8, 12]);
});

test("week kinds are lenient: unknown values, short or long lists read as normal", () => {
  assert.deepEqual(weekKindsOf(plan({ weekKinds: undefined })), ["normal", "normal", "normal", "normal"]);
  assert.deepEqual(weekKindsOf(plan({ weekKinds: ["deload", "taper"] })), ["deload", "normal", "normal", "normal"]);
  assert.deepEqual(weekKindsOf(plan({ cycleWeeks: 1, template: [row()], weekKinds: ["normal", "normal", "normal", "deload"] })), ["normal"]);
  assert.equal(isDeloadWeek(plan(), 4), true);
  assert.equal(isDeloadWeek(plan(), 5), false);
  assert.deepEqual(deloadOf(plan()), { loadPct: 10, setsPct: 50 });
  assert.deepEqual(deloadOf(plan({ deload: { loadPct: 15, setsPct: 60 } })), { loadPct: 15, setsPct: 60 });
});

test("presets set the cycle, copy week 1 into new weeks and mark the last week deload", () => {
  const one = plan({ cycleWeeks: 1, template: [row(ROUTINE)], weekKinds: undefined });
  const p31 = withCyclePreset(one, "3+1");
  assert.equal(p31.cycleWeeks, 4);
  assert.deepEqual(p31.template, [row(ROUTINE), row(ROUTINE), row(ROUTINE), row(ROUTINE)]);
  assert.deepEqual(p31.weekKinds, ["normal", "normal", "normal", "deload"]);
  assert.equal(cyclePreset(p31), "3+1");
  const p51 = withCyclePreset(p31, "5+1");
  assert.equal(p51.cycleWeeks, 6);
  assert.equal(p51.template.length, 6);
  assert.equal(cyclePreset(p51), "5+1");
  const none = withCyclePreset(p51, "none");
  assert.equal(none.cycleWeeks, 6);
  assert.equal("weekKinds" in none, false);
  assert.equal(cyclePreset(none), "none");
  assert.equal(cyclePreset(withWeekKind(p31, 1, "deload")), null);
  // Marking the only deload week normal drops the field.
  assert.equal("weekKinds" in withWeekKind(p31, 3, "normal"), false);
  // The schema checks the cycle still holds.
  assert.equal(planSchema.safeParse(p51).success, true);
});

test("week 1 copies to the other weeks; a new cycle length keeps kinds in step", () => {
  const p = plan({ template: [row(ROUTINE, "rest"), row(), row("x"), row()] });
  assert.deepEqual(withWeekOneCopied(p).template, Array(4).fill(row(ROUTINE, "rest")));
  assert.deepEqual(kindsForCycle(p, 6).weekKinds, ["normal", "normal", "normal", "deload", "normal", "normal"]);
  assert.equal("weekKinds" in kindsForCycle(p, 2), false);
});

test("a plan holds a routine through a day, a dated change or a group", () => {
  const groups = [{ id: "g1", name: "Legday", routineIds: ["r-legs"], categories: [] }];
  assert.equal(planHoldsRoutine(plan(), ROUTINE, groups), true);
  assert.equal(planHoldsRoutine(plan(), "r-legs", groups), false);
  assert.equal(planHoldsRoutine(plan({ overrides: { "2026-11-05": "group:g1" } }), "r-legs", groups), true);
});

const set = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  load: "weight",
  section: "working",
  done: false,
  ...extra,
});
const exercise = (exerciseId: string, sets: WorkoutSet[]): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: exerciseId,
  sets,
});
const equipment = (id: string) => (id === "builtin:dumbbell-curl" ? "dumbbell" : "barbell");
const progressed = plan({
  progression: [
    { exerciseId: "builtin:bench-press", name: "Bench Press", reps: 5, startKg: 82.5, targetKg: 100, level: "beginner", overrides: { "2": 83.75 } },
  ],
});

test("progression weeks follow the plan's deloads and typed weeks", () => {
  const weeks = progressionWeeks(progressed, progressed.progression![0], "barbell");
  assert.equal(weeks.length, 12);
  assert.equal(weeks[0].kg, 82.5);
  assert.equal(weeks[1].kg, 83.75);
  assert.equal(weeks[3].deload, true);
  // Typed weeks past a shortened phase are dropped on save.
  const short = { ...progressed, endDate: phaseEnd(progressed.startDate, 1) };
  assert.equal(trimProgression(short)![0].overrides, undefined);
  assert.deepEqual(trimProgression(progressed)![0].overrides, { "2": 83.75 });
});

test("a planned week prefills the planned weight and reps on working sets only", () => {
  const start = planStartFor(progressed, "2026-11-10", equipment)!;
  assert.deepEqual(start.mark, { planId: PLAN_ID, week: 2, weeks: 12 });
  const items = [
    exercise("builtin:bench-press", [set(40, 10, { section: "warmup" }), set(80, 5), set(80, 5), set(60, 8, { drop: true })]),
    exercise("builtin:squat", [set(100, 5)]),
  ];
  const { exercises, mark } = applyPlanStart(items, start, equipment);
  assert.deepEqual(exercises[0].sets.map((s) => [s.weight, s.reps]), [[40, 10], [83.75, 5], [83.75, 5], [60, 8]]);
  // Not progressed, not a deload: untouched.
  assert.equal(exercises[1], items[1]);
  assert.deepEqual(mark.loads, { "builtin:bench-press": 83.75 });
});

test("a deload week keeps half the working sets and lifts 10 % lighter", () => {
  const start = planStartFor(progressed, "2026-11-25", equipment)!;
  assert.equal(start.mark.deload, true);
  const items = [
    exercise("builtin:bench-press", [set(80, 5), set(80, 5), set(80, 5), set(80, 5)]),
    exercise("builtin:squat", [set(40, 5, { section: "warmup" }), set(100, 5), set(100, 5), set(100, 5)]),
    exercise("builtin:dumbbell-curl", [set(14, 10), set(14, 10)]),
    exercise("builtin:treadmill", [{ ...set(0, 0), reps: null, weight: null, measure: "cardio" }]),
  ];
  const { exercises, mark } = applyPlanStart(items, start, equipment);
  // Bench: two of four sets at the week's planned deload weight.
  assert.equal(exercises[0].sets.length, 2);
  const planned = progressionWeeks(progressed, progressed.progression![0], "barbell")[3].kg;
  assert.deepEqual(exercises[0].sets.map((s) => s.weight), [planned, planned]);
  // Squat: warm-up stays, 3 working → 2 (rounded), 100 → 90.
  assert.deepEqual(exercises[1].sets.map((s) => [s.section, s.weight]), [["warmup", 40], ["working", 90], ["working", 90]]);
  // Dumbbells round to 2 kg: 14 × 0.9 = 12.6 → 12; one of two sets kept.
  assert.deepEqual(exercises[2].sets.map((s) => s.weight), [12]);
  // Cardio is left alone.
  assert.equal(exercises[3], items[3]);
  assert.deepEqual(mark, { planId: PLAN_ID, week: 4, weeks: 12, deload: true, loads: { "builtin:bench-press": planned } });
});

test("dropped working sets take their drops with them", () => {
  const sets = [set(80, 5), set(60, 5, { drop: true }), set(80, 5), set(60, 5, { drop: true }), set(30, 15, { section: "winddown" })];
  const kept = keepWorkingSets(sets, 50);
  assert.deepEqual(kept.map((s) => [s.weight, !!s.drop, s.section]), [[80, false, "working"], [60, true, "working"], [30, false, "winddown"]]);
  assert.equal(keepWorkingSets(sets, 100), sets);
  // At least one set is kept.
  assert.equal(keepWorkingSets([set(80, 5)], 10).length, 1);
});

test("paused plans and dates outside the phase plan nothing", () => {
  assert.equal(planStartFor({ ...progressed, paused: true }, "2026-11-10", equipment), null);
  assert.equal(planStartFor(progressed, "2027-02-01", equipment), null);
});

test("the new fields validate, keep unknown ones and survive an older shape", () => {
  const saved = validate("plan", { ...progressed, id: undefined, future: 1 });
  assert.equal((saved as unknown as { future: number }).future, 1);
  assert.equal(saved.progression?.[0].overrides?.["2"], 83.75);
  // An unknown level reads as intermediate rather than refusing the plan.
  const odd = planSchema.parse({ ...progressed, progression: [{ ...progressed.progression![0], level: "elite" }] });
  assert.equal(odd.progression?.[0].level, "intermediate");
  // Bad numbers are refused.
  assert.equal(planSchema.safeParse({ ...progressed, deload: { loadPct: 80, setsPct: 50 } }).success, false);
  assert.equal(planSchema.safeParse({ ...progressed, progression: [{ ...progressed.progression![0], startKg: 0 }] }).success, false);
  // A workout carries its plan mark.
  const w = workoutSchema.parse({
    name: "Push",
    date: "2026-11-10",
    duration: null,
    startedAt: null,
    status: "draft",
    exercises: [],
    plan: { planId: PLAN_ID, week: 2, weeks: 12, loads: { "builtin:bench-press": 83.75 } },
  });
  assert.equal(w.plan?.week, 2);
});
