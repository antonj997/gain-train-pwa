import test from "node:test";
import assert from "node:assert/strict";
import {
  headingMeta,
  headingRange,
  isPerLeg,
} from "../src/lib/exercise-heading";
import { setCurrentLanguage } from "../src/i18n";

test("the meta line names the equipment and its step (v6 B1)", () => {
  setCurrentLanguage("sv");
  try {
    assert.equal(
      headingMeta({ equipment: "barbell", step: 2.5 }),
      "Skivstång ±2,5",
    );
    assert.equal(headingMeta({ equipment: "machine", step: 5 }), "Maskin ±5");
    assert.equal(
      headingMeta({
        equipment: "dumbbell",
        step: 2,
        perHand: true,
        perLeg: isPerLeg("builtin:bulgarian-split-squat"),
      }),
      "Hantlar ±2 · kg per hand · per ben",
    );
    // Pounds keep the 5 lb step and say lb per hand.
    assert.equal(
      headingMeta({
        equipment: "dumbbell",
        step: 2,
        perHand: true,
        unit: "lb",
      }),
      "Hantlar ±5 · lb per hand",
    );
  } finally {
    setCurrentLanguage("en");
  }
  assert.equal(
    headingMeta({ equipment: "barbell", step: 2.5 }),
    "Barbell ±2.5",
  );
});

test("single-leg exercises are per leg; two-leg ones are not", () => {
  assert.equal(isPerLeg("builtin:bulgarian-split-squat"), true);
  assert.equal(isPerLeg("builtin:pistol-squat"), true);
  assert.equal(isPerLeg("builtin:single-leg-romanian-deadlift"), true);
  assert.equal(isPerLeg("builtin:squat"), false);
  assert.equal(isPerLeg("custom-id"), false);
});

test("the range line counts working sets, with the range when there is one", () => {
  setCurrentLanguage("sv");
  try {
    assert.equal(headingRange({ min: 5, max: 7 }, 3), "5–7 reps · 3 set");
    assert.equal(headingRange(undefined, 3), "3 set");
    assert.equal(headingRange({ min: 8, max: 8 }, 1), "8 reps · 1 set");
  } finally {
    setCurrentLanguage("en");
  }
  assert.equal(headingRange({ min: 5, max: 7 }, 3), "5–7 reps · 3 sets");
  assert.equal(headingRange(undefined, 1), "1 set");
});
