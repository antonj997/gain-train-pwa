import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, WorkoutSet } from "../src/data/model";
import {
  MAX_STEP_KG,
  isLowerBody,
  loadClass,
  loadIncrement,
  pctFromTarget,
  plannedWeeks,
  roundToStep,
  suggestProgression,
  targetFromPct,
  type ProgressionInput,
} from "../src/lib/progression";
import {
  defaultReps,
  detectLevel,
  estimateStartLoad,
  newProgressionItem,
  progressable,
  recentTrend,
} from "../src/data/progression";

const bench = { category: "Chest" };
const squat = { category: "Legs" };
const deadlift = { category: "Back", categories: ["Legs", "Glutes"] };
const base = (change: Partial<ProgressionInput> = {}): ProgressionInput => ({
  exercise: bench,
  startKg: 80,
  reps: 5,
  weeks: 12,
  deloadWeeks: [4, 8, 12],
  level: "intermediate",
  equipment: "barbell",
  ...change,
});

test("equipment sets the load class and the step", () => {
  assert.equal(loadClass("smith"), "barbell");
  assert.equal(loadClass("cable"), "machine");
  assert.equal(loadClass(undefined), "barbell");
  assert.equal(loadIncrement("barbell", 80), 2.5);
  assert.equal(loadIncrement("dumbbell", 24), 2);
  assert.equal(loadIncrement("dumbbell", 8), 1);
  assert.equal(loadIncrement("machine", 60), 2.5);
  assert.equal(loadIncrement("machine", 140), 5);
  assert.equal(loadIncrement("cable", 40), 2.5);
  assert.equal(loadIncrement("bodyweight", 20), 1.25);
  assert.equal(loadIncrement("kettlebell", 16), 4);
  assert.equal(roundToStep(83.4, 2.5), 82.5);
  assert.equal(roundToStep(83.9, 2.5), 85);
  assert.equal(roundToStep(-3, 2.5), 0);
});

test("legs and glutes are lower body, also as a secondary category", () => {
  assert.equal(isLowerBody(bench), false);
  assert.equal(isLowerBody(squat), true);
  assert.equal(isLowerBody(deadlift), true);
});

test("intermediates gain about 0.75 % a week, experienced about half that", () => {
  const mid = suggestProgression(base());
  // Nine training weeks, eight steps after week 1 → ~6.3 kg on 80 kg.
  assert.ok(mid.pctPerWeek > 0.5 && mid.pctPerWeek < 1, String(mid.pctPerWeek));
  assert.equal(mid.suggestedTargetKg, 85);
  assert.equal(mid.increment, 2.5);
  const old = suggestProgression(base({ level: "experienced" }));
  assert.ok(
    old.pctPerWeek > 0.2 && old.pctPerWeek < 0.5,
    String(old.pctPerWeek),
  );
  assert.equal(old.suggestedTargetKg, 82.5);
});

test("beginners add 2.5 kg a week upper body and 5 kg lower body, tapering", () => {
  const upper = suggestProgression(
    base({ level: "beginner", deloadWeeks: [], weeks: 5, startKg: 60 }),
  );
  // Four steps at 2.5 kg slightly tapered.
  assert.ok(
    upper.kgPerWeek > 2.2 && upper.kgPerWeek <= 2.5,
    String(upper.kgPerWeek),
  );
  assert.equal(upper.suggestedTargetKg, 70);
  const lower = suggestProgression(
    base({
      level: "beginner",
      exercise: squat,
      deloadWeeks: [],
      weeks: 5,
      startKg: 100,
    }),
  );
  assert.ok(
    lower.kgPerWeek > 4.4 && lower.kgPerWeek <= 5,
    String(lower.kgPerWeek),
  );
  // Over a long phase the rate falls toward half.
  const long = suggestProgression(
    base({ level: "beginner", deloadWeeks: [], weeks: 26, startKg: 60 }),
  );
  assert.ok(long.kgPerWeek < 2.2, String(long.kgPerWeek));
});

test("dumbbells and high-rep work progress slower and round to their step", () => {
  const db = suggestProgression(
    base({
      level: "beginner",
      equipment: "dumbbell",
      startKg: 24,
      deloadWeeks: [],
      weeks: 9,
    }),
  );
  assert.equal(db.increment, 2);
  assert.ok(db.kgPerWeek < 1.01, String(db.kgPerWeek));
  assert.equal(db.suggestedTargetKg % 2, 0);
  const fives = suggestProgression(
    base({ level: "beginner", deloadWeeks: [] }),
  );
  const fifteens = suggestProgression(
    base({ level: "beginner", deloadWeeks: [], reps: 15 }),
  );
  assert.ok(fifteens.kgPerWeek < fives.kgPerWeek);
});

test("a week never adds more than the cap", () => {
  // A light beginner squat: 5 kg would be 12.5 %; the cap holds it to 7.5 %.
  const light = suggestProgression(
    base({
      level: "beginner",
      exercise: squat,
      startKg: 40,
      weeks: 2,
      deloadWeeks: [],
    }),
  );
  assert.ok(light.kgPerWeek <= 40 * 0.075 + 1e-9, String(light.kgPerWeek));
  assert.ok(light.kgPerWeek <= MAX_STEP_KG);
});

