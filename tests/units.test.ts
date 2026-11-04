import test from "node:test";
import assert from "node:assert/strict";
import {
  KG_PER_LB,
  formatWeight,
  formatWeightValue,
  fromUnit,
  parseWeightUnit,
  toUnit,
  toUnitField,
} from "../src/lib/units.ts";
import { normalizeTrainingPreferences } from "../src/lib/preferences.ts";
import { setCurrentLanguage } from "../src/i18n/index.ts";

test("a pound is exactly 0.45359237 kg", () => {
  assert.equal(KG_PER_LB, 0.45359237);
  assert.equal(toUnit(KG_PER_LB * 100, "lb"), 100);
});

test("kilograms show as stored; pounds to one decimal", () => {
  assert.equal(toUnit(61.25, "kg"), 61.25);
  assert.equal(toUnit(60, "lb"), 132.3);
  assert.equal(toUnit(100, "lb"), 220.5);
  assert.equal(toUnit(0, "lb"), 0);
  assert.equal(formatWeightValue(60, "lb"), "132.3");
  assert.equal(formatWeight(60, "kg"), "60 kg");
  assert.equal(formatWeight(60, "lb"), "132.3 lb");
  // A whole number of pounds drops the ".0".
  assert.equal(formatWeight(fromUnit(135, "lb"), "lb"), "135 lb");
});

test("typed pounds store as kilograms and show the same pounds again", () => {
  assert.equal(fromUnit(60, "kg"), 60);
  assert.equal(fromUnit(135, "lb"), 61.235);
  for (let lb = 0; lb <= 1000; lb += 0.1) {
    const typed = Math.round(lb * 10) / 10;
    assert.equal(toUnit(fromUnit(typed, "lb"), "lb"), typed, String(typed));
  }
});

test("a set field shows typed pounds as typed, other values to one decimal", () => {
  assert.equal(toUnitField(60, "kg"), 60);
  assert.equal(toUnitField(60, "lb"), 132.3);
  for (const typed of [132.25, 135, 0.5, 45.05, 999.99])
    assert.equal(toUnitField(fromUnit(typed, "lb"), "lb"), typed);
});

test("the unit follows the language's decimal mark", () => {
  setCurrentLanguage("sv");
  try {
    assert.equal(formatWeight(60, "lb"), "132,3 lb");
  } finally {
    setCurrentLanguage("en");
  }
});

test("the unit preference defaults to kg", () => {
  assert.equal(parseWeightUnit(null), "kg");
  assert.equal(parseWeightUnit("stone"), "kg");
  assert.equal(parseWeightUnit("lb"), "lb");
  assert.equal(normalizeTrainingPreferences(null, null).weightUnit, "kg");
  assert.equal(
    normalizeTrainingPreferences(null, null, null, "lb").weightUnit,
    "lb",
  );
});
