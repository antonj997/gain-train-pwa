import test from "node:test";
import assert from "node:assert/strict";
import type { Exercise, RecordDoc, WorkoutSet } from "../src/data/model";
import {
  hasTarget,
  plannedPlaceholders,
  plannedSetChange,
  shownPlannedSet,
  startValues,
} from "../src/lib/routine-targets";
import { suggestedExercises } from "../src/data/start";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  load: "weight",
  section: "working",
  done: false,
  ...overrides,
});

test("the routine editor shows a target's values and leaves older values out", () => {
  const older = set({ weight: 80, reps: 5 });
  assert.deepEqual(
    [shownPlannedSet(older).weight, shownPlannedSet(older).reps],
    [null, null],
  );
  const target = set({ weight: 85, reps: 5, target: true });
  assert.equal(shownPlannedSet(target), target);
  const cardio = set({ measure: "cardio", durationSec: 600 });
  assert.equal(shownPlannedSet(cardio), cardio);
  assert.equal(hasTarget(target), true);
  assert.equal(hasTarget(older), false);
  assert.equal(hasTarget(set({ target: true })), false);
});

test("typing a number makes the set a target and drops the other older value", () => {
  const stored = set({ weight: 80, reps: 5 });
  const shown = shownPlannedSet(stored);
  const typed = plannedSetChange(stored, shown, { ...shown, reps: 8 });
  assert.deepEqual([typed.weight, typed.reps, typed.target], [null, 8, true]);
  // A change that is not a number keeps the stored values hidden as they were.
  const hold = plannedSetChange(stored, shown, { ...shown, holdSec: 2 });
  assert.deepEqual([hold.weight, hold.reps, hold.target], [80, 5, undefined]);
  assert.equal(hold.holdSec, 2);
  // A target edited stays one; cleared, it is no target.
  const target = set({ weight: 85, reps: 5, target: true });
  const more = plannedSetChange(target, target, { ...target, weight: 87.5 });
  assert.deepEqual([more.weight, more.reps, more.target], [87.5, 5, true]);
  const cleared = plannedSetChange(target, target, {
    ...target,
    weight: null,
    reps: null,
  });
  assert.equal(cleared.target, undefined);
  // Text still being typed counts as a value.
  const typing = plannedSetChange(stored, shown, {
    ...shown,
    inputText: { weight: "8." },
  } as WorkoutSet);
  assert.deepEqual(
    [typing.weight, typing.reps, typing.target],
    [null, null, true],
  );
});

test("placeholders are last time's result, else the routine's older values", () => {
  const previous = set({ weight: 80, reps: 8, done: true });
  assert.deepEqual(plannedPlaceholders(set(), previous, "kg"), {
    weight: "80",
    reps: "8",
  });
  assert.deepEqual(plannedPlaceholders(set(), previous, "lb"), {
    weight: "176.4",
    reps: "8",
  });
  assert.deepEqual(
    plannedPlaceholders(set({ weight: 60, reps: 5 }), undefined, "kg"),
    {
      weight: "60",
      reps: "5",
    },
  );
  // Another kind of load gives no weight to show.
  assert.deepEqual(
    plannedPlaceholders(set({ load: "assisted" }), previous, "kg"),
    {},
  );
  // A target shows its own values instead.
  assert.deepEqual(
    plannedPlaceholders(
      set({ weight: 85, reps: 5, target: true }),
      previous,
      "kg",
    ),
    {},
  );
  assert.deepEqual(plannedPlaceholders(set(), undefined, "kg"), {});
});

test("a start fills a target first, then last time's result, then older values", () => {
  const previous = { weight: 80, reps: 8 };
  assert.deepEqual(startValues(set(), previous), previous);
  assert.deepEqual(
    startValues(set({ weight: 60, reps: 5 }), previous),
    previous,
  );
  assert.deepEqual(startValues(set({ weight: 60, reps: 5 }), undefined), {
    weight: 60,
    reps: 5,
  });
  assert.deepEqual(
    startValues(set({ weight: 85, reps: 5, target: true }), previous),
    { weight: 85, reps: 5 },
  );
  // A target of reps alone keeps last time's weight.
  assert.deepEqual(startValues(set({ reps: 12, target: true }), previous), {
    weight: 80,
    reps: 12,
  });
});

test("starting a routine fills targets, and the workout's sets carry no target flag", () => {
  const exerciseId = "builtin:bench-press";
  const done = {
    id: crypto.randomUUID(),
    kind: "workout",
    deleted: false,
    payload: {
      name: "Push",
      date: "2026-11-10",
      duration: 40,
      startedAt: null,
      status: "completed",
      exercises: [
        {
          id: crypto.randomUUID(),
          exerciseId,
          name: "Bench Press",
          sets: [
            set({ weight: 80, reps: 8, done: true }),
            set({ weight: 80, reps: 7, done: true }),
          ],
        },
      ],
    },
  } as unknown as RecordDoc;
  const planned: Exercise = {
    id: crypto.randomUUID(),
    exerciseId,
    name: "Bench Press",
    repRange: { min: 6, max: 8 },
    sets: [
      set({ weight: 85, reps: 6, target: true }),
      set({ weight: 60, reps: 5 }),
    ],
  };
  const [started] = suggestedExercises([planned], [done]);
  assert.deepEqual(
    started.sets.map((s) => [s.weight, s.reps, s.target]),
    [
      [85, 6, undefined],
      [80, 7, undefined],
    ],
  );
  assert.deepEqual(started.repRange, { min: 6, max: 8 });
});
