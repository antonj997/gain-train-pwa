import test from "node:test";
import assert from "node:assert/strict";
import {
  addDrop,
  changeSection,
  dropGroup,
  isDrop,
  normalizeDrops,
  removeSetOrDrop,
  setBadge,
} from "../src/data/drops";
import {
  repeatExercises,
  validate,
  type Exercise,
  type Workout,
  type WorkoutSet,
} from "../src/data/model";
import { doneSetCount, setCount } from "../src/data/selectors";
import { parseWorkoutDraft } from "../src/lib/drafts";
import {
  appendSet,
  finishWorkout,
  groupComplete,
  toggleGroupCompletion,
} from "../src/lib/workout-editor";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: false,
  ...overrides,
});
const drop = (overrides: Partial<WorkoutSet> = {}) =>
  set({ drop: true, reps: 4, weight: 80, ...overrides });
const exercise = (
  sets: WorkoutSet[],
  exerciseId = "builtin:bench",
): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: "Bench Press",
  sets,
});
const workout = (sets: WorkoutSet[], overrides: Partial<Workout> = {}) => ({
  name: "Push",
  date: "2026-10-08",
  duration: null,
  startedAt: null,
  status: "draft" as const,
  exercises: [exercise(sets)],
  ...overrides,
});

test("addDrop prefills 80% rounded to 2.5 kg and keeps the load", () => {
  const weight = set({ weight: 100 });
  const [, added] = addDrop([weight], weight.id);
  assert.equal(added.weight, 80);
  assert.equal(added.drop, true);
  assert.equal(added.done, false);
  assert.equal(added.reps, null);
  assert.equal(added.section, "working");
  assert.equal(added.load, "weight");
  assert.notEqual(added.id, weight.id);

  // 64 × 0.8 = 51.2, and the nearest 2.5 kg is 50.
  const odd = set({ weight: 64 });
  assert.equal(addDrop([odd], odd.id)[1].weight, 50);

  const extra = set({ load: "bodyweight", extraWeight: true, weight: 20 });
  const extraDrop = addDrop([extra], extra.id)[1];
  assert.equal(extraDrop.load, "bodyweight");
  assert.equal(extraDrop.extraWeight, true);
  assert.equal(extraDrop.weight, 15);

  // 1 kg × 0.8 rounds to 0 kg, which is plain bodyweight; 2.5 kg stays added weight.
  const light = set({ load: "bodyweight", extraWeight: true, weight: 1 });
  const plain = addDrop([light], light.id)[1];
  assert.equal(plain.load, "bodyweight");
  assert.equal(plain.weight, null);
  assert.equal("extraWeight" in plain, false);
  const edge = set({ load: "bodyweight", extraWeight: true, weight: 2.5 });
  assert.equal(addDrop([edge], edge.id)[1].weight, 2.5);

  const assisted = set({ load: "assisted", weight: 25 });
  const assistedDrop = addDrop([assisted], assisted.id)[1];
  assert.equal(assistedDrop.load, "assisted");
  assert.equal(assistedDrop.weight, null);

  const timed = set({ load: "bodyweight", measure: "seconds", weight: null });
  const timedDrop = addDrop([timed], timed.id)[1];
  assert.equal(timedDrop.measure, "seconds");
  assert.equal(timedDrop.weight, null);
});

test("addDrop inserts after existing drops and leaves its input and unfit targets alone", () => {
  const first = set();
  const existing = drop();
  const next = set();
  const sets = [first, existing, next];
  const result = addDrop(sets, first.id);
  assert.deepEqual(
    result.map((s) => s.id).filter((id) => id !== result[2].id),
    sets.map((s) => s.id),
  );
  assert.equal(result.length, 4);
  assert.equal(result[2].drop, true);
  // The new drop follows the 80 kg drop: 80 × 0.8 = 64, and the nearest 2.5 kg is 65.
  assert.equal(result[2].weight, 65);
  assert.equal(result[3], next);
  assert.equal(sets.length, 3);

  const fromDrop = addDrop(sets, existing.id);
  assert.equal(fromDrop[2].drop, true);
  // 80 × 0.8 = 64, and the nearest 2.5 kg is 65.
  assert.equal(fromDrop[2].weight, 65);

  const done = set({ done: true });
  const doneSets = [done];
  assert.equal(addDrop(doneSets, done.id), doneSets);
  const warmup = set({ section: "warmup" });
  const warmupSets = [warmup];
  assert.equal(addDrop(warmupSets, warmup.id), warmupSets);
  const winddown = set({ section: "winddown" });
  const winddownSets = [winddown];
  assert.equal(addDrop(winddownSets, winddown.id), winddownSets);
  assert.equal(addDrop(sets, "missing"), sets);
});

