import test from "node:test";
import assert from "node:assert/strict";
import {
  exerciseFocuses,
  matchesSearch,
  routineFocuses,
} from "../src/lib/discover";

const of = (...categories: string[]) =>
  categories.map((category) => ({ category, equipment: "barbell" }));

test("a routine's focus comes from its exercises' main categories", () => {
  assert.deepEqual(
    [...routineFocuses(of("Chest", "Chest", "Shoulders", "Arms"))],
    ["push"],
  );
  assert.deepEqual([...routineFocuses(of("Back", "Back", "Arms"))], ["pull"]);
  assert.deepEqual(
    [...routineFocuses(of("Legs", "Legs", "Glutes", "Core"))],
    ["legs"],
  );
  assert.deepEqual(
    [...routineFocuses(of("Legs", "Chest", "Back", "Shoulders"))],
    ["full"],
  );
  assert.deepEqual(
    [...routineFocuses(of("Full body", "Full body", "Core"))],
    ["full"],
  );
  // Push with a back exercise is not Push; cardio and Other decide nothing.
  assert.deepEqual([...routineFocuses(of("Chest", "Chest", "Back"))], []);
  assert.deepEqual([...routineFocuses(of("Cardio", "Other"))], []);
  assert.deepEqual([...routineFocuses([])], []);
});

test("Hemma needs nothing but bodyweight, bands, dumbbells or kettlebells", () => {
  const home = [
    { category: "Chest", equipment: "bodyweight" },
    { category: "Shoulders", equipment: "dumbbell" },
    { category: "Arms", load: "bodyweight" },
  ];
  assert.deepEqual([...routineFocuses(home)].sort(), ["home", "push"]);
  assert.equal(
    routineFocuses([...home, { category: "Chest", equipment: "machine" }]).has(
      "home",
    ),
    false,
  );
  assert.equal(
    routineFocuses([{ category: "Back", load: "weight" }]).has("home"),
    false,
  );
});

test("a shared exercise's focus is its own category and equipment", () => {
  assert.deepEqual(
    [...exerciseFocuses({ category: "Glutes", equipment: "band" })].sort(),
    ["home", "legs"],
  );
  assert.deepEqual(
    [...exerciseFocuses({ category: "Back", equipment: "cable" })],
    ["pull"],
  );
  assert.deepEqual(
    [...exerciseFocuses({ category: "Full body", equipment: "barbell" })],
    ["full"],
  );
  assert.deepEqual(
    [...exerciseFocuses({ category: "Arms", equipment: "machine" })],
    [],
  );
});

test("search matches any of the texts, without case", () => {
  assert.equal(matchesSearch("bench", "Push", "Bench Press"), true);
  assert.equal(matchesSearch("  ", "Push"), true);
  assert.equal(matchesSearch("ben", "Push", null), false);
  assert.equal(matchesSearch("ERIK", "Push day", "av Erik"), true);
});
