import test from "node:test";
import assert from "node:assert/strict";
import type { Exercise, Workout, WorkoutSet } from "../src/data/model";
import type { ExerciseMuscles } from "../src/data/muscles";
import {
  fatigueNote,
  lowerTarget,
  lowerTargets,
  restoreTargets,
} from "../src/data/fatigue";

const MUSCLES: Record<string, ExerciseMuscles> = {
  squat: { quads: 1, glutes: 1, adductors: 0.5 },
  legPress: { quads: 1, glutes: 0.5 },
  split: { quads: 1, glutes: 1 },
  calf: { calves: 1 },
};
const musclesOf = (id: string) => MUSCLES[id] ?? {};

let n = 0;
const set = (extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${++n}`,
  weight: 100,
  reps: 6,
  load: "weight",
  section: "working",
  done: true,
  ...extra,
});
const exercise = (exerciseId: string, sets: WorkoutSet[]): Exercise => ({
  id: `e${++n}`,
  exerciseId,
  name: exerciseId,
  sets,
});
const sets = (count: number, extra: Partial<WorkoutSet> = {}) =>
  Array.from({ length: count }, () => set(extra));
const workout = (exercises: Exercise[]): Workout => ({
  name: "Benpass",
  date: "2026-11-19",
  duration: null,
  startedAt: null,
  status: "draft",
  exercises,
});
const open = (count = 3) => sets(count, { weight: 22, reps: 8, done: false });

/** B13: Leg Press was put in before the split squat today. */
const today = () =>
  workout([
    exercise("squat", sets(3)),
    exercise("legPress", sets(3)),
    exercise("split", open()),
  ]);
const before = workout([
  exercise("squat", sets(3)),
  exercise("split", sets(3, { weight: 20, reps: 10 })),
]);

test("B13: three more hard sets for quads than last time lower 22 × 8 to 20 × 8", () => {
  assert.deepEqual(fatigueNote(today(), 2, before, musclesOf, 2), {
    muscle: "quads",
    today: 6,
    before: 3,
    from: { weight: 22, reps: 8 },
    to: { weight: 20, reps: 8 },
  });
});

test("a difference of two gives no note", () => {
  const w = workout([
    exercise("squat", sets(3)),
    exercise("legPress", sets(2)),
    exercise("split", open()),
  ]);
  assert.equal(fatigueNote(w, 2, before, musclesOf, 2), null);
});

test("no previous session gives no note", () => {
  assert.equal(fatigueNote(today(), 2, null, musclesOf, 2), null);
  // Nor does a previous workout without this exercise.
  assert.equal(
    fatigueNote(
      today(),
      2,
      workout([exercise("squat", sets(3))]),
      musclesOf,
      2,
    ),
    null,
  );
});

test("a checked working set in the exercise gives no note", () => {
  const w = today();
  w.exercises[2].sets[0] = { ...w.exercises[2].sets[0], done: true };
  assert.equal(fatigueNote(w, 2, before, musclesOf, 2), null);
});

test("a bodyweight target gives no note, and nothing crashes", () => {
  const w = workout([
    exercise("squat", sets(3)),
    exercise("legPress", sets(3)),
    exercise(
      "split",
      sets(3, { load: "bodyweight", weight: null, reps: 10, done: false }),
    ),
  ]);
  assert.equal(fatigueNote(w, 2, before, musclesOf, 2), null);
  // An empty set, an unknown exercise, an index past the end.
  const blank = workout([
    exercise("squat", sets(6)),
    exercise("split", sets(3, { weight: null, reps: null, done: false })),
  ]);
  assert.equal(fatigueNote(blank, 1, before, musclesOf, 2), null);
  assert.equal(fatigueNote(today(), 9, before, musclesOf, 2), null);
});

test("helping muscles count at 0.5", () => {
  // Leg Press adds 1.5 to glutes today; glutes (a main muscle of the split
  // squat) then has 4.5 against 3: under the 3 it needs. Quads has 6 vs 3.
  const note = fatigueNote(today(), 2, before, musclesOf, 2);
  assert.equal(note?.muscle, "quads");
  // With only a helping muscle more, there is no note.
  const helping = workout([
    exercise("squat", sets(3)),
    exercise("calf", sets(3)),
    exercise("split", open()),
  ]);
  assert.equal(fatigueNote(helping, 2, before, musclesOf, 2), null);
});

test("an explicit target wins over the fields; the lowered weight never goes under 0", () => {
  assert.deepEqual(
    fatigueNote(today(), 2, before, musclesOf, 2, { weight: 24, reps: 8 })?.to,
    { weight: 22, reps: 8 },
  );
  assert.deepEqual(lowerTarget({ weight: 1, reps: 8 }, 2), {
    weight: 0,
    reps: 8,
  });
});

test("lowerTargets marks the exercise and changes only open working sets; restore puts them back", () => {
  const ex = exercise("split", [
    set({ section: "warmup", weight: 10, reps: 10, done: false }),
    set({ weight: 22, reps: 8, done: true }),
    set({ weight: 22, reps: 8, done: false }),
    set({ weight: 18, reps: 8, done: false, drop: true }),
    set({ weight: 22, reps: 8, done: false }),
  ]);
  const lowered = lowerTargets(ex, { weight: 20, reps: 8 });
  assert.equal(lowered.fatigue, "lowered");
  assert.deepEqual(
    lowered.sets.map((s) => s.weight),
    [10, 22, 20, 18, 20],
  );
  const back = restoreTargets(lowered, ex);
  assert.equal("fatigue" in back, false);
  assert.deepEqual(
    back.sets.map((s) => s.weight),
    [10, 22, 22, 18, 22],
  );
});