test("addDrop copies load and weight from the row it follows", () => {
  const parent = set({ weight: 100 });

  const assisted = drop({ load: "assisted", weight: 20, measure: "reps" });
  const afterAssisted = addDrop([parent, assisted], parent.id)[2];
  assert.equal(afterAssisted.load, "assisted");
  assert.equal(afterAssisted.measure, "reps");
  assert.equal(afterAssisted.weight, null);

  const plainBodyweight = drop({ load: "bodyweight", weight: null });
  const afterBodyweight = addDrop([parent, plainBodyweight], parent.id)[2];
  assert.equal(afterBodyweight.load, "bodyweight");
  assert.equal(afterBodyweight.weight, null);
  assert.equal("extraWeight" in afterBodyweight, false);

  const added = drop({ load: "bodyweight", extraWeight: true, weight: 20 });
  const afterAdded = addDrop([parent, added], parent.id)[2];
  assert.equal(afterAdded.extraWeight, true);
  assert.equal(afterAdded.weight, 15);

  const blank = drop({ weight: null });
  assert.equal(addDrop([parent, blank], parent.id)[2].weight, null);
});

test("dropGroup spans a set and its drops from any member", () => {
  const sets = [set(), set(), drop(), drop(), set()];
  assert.deepEqual(dropGroup(sets, 0), { start: 0, end: 1 });
  assert.deepEqual(dropGroup(sets, 1), { start: 1, end: 4 });
  assert.deepEqual(dropGroup(sets, 3), { start: 1, end: 4 });
  assert.deepEqual(dropGroup(sets, 4), { start: 4, end: 5 });
  assert.equal(isDrop(sets[2]), true);
  assert.equal(isDrop(sets[1]), false);
});

test("removeSetOrDrop removes a set with its drops, or one drop", () => {
  const a = set();
  const a1 = drop();
  const a2 = drop();
  const b = set();
  const sets = [a, a1, a2, b];
  assert.deepEqual(removeSetOrDrop(sets, a.id), [b]);
  assert.deepEqual(removeSetOrDrop(sets, a1.id), [a, a2, b]);
  assert.deepEqual(removeSetOrDrop(sets, b.id), [a, a1, a2]);
  assert.equal(sets.length, 4);
  assert.equal(removeSetOrDrop(sets, "missing"), sets);
});

test("changeSection turns drops into ordinary sets of the new section", () => {
  const a = set();
  const a1 = drop();
  const a2 = drop();
  const b = set();
  const result = changeSection([a, a1, a2, b], a.id, "warmup");
  assert.deepEqual(
    result.map((s) => s.section),
    ["warmup", "warmup", "warmup", "working"],
  );
  assert.deepEqual(result.map(isDrop), [false, false, false, false]);
  assert.equal("drop" in result[1], false);
  assert.equal(result[3], b);

  // A group's own section can still change without drops.
  const plain = set();
  assert.equal(
    changeSection([plain], plain.id, "winddown")[0].section,
    "winddown",
  );

  const done = set({ done: true });
  const doneSets = [done, drop({ done: true })];
  assert.equal(changeSection(doneSets, done.id, "warmup"), doneSets);
  assert.equal(changeSection([a], a.id, "working")[0], a);
});

test("changeSection on a drop leaves earlier drops and ordinary sets alone", () => {
  const a = set();
  const a1 = drop();
  const a2 = drop();
  const result = changeSection([a, a1, a2], a1.id, "winddown");
  assert.deepEqual(
    result.map((s) => [s.section, isDrop(s)]),
    [
      ["working", false],
      ["winddown", false],
      ["winddown", false],
    ],
  );
});