test("deload weeks add nothing", () => {
  const all = suggestProgression(base({ deloadWeeks: [] }));
  const some = suggestProgression(base());
  assert.ok(some.suggestedTargetKg <= all.suggestedTargetKg);
  // Every week a deload: nothing is gained.
  const none = suggestProgression(base({ weeks: 3, deloadWeeks: [2, 3] }));
  assert.equal(none.suggestedTargetKg, 80);
});

test("a target clearly faster than the rate warns, with a realistic timeline", () => {
  const ok = suggestProgression(base({ targetKg: 85 }));
  assert.equal(ok.tooFast, false);
  const fast = suggestProgression(base({ targetKg: 100 }));
  assert.equal(fast.tooFast, true);
  assert.ok(
    fast.weeksNeeded !== null && fast.weeksNeeded > 12,
    String(fast.weeksNeeded),
  );
  // One step past the suggestion is still fine.
  const step = suggestProgression(base({ targetKg: 87.5 }));
  assert.equal(step.tooFast, false);
  // Lower or equal targets never warn.
  assert.equal(suggestProgression(base({ targetKg: 75 })).tooFast, false);
  assert.equal(suggestProgression(base({ targetKg: 75 })).weeksNeeded, 1);
  // Unreachable within two years.
  assert.equal(
    suggestProgression(base({ level: "experienced", targetKg: 400 }))
      .weeksNeeded,
    null,
  );
});

test("the timeline continues the cycle past the phase", () => {
  const plain = suggestProgression(base({ targetKg: 95 }));
  const withCycle = suggestProgression(
    base({ targetKg: 95, cycle: [false, false, false, true] }),
  );
  assert.equal(plain.weeksNeeded, withCycle.weeksNeeded);
  const noDeloads = suggestProgression(base({ targetKg: 95, cycle: [false] }));
  assert.ok(noDeloads.weeksNeeded! < withCycle.weeksNeeded!);
});

test("planned weeks rise evenly to the target, deloads hold lighter, typed weeks stay", () => {
  const weeks = plannedWeeks({
    startKg: 82.5,
    targetKg: 100,
    weeks: 12,
    deloadWeeks: [4, 8, 12],
    increment: 2.5,
    deloadLoadPct: 10,
  });
  assert.equal(weeks.length, 12);
  assert.deepEqual(
    weeks.map((w) => w.kg),
    [82.5, 85, 87.5, 80, 90, 92.5, 92.5, 82.5, 95, 97.5, 100, 90],
  );
  assert.deepEqual(
    weeks.filter((w) => w.deload).map((w) => w.week),
    [4, 8, 12],
  );
  const edited = plannedWeeks({
    startKg: 82.5,
    targetKg: 100,
    weeks: 12,
    deloadWeeks: [4, 8, 12],
    increment: 2.5,
    overrides: { "2": 83.75 },
  });
  assert.equal(edited[1].kg, 83.75);
  assert.equal(edited[1].edited, true);
  assert.equal(edited[2].kg, 87.5);
  // A single week lifts the start.
  assert.deepEqual(
    plannedWeeks({
      startKg: 60,
      targetKg: 70,
      weeks: 1,
      deloadWeeks: [],
      increment: 2.5,
    }).map((w) => w.kg),
    [60],
  );
  // Going down works too and never passes the target.
  const down = plannedWeeks({
    startKg: 100,
    targetKg: 90,
    weeks: 5,
    deloadWeeks: [],
    increment: 2.5,
  });
  assert.deepEqual(
    down.map((w) => w.kg),
    [100, 97.5, 95, 92.5, 90],
  );
});

test("percent targets land on the step and read back", () => {
  assert.equal(targetFromPct(80, 10, 2.5), 87.5);
  assert.equal(targetFromPct(24, 10, 2), 26);
  assert.equal(pctFromTarget(80, 88), 10);
  assert.equal(pctFromTarget(0, 88), 0);
});

// --- history-based helpers ---

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

test("the start load is the heaviest set at the reps in the last four weeks", () => {
  const records = [
    workout("2026-10-01", [set(90, 5)]), // older than four weeks
    workout("2026-10-20", [set(80, 5), set(82.5, 5), set(85, 3)]),
    workout("2026-10-28", [
      set(82.5, 6),
      set(100, 5, { section: "warmup" }),
      set(95, 5, { done: false }),
    ]),
  ];
  const at = estimateStartLoad(records, "builtin:bench-press", 5, "2026-11-04");
  assert.deepEqual(at, {
    kg: 82.5,
    from: "set",
    setKg: 82.5,
    setReps: 6,
    date: "2026-10-28",
  });
});

