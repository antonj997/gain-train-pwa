import test from "node:test";
import assert from "node:assert/strict";
import {
  changeDiscardsSets,
  changeExercise,
  loggedSetCount,
} from "../src/lib/workout-editor";
import type { Exercise, WorkoutSet } from "../src/data/model";

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 8,
  weight: 60,
  load: "weight",
  section: "working",
  done: true,
  ...over,
});
const card = (sets: WorkoutSet[]): Exercise => ({
  id: "card-1",
  exerciseId: "builtin:bench-press",
  name: "Bench Press",
  sets,
});
const incline = { id: "builtin:incline-press", name: "Incline Press" };
const treadmill = { id: "builtin:treadmill", name: "Treadmill" };

test("strength to strength keeps every set as it is", () => {
  const sets = [
    set(),
    set({ section: "warmup", done: false }),
    set({ drop: true }),
  ];
  const next = changeExercise(card(sets), incline);
  assert.equal(next.id, "card-1");
  assert.equal(next.exerciseId, incline.id);
  assert.equal(next.name, "Incline Press");
  assert.deepEqual(next.sets, sets);
  assert.equal(changeDiscardsSets(card(sets), incline), false);
});

test("strength to cardio resets the sets, keeping count and the card id", () => {
  const sets = [set(), set(), set({ drop: true })];
  const before = card(sets);
  const next = changeExercise(before, treadmill);
  assert.equal(next.id, "card-1");
  assert.equal(next.exerciseId, treadmill.id);
  assert.equal(next.sets.length, 2);
  for (const s of next.sets) {
    assert.equal(s.measure, "cardio");
    assert.equal(s.done, false);
    assert.equal(s.reps, null);
    assert.equal(s.weight, null);
    assert.ok(!s.drop);
  }
  assert.equal(before.sets.length, 3, "the original is untouched");
  assert.equal(changeDiscardsSets(before, treadmill), true);
});

test("cardio to strength resets the sets; cardio to cardio keeps them", () => {
  const cardio = card([
    set({ measure: "cardio", reps: null, weight: null, durationSec: 600 }),
  ]);
  const back = changeExercise(cardio, incline);
  assert.equal(back.sets.length, 1);
  assert.equal(back.sets[0].measure, undefined);
  assert.equal(back.sets[0].done, false);
  assert.equal(back.sets[0].durationSec, undefined);
  const same = changeExercise(cardio, {
    id: "builtin:rowing-machine",
    name: "Rower",
    category: "Cardio",
  });
  assert.deepEqual(same.sets, cardio.sets);
});

test("an empty card gets one fresh set of the new kind; logged sets are counted", () => {
  assert.equal(changeExercise(card([]), treadmill).sets.length, 1);
  const blank = set({ reps: null, weight: null, done: false });
  assert.equal(loggedSetCount(card([blank, set(), set({ done: false })])), 2);
});