test("setBadge numbers working sets only", () => {
  const sets = [
    set({ section: "warmup" }),
    set(),
    drop(),
    set(),
    set({ section: "winddown" }),
  ];
  const badges = sets.map((_, i) => setBadge(sets, i));
  assert.deepEqual(
    badges.map((b) => b.text),
    ["W", "1", "↓", "2", "C"],
  );
  assert.deepEqual(
    badges.map((b) => b.tone),
    ["warmup", "working", "drop", "working", "winddown"],
  );
  assert.deepEqual(badges[0], {
    text: "W",
    tone: "warmup",
    label: "Warm-up set. Change type, load or delete",
    title: "Warm-up set",
  });
  assert.deepEqual(badges[1], {
    text: "1",
    tone: "working",
    label: "Set 1, working set. Change type, load or delete",
    title: "Set 1",
  });
  assert.equal(badges[2].label, "Drop after set 1. Change load or delete");
  assert.equal(badges[2].title, "Drop");
  assert.equal(
    badges[3].label,
    "Set 2, working set. Change type, load or delete",
  );
  assert.deepEqual(badges[4], {
    text: "C",
    tone: "winddown",
    label: "Cool-down set. Change type, load or delete",
    title: "Cool-down set",
  });
});

test("a set with an empty drop cannot be checked", () => {
  const parent = set();
  const empty = drop({ reps: null });
  const sets = [parent, empty];
  assert.equal(groupComplete(sets, 0), false);
  assert.equal(groupComplete(sets, 1), false);
  assert.equal(toggleGroupCompletion(sets, parent.id, null), sets);

  const filled = [parent, { ...empty, reps: 3 }];
  assert.equal(groupComplete(filled, 0), true);
  const checked = toggleGroupCompletion(filled, parent.id, null);
  assert.deepEqual(
    checked.map((s) => s.done),
    [true, true],
  );
  assert.deepEqual(
    filled.map((s) => s.done),
    [false, false],
  );
  const unchecked = toggleGroupCompletion(checked, parent.id, null);
  assert.deepEqual(
    unchecked.map((s) => s.done),
    [false, false],
  );
});

test("unchecking a group works even if a drop is incomplete", () => {
  const parent = set({ done: true });
  const sets = [parent, drop({ done: true, reps: null })];
  assert.deepEqual(
    toggleGroupCompletion(sets, parent.id, null).map((s) => s.done),
    [false, false],
  );
});

test("checking a group records bodyweight for each bodyweight set in it", () => {
  const parent = set({ load: "bodyweight", weight: null });
  const sets = [parent, drop({ load: "bodyweight", weight: null }), set()];
  const checked = toggleGroupCompletion(sets, parent.id, 82);
  assert.deepEqual(
    checked.map((s) => s.bodyWeightKg),
    [82, 82, undefined],
  );
  assert.equal(checked[2], sets[2]);
});

test("normalizeDrops repairs records from older app versions", () => {
  const first = drop();
  const afterCooldown = [set({ section: "winddown" }), drop()];
  const afterWarmup = [set({ section: "warmup" }), drop()];
  const mismatch = [set({ done: false }), drop({ done: true })];
  const sections = [set(), drop({ section: "warmup" })];

  const orphan = normalizeDrops([first, set()]);
  assert.equal(orphan[0].drop, undefined);
  assert.equal("drop" in orphan[0], false);
  assert.equal(orphan[0].weight, 80);
  assert.equal(first.drop, true);

  for (const sets of [afterCooldown, afterWarmup, mismatch, sections]) {
    const result = normalizeDrops(sets);
    assert.notEqual(result, sets);
    assert.equal(isDrop(result[1]), false, "drop is removed");
    assert.equal(result[1].id, sets[1].id);
    assert.equal(sets[1].drop, true, "input is not mutated");
  }
  assert.equal(normalizeDrops(afterCooldown)[1].section, "working");

  // Later drops attach to the repaired set, so each group stays valid.
  const chain = normalizeDrops([drop(), drop()]);
  assert.deepEqual(chain.map(isDrop), [false, true]);

  const valid = [set(), drop(), drop(), set({ section: "warmup" })];
  assert.equal(normalizeDrops(valid), valid);
  const done = [set({ done: true }), drop({ done: true })];
  assert.equal(normalizeDrops(done), done);
  const result = normalizeDrops(mismatch);
  assert.equal(normalizeDrops(result), result);
});

