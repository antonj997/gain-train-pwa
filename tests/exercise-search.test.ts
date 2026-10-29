import test from "node:test";
import assert from "node:assert/strict";
import {
  matchRank,
  matchesFacets,
  normalize,
  sameNamedExercise,
  searchExercises,
} from "../src/lib/exercise-search";
import { catalogue, categories, equipmentTypes } from "../src/data/catalogue";
import { initialSet } from "../src/data/workouts";

const names = (query: string) =>
  searchExercises(catalogue, query).map((e) => e.name);

test("normalize ignores case, accents and punctuation", () => {
  assert.equal(normalize("  Bänk-Press!! "), "bank press");
  assert.equal(normalize("Knäböj"), "knaboj");
  assert.equal(normalize("T-Bar   Row"), "t bar row");
});

test("matches Swedish names, short names and the typed words in any order", () => {
  assert.ok(names("bänk").includes("Bench Press"));
  assert.ok(names("BANK").includes("Bench Press"));
  assert.equal(names("rdl")[0], "Romanian Deadlift");
  assert.equal(names("ohp")[0], "Overhead Press");
  assert.ok(names("knäböj").includes("Squat"));
  assert.ok(names("marklyft").includes("Deadlift"));
  assert.deepEqual(names("press bench").slice(0, 1), ["Bench Press"]);
  assert.equal(names("t-bar")[0], "T-Bar Row");
  assert.deepEqual(names("zzzz"), []);
});

test("every typed word must match name, alias, category or equipment", () => {
  const hits = searchExercises(catalogue, "cable chest");
  assert.ok(hits.length >= 2);
  for (const e of hits) {
    assert.equal(e.equipment, "cable");
    assert.ok(
      e.category === "Chest" ||
        e.name.toLowerCase().includes("chest") ||
        e.aliases.some((a) => a.includes("chest")),
    );
  }
  assert.ok(hits.some((e) => e.name === "Cable Fly"));
  assert.ok(!hits.some((e) => e.name === "Lat Pulldown"));
});

test("ranks exact and prefix names, then aliases, then category or equipment", () => {
  const items = [
    { name: "Wide Squat", category: "Legs", aliases: [] },
    {
      name: "Leg Press",
      category: "Legs",
      equipment: "machine",
      aliases: ["squat machine"],
    },
    { name: "Squat Jump", category: "Legs", aliases: [] },
    { name: "Squat", category: "Legs", aliases: [] },
    { name: "Hack", category: "Squat rack", aliases: [] },
    { name: "Pistol", category: "Legs", aliases: ["squat"] },
  ];
  assert.deepEqual(
    searchExercises(items, "squat").map((e) => e.name),
    ["Squat", "Squat Jump", "Leg Press", "Pistol", "Wide Squat", "Hack"],
  );
  assert.equal(matchRank(items[3], "SQUAT"), 0);
  assert.equal(matchRank(items[2], "squ"), 1);
  assert.equal(matchRank(items[0], "nothing"), null);
  // An empty query keeps the order it was given.
  assert.deepEqual(searchExercises(items, " "), items);
});

test("facets narrow by category and equipment", () => {
  const bench = catalogue.find((e) => e.name === "Bench Press")!;
  assert.ok(matchesFacets(bench, {}));
  assert.ok(matchesFacets(bench, { category: "Chest", equipment: "barbell" }));
  assert.ok(!matchesFacets(bench, { equipment: "cable" }));
  // Custom exercises have no equipment.
  assert.ok(
    !matchesFacets({ name: "x", category: "Chest" }, { equipment: "cable" }),
  );
});

test("the catalogue is big, unique and keeps the ids records already use", () => {
  assert.ok(catalogue.length >= 150);
  assert.equal(new Set(catalogue.map((e) => e.id)).size, catalogue.length);
  assert.equal(
    new Set(catalogue.map((e) => e.name.toLowerCase())).size,
    catalogue.length,
  );
  for (const e of catalogue) {
    assert.equal(e.id, "builtin:" + e.name.toLowerCase().replaceAll(" ", "-"));
    assert.ok(categories.includes(e.category), e.name);
    assert.ok(equipmentTypes.includes(e.equipment), e.name);
    assert.ok(e.aliases.length > 0 && e.aliases.every(Boolean), e.name);
  }
  for (const id of [
    "builtin:bench-press",
    "builtin:squat",
    "builtin:deadlift",
    "builtin:overhead-press",
    "builtin:pull-up",
    "builtin:hip-thrust",
    "builtin:t-bar-row",
    "builtin:cable-woodchop",
  ])
    assert.ok(
      catalogue.some((e) => e.id === id),
      id,
    );
  const cardio = catalogue.filter((e) => e.category === "Cardio");
  assert.equal(cardio.length, 7);
  assert.ok(cardio.every((e) => e.equipment === "cardio machine"));
});

test("new sets start from the catalogue defaults", () => {
  assert.equal(initialSet("builtin:bench-press").load, "weight");
  assert.equal(initialSet("builtin:pull-up").load, "bodyweight");
  assert.equal(initialSet("builtin:plank").measure, "seconds");
  assert.equal(initialSet("builtin:russian-twist").load, "weight");
  assert.equal(initialSet("custom-id").load, "weight");
});

test("sameNamedExercise matches names ignoring case, accents and punctuation", () => {
  const list = [
    { id: "builtin:bench", name: "Bench Press" },
    { id: "mine", name: "Bänch-press" },
  ];
  assert.equal(sameNamedExercise("bench press", list)?.id, "builtin:bench");
  assert.equal(sameNamedExercise("Banch Press", list, "x")?.id, "mine");
  assert.equal(sameNamedExercise("Banch Press", list, "mine"), undefined);
  assert.equal(sameNamedExercise("  ", list), undefined);
  assert.equal(sameNamedExercise("Bench", list), undefined);
});
