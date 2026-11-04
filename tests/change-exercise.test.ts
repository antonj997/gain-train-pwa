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

test("swapping adapts unchecked sets to the new load and count and keeps checked ones", () => {
  const sets = [
    set(),
    set({ done: false, reps: 10, weight: 70 }),
    set({ done: false, reps: 6, weight: 80, section: "warmup" }),
  ];
  const next = changeExercise(card(sets), {
    id: "builtin:pull-up",
    name: "Pull Up",
  });
  assert.equal(next.sets.length, 3);
  assert.deepEqual(next.sets[0], sets[0], "the checked set is as logged");
  for (const s of next.sets.slice(1)) {
    assert.equal(s.load, "bodyweight");
    assert.equal(s.weight, null);
  }
  assert.equal(next.sets[1].reps, 10, "reps still mean reps");
  assert.equal(next.sets[2].section, "warmup");
  assert.equal(next.sets[1].id, sets[1].id);
});

test("swapping to a timed exercise makes the count seconds; a hand-set load stays", () => {
  const plank = changeExercise(card([set({ done: false })]), {
    id: "builtin:plank",
    name: "Plank",
  });
  assert.equal(plank.sets[0].measure, "seconds");
  assert.equal(plank.sets[0].load, "bodyweight");
  assert.equal(plank.sets[0].reps, null, "reps are not seconds");
  // A weighted pull-up (bodyweight plus kg) is the user's choice, not Pull Up's default.
  const weighted = {
    id: "card-2",
    exerciseId: "builtin:pull-up",
    name: "Pull Up",
    sets: [
      set({ done: false, load: "bodyweight", extraWeight: true, weight: 10 }),
    ],
  };
  const chin = changeExercise(weighted, {
    id: "builtin:chin-up",
    name: "Chin Up",
  });
  assert.deepEqual(chin.sets, weighted.sets);
  // A custom exercise's own defaults say what it started with.
  const custom = {
    ...weighted,
    exerciseId: "custom-1",
    sets: [set({ done: false, load: "bodyweight", weight: null })],
  };
  const swapped = changeExercise(custom, incline, { load: "bodyweight" });
  assert.equal(swapped.sets[0].load, "weight");
  assert.equal(swapped.sets[0].reps, 8);
});