test("validate keeps drops and repairs misplaced ones instead of rejecting", () => {
  const parent = set();
  const kept = validate("workout", workout([parent, drop()]));
  assert.equal(kept.exercises[0].sets[1].drop, true);

  const orphan = validate("workout", workout([drop(), set()]));
  assert.equal(orphan.exercises[0].sets.length, 2);
  assert.equal("drop" in orphan.exercises[0].sets[0], false);

  const mismatch = validate(
    "workout",
    workout([set({ done: false }), drop({ done: true })]),
  );
  assert.equal(isDrop(mismatch.exercises[0].sets[1]), false);

  const plan = validate("routine", {
    name: "Push",
    exercises: [exercise([set({ section: "warmup" }), drop(), set(), drop()])],
  });
  assert.deepEqual(plan.exercises[0].sets.map(isDrop), [
    false,
    false,
    false,
    true,
  ]);
});

test("drops survive a backup round-trip", () => {
  const parent = set({ done: true });
  const validated = validate(
    "workout",
    workout([parent, drop({ done: true }), drop({ done: true })], {
      status: "completed",
    }),
  );
  assert.equal(validated.exercises[0].sets[2].drop, true);
  assert.deepEqual(
    validate("workout", JSON.parse(JSON.stringify(validated))),
    validated,
  );
});

test("recovered drafts keep drop and unfinished text", () => {
  const unfinished = drop({ reps: null });
  Object.assign(unfinished, { inputText: { reps: "1e" } });
  const draft = parseWorkoutDraft(workout([set(), unfinished]));
  const recovered = draft?.exercises[0].sets[1] as WorkoutSet & {
    inputText?: unknown;
  };
  assert.equal(recovered.drop, true);
  assert.deepEqual(recovered.inputText, { reps: "1e" });
});

test("finishing leaves out an unchecked set with its drops", () => {
  const unchecked = set();
  const checked = set({ done: true });
  const finished = finishWorkout(workout([unchecked, drop(), checked]), 1000);
  assert.deepEqual(
    finished.exercises[0].sets.map((s) => s.id),
    [checked.id],
  );

  const group = set({ done: true });
  const groupDrop = drop({ done: true });
  const kept = finishWorkout(
    workout([unchecked, drop(), group, groupDrop]),
    1000,
  );
  assert.deepEqual(
    kept.exercises[0].sets.map((s) => s.id),
    [group.id, groupDrop.id],
  );
  assert.equal(kept.exercises[0].sets[1].drop, true);
});

test("appendSet copies the last non-drop set and uses initialSet when empty", () => {
  const last = set({ reps: 6, weight: 90, done: true });
  const lastDrop = drop({ done: true });
  const added = appendSet(exercise([set(), last, lastDrop])).sets;
  assert.equal(added.length, 4);
  assert.equal(added[3].reps, 6);
  assert.equal(added[3].weight, 90);
  assert.equal(added[3].done, false);
  assert.equal(isDrop(added[3]), false);
  assert.notEqual(added[3].id, last.id);

  const empty = appendSet(exercise([], "builtin:plank")).sets;
  assert.equal(empty.length, 1);
  assert.equal(empty[0].load, "bodyweight");
  assert.equal(empty[0].measure, "seconds");
  assert.equal(empty[0].reps, null);
  assert.equal(empty[0].done, false);
});

test("repeatExercises keeps planned drops", () => {
  const planned = exercise([set(), drop()]);
  const [repeated] = repeatExercises([planned]);
  assert.deepEqual(repeated.sets.map(isDrop), [false, true]);
  assert.notEqual(repeated.sets[1].id, planned.sets[1].id);
  assert.equal(repeated.sets[1].weight, 80);
});

test("set counts treat a set and its drops as one", () => {
  const checked = workout([set({ done: true }), drop({ done: true })]);
  assert.equal(setCount(checked), 1);
  assert.equal(doneSetCount(checked), 1);
  const open = workout([set(), drop(), set({ done: true })]);
  assert.equal(setCount(open), 2);
  assert.equal(doneSetCount(open), 1);
});
