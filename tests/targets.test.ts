import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, Workout, WorkoutSet } from "../src/data/model";
import {
  HOLD_STEP_SEC,
  deloadFor,
  suggestTarget,
  targetHistory,
  targetLabel,
  workoutTargets,
} from "../src/data/targets";
import { setCurrentLanguage } from "../src/i18n";
import { KG_PER_LB } from "../src/lib/units";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 80,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});

test("with a range, the top of it adds 2.5 kg and starts at the bottom", () => {
  const range = { min: 6, max: 8 };
  assert.deepEqual(
    suggestTarget([set({ reps: 8 })], { repRange: range }, "kg"),
    { weight: 82.5, reps: 6 },
  );
  // Above the top counts too.
  assert.deepEqual(
    suggestTarget([set({ reps: 9 })], { repRange: range }, "kg"),
    { weight: 82.5, reps: 6 },
  );
});

test("with a range, short of the top asks for one more rep, never past the top", () => {
  const range = { min: 6, max: 8 };
  assert.deepEqual(
    suggestTarget([set({ reps: 6 })], { repRange: range }, "kg"),
    { weight: 80, reps: 7 },
  );
  // Below the range still asks for one more.
  assert.deepEqual(
    suggestTarget([set({ reps: 4 })], { repRange: range }, "kg"),
    { weight: 80, reps: 5 },
  );
});

test("an invalid range is ignored", () => {
  assert.deepEqual(
    suggestTarget(
      [set({ reps: 8 })],
      { repRange: { min: 9, max: 6 }, lastTarget: { weight: 80, reps: 9 } },
      "kg",
    ),
    { weight: 80, reps: 9 },
  );
});

test("without a range, reaching last target adds weight at the same reps", () => {
  assert.deepEqual(
    suggestTarget(
      [set({ reps: 6 })],
      { lastTarget: { weight: 80, reps: 6 } },
      "kg",
    ),
    { weight: 82.5, reps: 6 },
  );
  // Missing it keeps the weight and asks for one more rep.
  assert.deepEqual(
    suggestTarget(
      [set({ reps: 5 })],
      { lastTarget: { weight: 80, reps: 6 } },
      "kg",
    ),
    { weight: 80, reps: 6 },
  );
  // Fewer kilos than the target is not reaching it.
  assert.deepEqual(
    suggestTarget(
      [set({ reps: 6, weight: 77.5 })],
      { lastTarget: { weight: 80, reps: 6 } },
      "kg",
    ),
    { weight: 77.5, reps: 7 },
  );
});

test("without a range or a kept target, last target is worked out from the session before", () => {
  // Two sessions ago 80 × 5 made the target 80 × 6; last time hit it.
  assert.deepEqual(
    suggestTarget([set({ reps: 6 }), set({ reps: 5 })], {}, "kg"),
    { weight: 82.5, reps: 6 },
  );
  // Last time missed it.
  assert.deepEqual(
    suggestTarget([set({ reps: 5 }), set({ reps: 5 })], {}, "kg"),
    { weight: 80, reps: 6 },
  );
  // With one session, there is no target to have reached: one more rep.
  assert.deepEqual(suggestTarget([set({ reps: 5 })], {}, "kg"), {
    weight: 80,
    reps: 6,
  });
  // A chain: 80×5 → target 80×6, hit → 82.5×6, did 82.5×6 → hit again.
  assert.deepEqual(
    suggestTarget(
      [set({ reps: 6, weight: 82.5 }), set({ reps: 6 }), set({ reps: 5 })],
      {},
      "kg",
    ),
    { weight: 85, reps: 6 },
  );
});

test("in pounds the step is 5 lb, on the pound grid", () => {
  const lb = (n: number) => Math.round(n * KG_PER_LB * 1000) / 1000;
  const target = suggestTarget(
    [set({ weight: lb(185), reps: 8 })],
    { repRange: { min: 6, max: 8 } },
    "lb",
  )!;
  assert.equal(target.reps, 6);
  assert.ok(Math.abs(target.weight! - lb(190)) < 0.001, String(target.weight));
});

test("plain bodyweight only adds reps, even at the top of the range", () => {
  const bw = set({ load: "bodyweight", weight: null, reps: 12 });
  assert.deepEqual(
    suggestTarget([bw], { repRange: { min: 8, max: 12 } }, "kg"),
    { weight: null, reps: 13 },
  );
  assert.deepEqual(suggestTarget([bw], {}, "kg"), { weight: null, reps: 13 });
});

