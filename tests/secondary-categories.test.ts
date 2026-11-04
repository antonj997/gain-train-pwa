import test from "node:test";
import assert from "node:assert/strict";
import {
  categoriesOf,
  inCategory,
  matchRank,
  matchesFacets,
  searchExercises,
} from "../src/lib/exercise-search";
import { alsoTrains, catalogue, categories } from "../src/data/catalogue";
import { exerciseSub, filterExercises } from "../src/lib/library";
import { categoryText } from "../src/lib/catalogue-labels";
import { customSchema } from "../src/data/model";
import { toSharedInsert } from "../src/lib/shared-exercises";

const byName = (name: string) => catalogue.find((e) => e.name === name)!;

test("compound lifts list the other categories they train; the main one stays", () => {
  const deadlift = byName("Deadlift");
  assert.equal(deadlift.category, "Back");
  assert.equal(deadlift.id, "builtin:deadlift");
  assert.deepEqual(categoriesOf(deadlift), ["Back", "Legs", "Glutes"]);
  assert.deepEqual(categoriesOf(byName("Squat")), ["Legs", "Glutes"]);
  assert.deepEqual(categoriesOf(byName("Bench Press")), [
    "Chest",
    "Arms",
    "Shoulders",
  ]);
  assert.ok(inCategory(byName("Hip Thrust"), "Legs"));
  assert.ok(inCategory(byName("Pull Up"), "Arms"));
  assert.ok(!inCategory(byName("Lateral Raise"), "Arms"));
  // Every name is a catalogue exercise and every extra a known, different category.
  for (const [name, extra] of Object.entries(alsoTrains)) {
    const e = byName(name);
    assert.ok(e, name);
    for (const c of extra) {
      assert.ok(categories.includes(c), `${name}: ${c}`);
      assert.notEqual(c, e.category, name);
    }
  }
});

test("category filters match the main category or another one", () => {
  const deadlift = byName("Deadlift");
  for (const category of ["Back", "Legs", "Glutes"])
    assert.ok(matchesFacets(deadlift, { category }), category);
  assert.ok(!matchesFacets(deadlift, { category: "Chest" }));
  const back = catalogue.filter((e) => matchesFacets(e, { category: "Back" }));
  assert.ok(back.some((e) => e.name === "Stiff Leg Deadlift"));
  assert.ok(back.some((e) => e.name === "Shrugs"));
  // A custom exercise with an extra category.
  const custom = {
    name: "Sandbag lift",
    category: "Full body",
    categories: ["Back"],
  };
  assert.ok(matchesFacets(custom, { category: "Back" }));
  assert.ok(matchesFacets(custom, { category: "Full body" }));
  assert.ok(!matchesFacets(custom, { category: "Legs" }));
});

test("search matches the other categories too, in English and their labels", () => {
  assert.notEqual(matchRank(byName("Deadlift"), "legs"), null);
  assert.notEqual(matchRank(byName("Deadlift"), "glutes barbell"), null);
  assert.equal(matchRank(byName("Lateral Raise"), "legs"), null);
  const hits = searchExercises(catalogue, "glutes").map((e) => e.name);
  assert.ok(hits.includes("Squat"));
  assert.ok(hits.includes("Hip Thrust"));
});

test("the Library filter and muted line use the other categories", () => {
  const items = [
    { ...byName("Deadlift"), custom: false, favourite: false, note: "" },
    { ...byName("Bench Press"), custom: false, favourite: false, note: "" },
    {
      id: "own",
      name: "Sandbag lift",
      category: "Full body",
      categories: ["Back"],
      custom: true,
      favourite: false,
      note: "",
    },
  ].map((e) => ({ ...e, lastDate: null, best: null }));
  assert.deepEqual(
    filterExercises(items, "", "all", { category: "Back" }).map((e) => e.name),
    ["Deadlift", "Sandbag lift"],
  );
  assert.equal(
    exerciseSub(items[0], "2026-11-04"),
    "Back · Legs, Glutes · never logged",
  );
  assert.equal(categoryText("Legs"), "Legs");
  assert.equal(categoryText("Legs", ["Legs", "Glutes"]), "Legs · Glutes");
});

test("a custom exercise stores its other categories, and sharing sends only the main one", () => {
  const saved = customSchema.parse({
    name: "Sandbag lift",
    category: "Full body",
    categories: ["Back", "Legs"],
    note: "",
    favourite: false,
  });
  assert.deepEqual(saved.categories, ["Back", "Legs"]);
  assert.ok(
    !customSchema.safeParse({ ...saved, categories: [""] }).success,
    "empty names are refused",
  );
  const row = toSharedInsert(saved);
  assert.equal(row.category, "Full body");
  assert.equal("categories" in row, false);
});
