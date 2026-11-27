import test from "node:test";
import assert from "node:assert/strict";
import type { CustomExercise } from "../src/data/model.ts";
import { MUSCLES_BY_NAME, customIconOf } from "../src/data/exercise-muscles.ts";
import { catalogue } from "../src/data/catalogue.ts";
import {
  CUSTOM_EQUIPMENT,
  catalogueTwin,
  derivedCategories,
  equipmentOf,
  withCatalogueMuscles,
  withDerivedCategory,
  withEquipment,
} from "../src/lib/custom-exercise.ts";

const exercise = (change: Partial<CustomExercise> = {}): CustomExercise => ({
  schemaVersion: 2,
  name: "Knästående pallofpress",
  category: "Other",
  note: "",
  favourite: false,
  ...change,
});

test("the category is the group with the most main muscles", () => {
  assert.deepEqual(derivedCategories({ obliques: 1, abs: 0.5 }), {
    category: "Core",
    categories: [],
  });
  // A tie goes to the first group in MUSCLE_GROUPS order.
  assert.deepEqual(derivedCategories({ frontDelts: 1, chest: 1 }), {
    category: "Chest",
    categories: ["Shoulders"],
  });
  // Helping muscles add other groups.
  assert.deepEqual(
    derivedCategories({ lats: 1, upperBack: 1, biceps: 0.5, rearDelts: 0.5 }),
    { category: "Back", categories: ["Shoulders", "Arms"] },
  );
  // No main muscle: the group with the most helping muscles.
  assert.deepEqual(
    derivedCategories({ glutes: 0.5, hamstrings: 0.5, quads: 0.5 }),
    {
      category: "Legs",
      categories: ["Glutes"],
    },
  );
  assert.deepEqual(derivedCategories({}), {
    category: "Other",
    categories: [],
  });
});

test("the draft's category follows its muscles", () => {
  const data = withDerivedCategory(
    exercise({ muscles: { obliques: 1, abs: 0.5, glutes: 0.5 } }),
  );
  assert.equal(data.category, "Core");
  assert.deepEqual(data.categories, ["Glutes"]);
  // No other groups leave `categories` out.
  const single = withDerivedCategory(
    exercise({ categories: ["Arms"], muscles: { chest: 1 } }),
  );
  assert.equal(single.category, "Chest");
  assert.equal("categories" in single, false);
});

test("equipment is a real choice that sets the icon", () => {
  assert.deepEqual(CUSTOM_EQUIPMENT, [
    "dumbbell",
    "barbell",
    "kettlebell",
    "machine",
    "cable",
    "band",
    "bodyweight",
  ]);
  const cable = withEquipment(exercise(), "cable");
  assert.equal(cable.equipment, "cable");
  assert.equal(cable.icon, "cable");
  // None chosen is the dumbbell.
  assert.equal(equipmentOf(exercise()), "dumbbell");
  // An existing exercise with the body icon keeps it until its equipment changes.
  const body = exercise({ icon: "body", equipment: "cable" });
  assert.equal(customIconOf(body), "body");
  assert.equal(equipmentOf(body), "cable");
  assert.equal(customIconOf(withEquipment(body, "band")), "band");
});

test("a typed name that is a catalogue exercise is found, in either language", () => {
  const all = catalogue.map((e) => ({ id: e.id, name: e.name }));
  assert.equal(catalogueTwin("pallof press", all)?.id, "builtin:pallof-press");
  assert.equal(catalogueTwin("Pallofpress", all)?.id, "builtin:pallof-press");
  assert.equal(catalogueTwin("Bänkpress", all)?.id, "builtin:bench-press");
  assert.equal(catalogueTwin("Knästående pallofpress", all), undefined);
  // Your own exercises are not catalogue twins.
  assert.equal(catalogueTwin("Mine", [{ id: "own", name: "Mine" }]), undefined);
});

test("Använd dess muskler copies the catalogue exercise's muscles and equipment", () => {
  const data = withCatalogueMuscles(
    exercise({ name: "pallof press" }),
    "builtin:pallof-press",
  );
  assert.deepEqual(data.muscles, MUSCLES_BY_NAME["Pallof Press"]);
  assert.equal(data.equipment, "cable");
  assert.equal(data.icon, "cable");
  assert.equal(data.category, "Core");
  // The name stays as typed.
  assert.equal(data.name, "pallof press");
});