test("bodyweight with added weight steps the added weight", () => {
  const plus = set({
    load: "bodyweight",
    extraWeight: true,
    weight: 10,
    reps: 8,
  });
  assert.deepEqual(
    suggestTarget([plus], { repRange: { min: 6, max: 8 } }, "kg"),
    { weight: 12.5, reps: 6 },
  );
});

test("assisted steps the help down, and with none left adds reps", () => {
  const assisted = set({ load: "assisted", weight: 20, reps: 8 });
  assert.deepEqual(
    suggestTarget([assisted], { repRange: { min: 6, max: 8 } }, "kg"),
    { weight: 17.5, reps: 6 },
  );
  // Less help than the target counts as reaching it.
  assert.deepEqual(
    suggestTarget(
      [set({ load: "assisted", weight: 15, reps: 6 })],
      { lastTarget: { weight: 17.5, reps: 6 } },
      "kg",
    ),
    { weight: 12.5, reps: 6 },
  );
  assert.deepEqual(
    suggestTarget(
      [set({ load: "assisted", weight: 0, reps: 8 })],
      { repRange: { min: 6, max: 8 } },
      "kg",
    ),
    { weight: 0, reps: 9 },
  );
});

test("holds count seconds and ask for five more", () => {
  const hold = set({
    load: "bodyweight",
    weight: null,
    measure: "seconds",
    reps: 45,
  });
  assert.deepEqual(suggestTarget([hold], {}, "kg"), {
    weight: null,
    reps: 45 + HOLD_STEP_SEC,
  });
  // A weighted hold at its target adds weight.
  const weighted = set({ measure: "seconds", weight: 16, reps: 60 });
  assert.deepEqual(
    suggestTarget([weighted], { lastTarget: { weight: 16, reps: 60 } }, "kg"),
    { weight: 18.5, reps: 60 },
  );
});

test("no target without a usable set last time", () => {
  assert.equal(suggestTarget([], {}, "kg"), null);
  assert.equal(suggestTarget([set({ done: false })], {}, "kg"), null);
  assert.equal(suggestTarget([set({ section: "warmup" })], {}, "kg"), null);
  assert.equal(suggestTarget([set({ section: "winddown" })], {}, "kg"), null);
  assert.equal(suggestTarget([set({ drop: true })], {}, "kg"), null);
  assert.equal(
    suggestTarget([set({ load: "none", weight: null })], {}, "kg"),
    null,
  );
  assert.equal(
    suggestTarget(
      [
        set({
          measure: "cardio",
          reps: null,
          weight: null,
          durationSec: 600,
        }),
      ],
      {},
      "kg",
    ),
    null,
  );
});

test("a deload week lightens the weight and adds nothing", () => {
  assert.deepEqual(
    suggestTarget(
      [set({ weight: 100, reps: 5 })],
      { repRange: { min: 3, max: 5 }, deload: { loadPct: 10 } },
      "kg",
    ),
    { weight: 90, reps: 5 },
  );
  // Rounded to the 2.5 kg step.
  assert.deepEqual(
    suggestTarget(
      [set({ weight: 82.5, reps: 5 })],
      { deload: { loadPct: 10 } },
      "kg",
    ),
    { weight: 75, reps: 5 },
  );
  // Assisted gets more help; bodyweight keeps its reps.
  assert.deepEqual(
    suggestTarget(
      [set({ load: "assisted", weight: 20, reps: 8 })],
      { deload: { loadPct: 25 } },
      "kg",
    ),
    { weight: 25, reps: 8 },
  );
  assert.deepEqual(
    suggestTarget(
      [set({ load: "bodyweight", weight: null, reps: 10 })],
      { deload: { loadPct: 10 } },
      "kg",
    ),
    { weight: null, reps: 10 },
  );
  // Added weight never rounds down to nothing.
  assert.deepEqual(
    suggestTarget(
      [set({ load: "bodyweight", extraWeight: true, weight: 1.25, reps: 8 })],
      { deload: { loadPct: 50 } },
      "kg",
    ),
    { weight: 2.5, reps: 8 },
  );
});

const PLAN = "11111111-1111-4111-8111-111111111111";
const record = (
  date: string,
  sets: WorkoutSet[],
  extra: Partial<Workout> = {},
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
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:bench-press",
        name: "Bench Press",
        sets,
      },
    ],
    ...extra,
  },
});

