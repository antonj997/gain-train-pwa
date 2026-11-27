import test from "node:test";
import assert from "node:assert/strict";
import {
  RIR_TEXT,
  RIR_VALUE_TEXT,
  rirFromPosition,
  rirKey,
} from "../src/lib/rir-slider";
import { setCurrentLanguage, translate } from "../src/i18n";

test("a point on the track steps to the nearest whole RIR", () => {
  assert.equal(rirFromPosition(0, 200), 0);
  assert.equal(rirFromPosition(200, 200), 5);
  assert.equal(rirFromPosition(81, 200), 2);
  // Past either end it stays on the scale.
  assert.equal(rirFromPosition(-30, 200), 0);
  assert.equal(rirFromPosition(260, 200), 5);
  assert.equal(rirFromPosition(10, 0), 0);
});

test("arrows step one, Home and End go to the ends, an unset value starts at 2", () => {
  assert.equal(rirKey(5, "ArrowRight"), 5);
  assert.equal(rirKey(2, "ArrowRight"), 3);
  assert.equal(rirKey(2, "ArrowUp"), 3);
  assert.equal(rirKey(2, "ArrowLeft"), 1);
  assert.equal(rirKey(0, "ArrowDown"), 0);
  assert.equal(rirKey(null, "Home"), 0);
  assert.equal(rirKey(3, "End"), 5);
  assert.equal(rirKey(null, "ArrowRight"), 2);
  assert.equal(rirKey(null, "ArrowLeft"), 2);
  // Any other key changes nothing.
  assert.equal(rirKey(4, "a"), 4);
  assert.equal(rirKey(null, "Tab"), null);
});

test("every value has the spec's sentence and value text (v6 B12)", () => {
  setCurrentLanguage("sv");
  try {
    assert.equal(
      translate("sv", RIR_TEXT.unset),
      "Dra reglaget eller tryck på ett värde. RIR är valfritt.",
    );
    assert.equal(
      translate("sv", RIR_TEXT[0]),
      "Inga reps kvar: setet gick till max (≈ RPE 10).",
    );
    assert.equal(
      translate("sv", RIR_TEXT[2]),
      "2 reps kvar i tanken (≈ RPE 8).",
    );
    assert.equal(
      translate("sv", RIR_TEXT[5]),
      "5 eller fler kvar (≈ RPE 5 eller lägre).",
    );
    assert.equal(translate("sv", RIR_VALUE_TEXT.unset), "Inte valt");
    assert.equal(translate("sv", RIR_VALUE_TEXT[0]), "0, max");
    assert.equal(translate("sv", RIR_VALUE_TEXT[1]), "1 rep kvar");
    assert.equal(translate("sv", RIR_VALUE_TEXT[4]), "4 reps kvar");
    assert.equal(translate("sv", RIR_VALUE_TEXT[5]), "5 eller fler, lätt");
  } finally {
    setCurrentLanguage("en");
  }
});
