import test from "node:test";
import assert from "node:assert/strict";
import { catalogueById } from "../src/data/catalogue";
import { SV_NAMES } from "../src/data/exercise-names-sv";
import {
  exerciseDisplayName,
  exerciseSubtitle,
} from "../src/lib/exercise-name";
import { setCurrentLanguage } from "../src/i18n";

test("every Swedish name is a catalogue exercise's", () => {
  assert.ok(Object.keys(SV_NAMES).length >= 30);
  for (const id of Object.keys(SV_NAMES))
    assert.ok(catalogueById.has(id), id);
});

test("Swedish shows the Swedish name of a built-in, else the stored name", () => {
  assert.equal(
    exerciseDisplayName("builtin:tricep-pushdown", "Tricep Pushdown", "sv"),
    "Tricepsnedtryck med kabel",
  );
  assert.equal(
    exerciseDisplayName("builtin:tricep-pushdown", "Tricep Pushdown", "en"),
    "Tricep Pushdown",
  );
  // A built-in without a Swedish name, and your own exercise, as stored.
  assert.equal(
    exerciseDisplayName("builtin:cable-fly", "Cable Fly", "sv"),
    "Cable Fly",
  );
  assert.equal(
    exerciseDisplayName("3b0c1d9e-0000-4000-8000-000000000001", "Knästående pallofpress", "sv"),
    "Knästående pallofpress",
  );
  // The language defaults to the app's current one.
  setCurrentLanguage("sv");
  assert.equal(exerciseDisplayName("builtin:squat", "Squat"), "Knäböj");
  setCurrentLanguage("en");
  assert.equal(exerciseDisplayName("builtin:squat", "Squat"), "Squat");
});

test("the subtitle: equipment and English name, or equipment, category and own", () => {
  setCurrentLanguage("sv");
  assert.equal(
    exerciseSubtitle({
      id: "builtin:bench-press",
      equipment: "barbell",
      category: "Chest",
      custom: false,
      englishName: "Bench Press",
    }),
    "skivstång · Bench Press",
  );
  assert.equal(
    exerciseSubtitle({
      id: "3b0c1d9e-0000-4000-8000-000000000001",
      equipment: "cable",
      category: "Core",
      custom: true,
      englishName: "Knästående pallofpress",
    }),
    "kabel · Bål · egen",
  );
  assert.equal(
    exerciseSubtitle({
      id: "3b0c1d9e-0000-4000-8000-000000000001",
      category: "Core",
      custom: true,
      englishName: "Plankan",
    }),
    "Bål · egen",
  );
  // In English the name is already English: the equipment alone.
  setCurrentLanguage("en");
  assert.equal(
    exerciseSubtitle({
      id: "builtin:bench-press",
      equipment: "barbell",
      category: "Chest",
      custom: false,
      englishName: "Bench Press",
    }),
    "barbell",
  );
  assert.equal(
    exerciseSubtitle({
      id: "x",
      equipment: "cable",
      category: "Core",
      custom: true,
      englishName: "Kneeling Pallof",
    }),
    "cable · Core · own",
  );
});