test("targetHistory lists the matching set of each earlier session, skipping deload weeks", () => {
  const records = [
    record("2026-11-01", [set({ reps: 5 }), set({ reps: 4 })]),
    record("2026-11-04", [set({ weight: 70, reps: 5 }), set({ reps: 5 })], {
      plan: { planId: PLAN, week: 4, weeks: 8, deload: true },
    }),
    record("2026-11-08", [set({ reps: 6 }), set({ reps: 5 })]),
  ];
  const current = {
    id: crypto.randomUUID(),
    payload: {
      ...(records[0].payload as Workout),
      date: "2026-11-12",
      status: "draft" as const,
      exercises: [
        {
          id: crypto.randomUUID(),
          exerciseId: "builtin:bench-press",
          name: "Bench Press",
          sets: [set({ done: false }), set({ done: false })],
        },
      ],
    },
  };
  const second = targetHistory(records, current, 0, 1);
  assert.deepEqual(
    second.map((s) => s.reps),
    [5, 4],
  );
  const first = targetHistory(records, current, 0, 0);
  assert.deepEqual(
    first.map((s) => s.reps),
    [6, 5],
  );
  assert.deepEqual(suggestTarget(first, {}, "kg"), { weight: 82.5, reps: 6 });
  assert.deepEqual(targetHistory(records, current, 3, 0), []);
});

test("deloadFor reads the plan's cut, the default without the plan", () => {
  const plan: RecordDoc = {
    id: PLAN,
    kind: "plan",
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted: false,
    payload: {
      name: "Phase",
      startDate: "2026-11-02",
      endDate: "2026-12-27",
      cycleWeeks: 1,
      template: [[null, null, null, null, null, null, null]],
      overrides: {},
      goalIds: [],
      deload: { loadPct: 20, setsPct: 50 },
    },
  };
  const mark = { planId: PLAN, week: 4, weeks: 8, deload: true };
  assert.deepEqual(deloadFor([plan], { plan: mark }), { loadPct: 20 });
  assert.deepEqual(deloadFor([], { plan: mark }), { loadPct: 10 });
  assert.equal(deloadFor([plan], { plan: { ...mark, deload: false } }), null);
  assert.equal(deloadFor([plan], {}), null);
});

test("targetLabel reads the target in the set's words", () => {
  setCurrentLanguage("en");
  assert.equal(
    targetLabel({ weight: 87.5, reps: 5 }, set()),
    "Target 87.5 kg × 5",
  );
  assert.equal(
    targetLabel(
      { weight: null, reps: 11 },
      set({ load: "bodyweight", weight: null }),
    ),
    "Target BW × 11",
  );
  setCurrentLanguage("sv");
  assert.equal(
    targetLabel({ weight: 87.5, reps: 5 }, set()),
    "Mål 87,5 kg × 5",
  );
  setCurrentLanguage("en");
});

test("workoutTargets gives each working set its target, lighter in a deload week", () => {
  const records = [
    record("2026-11-01", [set({ reps: 5 }), set({ reps: 4 })]),
    record("2026-11-08", [set({ reps: 6 }), set({ reps: 5 })]),
  ];
  const sets = [
    set({ done: false, section: "warmup" }),
    set({ done: false }),
    set({ done: false, drop: true }),
    set({ done: false }),
  ];
  const payload = {
    ...(records[0].payload as Workout),
    date: "2026-11-12",
    status: "draft" as const,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:bench-press",
        name: "Bench Press",
        sets,
      },
    ],
  };
  const current = { id: crypto.randomUUID(), payload };
  const targets = workoutTargets(records, current, "kg");
  // The warm-up and the drop have none.
  assert.deepEqual([...targets.keys()], [sets[1].id, sets[3].id]);
  assert.deepEqual(targets.get(sets[1].id)!.target, { weight: 82.5, reps: 6 });
  assert.equal(targets.get(sets[1].id)!.last.reps, 6);
  const deload = workoutTargets(
    records,
    {
      ...current,
      payload: {
        ...payload,
        plan: { planId: PLAN, week: 4, weeks: 8, deload: true },
      },
    },
    "kg",
  );
  // 10 % lighter than last time's 80 kg, the same reps.
  assert.deepEqual(deload.get(sets[1].id)!.target, { weight: 72.5, reps: 6 });
});