test("without a set at the reps, the e1RM converts to the reps, rounded down", () => {
  const records = [workout("2026-10-28", [set(100, 3)])];
  const at = estimateStartLoad(records, "builtin:bench-press", 8, "2026-11-04");
  // 100 × (1 + 3/30) = 110 e1RM → 110 / (1 + 8/30) = 86.8 → 85.
  assert.equal(at?.kg, 85);
  assert.equal(at?.from, "e1rm");
  // Older history (up to twelve weeks) is used when the last four are empty.
  const old = [workout("2026-09-01", [set(70, 8)])];
  assert.equal(
    estimateStartLoad(old, "builtin:bench-press", 8, "2026-11-04")?.kg,
    70,
  );
  assert.equal(
    estimateStartLoad([], "builtin:bench-press", 8, "2026-11-04"),
    null,
  );
});

test("the level comes from months and sessions logged", () => {
  assert.equal(detectLevel([], "2026-11-04").level, "beginner");
  const year = Array.from({ length: 60 }, (_, i) =>
    workout(
      new Date(Date.UTC(2025, 10, 1 + i * 6)).toISOString().slice(0, 10),
      [set(80, 5)],
    ),
  );
  assert.equal(detectLevel(year, "2026-11-04").level, "intermediate");
  const short = year.slice(-10);
  assert.equal(detectLevel(short, "2026-11-04").level, "beginner");
  const long = Array.from({ length: 160 }, (_, i) =>
    workout(new Date(Date.UTC(2024, 0, 1 + i * 5)).toISOString().slice(0, 10), [
      set(80, 5),
    ]),
  );
  assert.equal(detectLevel(long, "2026-11-04").level, "experienced");
});

test("reps come from the routine, then the log; new rows fill in a suggestion", () => {
  const records = [workout("2026-10-28", [set(80, 6), set(80, 6), set(80, 5)])];
  assert.equal(defaultReps(records, "builtin:bench-press"), 6);
  assert.equal(defaultReps([], "builtin:bench-press"), 8);
  const routineEx = {
    id: crypto.randomUUID(),
    exerciseId: "builtin:bench-press",
    name: "Bench Press",
    sets: [set(70, 10, { done: false }), set(70, 10, { done: false })],
  };
  assert.equal(defaultReps(records, "builtin:bench-press", routineEx), 10);
  const item = newProgressionItem(
    records,
    { id: "builtin:bench-press", name: "Bench Press" },
    { weeks: 12, deloadWeeks: [4, 8, 12] },
    "2026-11-04",
  );
  assert.equal(item.reps, 6);
  assert.equal(item.startKg, 80);
  assert.equal(item.level, "beginner");
  assert.ok(item.targetKg > 80);
  // No history: the routine's planned weight, else 0 to enter.
  const fresh = newProgressionItem(
    [],
    { id: "builtin:bench-press", name: "Bench Press" },
    { weeks: 12, deloadWeeks: [] },
    "2026-11-04",
    routineEx,
  );
  assert.equal(fresh.startKg, 70);
  const blank = newProgressionItem(
    [],
    { id: "builtin:squat", name: "Squat" },
    { weeks: 12, deloadWeeks: [] },
    "2026-11-04",
  );
  assert.equal(blank.startKg, 0);
  assert.equal(blank.targetKg, 0);
});

test("only weighted lifts can be progressed", () => {
  const ex = (sets: WorkoutSet[]) => ({
    id: "x",
    exerciseId: "e",
    name: "E",
    sets,
  });
  assert.equal(progressable(ex([set(60, 8)])), true);
  assert.equal(progressable(ex([set(0, 10, { load: "bodyweight" })])), false);
  assert.equal(
    progressable(ex([set(10, 8, { load: "bodyweight", extraWeight: true })])),
    true,
  );
  assert.equal(
    progressable(ex([set(0, 30, { load: "bodyweight", measure: "seconds" })])),
    false,
  );
});

test("a beginner's stalled lift gets its trend, not the beginner rate, but never below intermediate", () => {
  const fresh = suggestProgression(
    base({ level: "beginner", deloadWeeks: [] }),
  );
  const stalled = suggestProgression(
    base({ level: "beginner", deloadWeeks: [], trendKgPerWeek: 0 }),
  );
  const intermediate = suggestProgression(base({ deloadWeeks: [] }));
  assert.ok(stalled.kgPerWeek < fresh.kgPerWeek);
  assert.ok(Math.abs(stalled.kgPerWeek - intermediate.kgPerWeek) < 1e-9);
  // A trend faster than the beginner rate does not raise it.
  const flying = suggestProgression(
    base({ level: "beginner", deloadWeeks: [], trendKgPerWeek: 10 }),
  );
  assert.equal(flying.kgPerWeek, fresh.kgPerWeek);
});

test("the recent trend is the slope of each session's heaviest working set", () => {
  const records = [
    workout("2026-10-07", [set(70, 5)]),
    workout("2026-10-14", [set(72.5, 5)]),
    workout("2026-10-21", [set(75, 5)]),
    workout("2026-10-28", [set(77.5, 5), set(100, 1, { section: "warmup" })]),
  ];
  assert.ok(
    Math.abs(recentTrend(records, "builtin:bench-press", "2026-11-04")! - 2.5) <
      1e-9,
  );
  assert.equal(
    recentTrend(records.slice(0, 2), "builtin:bench-press", "2026-11-04"),
    null,
  );
});
