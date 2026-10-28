import test from "node:test";
import assert from "node:assert/strict";
import type {
  Exercise,
  RecordDoc,
  Workout,
  WorkoutSet,
} from "../src/data/model";
import { progressFor } from "../src/data/analytics";
import { suggestedExercises } from "../src/data/start";
import { previousResult, setProfileOrdinal } from "../src/data/workouts";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
const drop = (overrides: Partial<WorkoutSet> = {}) =>
  set({ drop: true, reps: 6, weight: 80, ...overrides });
const exercise = (sets: WorkoutSet[]): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId: "builtin:bench-press",
  name: "Bench Press",
  sets,
});
const record = (sets: WorkoutSet[], date = "2026-10-08"): RecordDoc => ({
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
    exercises: [exercise(sets)],
  } satisfies Workout,
});

test("drops never shift working-set ordinals", () => {
  const sets = [set(), drop(), set()];
  assert.equal(setProfileOrdinal(sets, 2), 1);
  assert.equal(setProfileOrdinal(sets, 0), 0);
  assert.equal(setProfileOrdinal([set(), drop(), drop(), set()], 3), 1);
});

test("a drop's previous result is the matching drop from last time", () => {
  const first = set();
  const lastDrop = drop({ reps: 6 });
  const second = set();
  const prior = [first, lastDrop, second];
  const current = [
    set({ done: false }),
    drop({ done: false }),
    set({ done: false }),
  ];
  assert.equal(previousResult(prior, current, 0), first);
  assert.equal(previousResult(prior, current, 1), lastDrop);
  assert.equal(previousResult(prior, current, 2), second);
});

test("a drop falls back to the last drop of the previous group, or nothing", () => {
  const parent = set();
  const firstDrop = drop({ weight: 80, reps: 6 });
  const secondDrop = drop({ weight: 60, reps: 8 });
  const current = [
    set({ done: false }),
    drop({ done: false }),
    drop({ done: false }),
    drop({ done: false }),
  ];
  const prior = [parent, firstDrop, secondDrop];
  assert.equal(previousResult(prior, current, 1), firstDrop);
  assert.equal(previousResult(prior, current, 2), secondDrop);
  assert.equal(previousResult(prior, current, 3), secondDrop);
  // Last time's set had no drops, so there is nothing to compare a drop to.
  assert.equal(previousResult([parent], current, 1), undefined);
  assert.equal(previousResult([], current, 1), undefined);
});

test("a drop is matched through its own set, not the next set's drops", () => {
  const prior = [
    set({ weight: 100 }),
    drop({ weight: 80 }),
    set({ weight: 110 }),
    drop({ weight: 90 }),
    drop({ weight: 70 }),
  ];
  const current = [
    set({ done: false }),
    set({ done: false }),
    drop({ done: false }),
  ];
  // The second set matches the 110 kg set, so its drop matches that set's
  // first drop (90 kg), not the 100 kg set's drop.
  assert.equal(previousResult(prior, current, 2), prior[3]);
});

test("a non-drop's previous result ignores last time's drops", () => {
  const prior = [
    set({ weight: 100 }),
    drop({ weight: 80 }),
    set({ weight: 90 }),
  ];
  const current = [set({ done: false }), set({ done: false })];
  assert.equal(previousResult(prior, current, 1), prior[2]);
});

test("a drop does not borrow from an unfinished or invalid previous drop", () => {
  const parent = set();
  const unchecked = drop({ done: false });
  const current = [set({ done: false }), drop({ done: false })];
  assert.equal(previousResult([parent, unchecked], current, 1), undefined);
  assert.equal(
    previousResult([parent, drop({ reps: null })], current, 1),
    undefined,
  );
});

test("a stray first drop has no previous result instead of looping", () => {
  const current = [drop({ done: false }), set({ done: false })];
  assert.equal(previousResult([set(), drop()], current, 0), undefined);
});

test("progress ignores drops for the best set", () => {
  // The drop's estimate (120) is higher than its parent's (110).
  const parent = set({ weight: 100, reps: 3 });
  const lighter = drop({ weight: 90, reps: 10 });
  const [exerciseProgress] = progressFor([record([parent, lighter])]);
  assert.equal(exerciseProgress.points.length, 1);
  assert.equal(exerciseProgress.points[0].set, parent);
});

test("progress has no point for a session of only drops", () => {
  assert.deepEqual(progressFor([record([drop()])]), []);
});

test("suggested routine sets keep drops", () => {
  const planned = exercise([
    set({ weight: null, reps: null, done: false }),
    drop({ weight: 70, reps: null, done: false }),
  ]);
  const [suggested] = suggestedExercises([planned], []);
  assert.deepEqual(
    suggested.sets.map((s) => s.drop === true),
    [false, true],
  );
});

test("suggested routine drops take last time's matching drop", () => {
  const planned = exercise([
    set({ weight: null, reps: null, done: false }),
    drop({ weight: null, reps: null, done: false }),
    set({ weight: null, reps: null, done: false }),
  ]);
  const history = record([
    set({ weight: 100, reps: 5 }),
    drop({ weight: 80, reps: 6 }),
    set({ weight: 105, reps: 4 }),
  ]);
  const [suggested] = suggestedExercises([planned], [history]);
  assert.deepEqual(
    suggested.sets.map((s) => [s.weight, s.reps, s.drop === true]),
    [
      [100, 5, false],
      [80, 6, true],
      [105, 4, false],
    ],
  );
});
