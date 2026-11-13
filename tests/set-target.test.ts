import test from "node:test";
import assert from "node:assert/strict";
import type { WorkoutSet } from "../src/data/model";
import {
  fillFrom,
  targetRowText,
  targetSource,
  targetValueText,
} from "../src/lib/set-target";
import { setCurrentLanguage } from "../src/i18n";
import { setCurrentWeightUnit } from "../src/lib/units";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  load: "weight",
  section: "working",
  done: false,
  ...overrides,
});

test("the target under Previous leaves out the unit for a plain weight", () => {
  setCurrentLanguage("en");
  setCurrentWeightUnit("kg");
  const last = set({ weight: 85, reps: 5, done: true });
  assert.equal(targetValueText({ weight: 87.5, reps: 5 }, last), "87.5 × 5");
  assert.equal(
    targetRowText({ weight: 87.5, reps: 5 }, last),
    "Target 87.5 × 5",
  );
  setCurrentLanguage("sv");
  assert.equal(targetRowText({ weight: 87.5, reps: 5 }, last), "Mål 87,5 × 5");
  setCurrentLanguage("en");
});

test("other loads read the target in the set's own words", () => {
  setCurrentLanguage("en");
  setCurrentWeightUnit("kg");
  assert.equal(
    targetValueText(
      { weight: null, reps: 11 },
      set({ load: "bodyweight", reps: 10, done: true }),
    ),
    "BW × 11",
  );
  // A plank with added weight counts seconds.
  assert.equal(
    targetValueText(
      { weight: 10, reps: 65 },
      set({
        load: "bodyweight",
        extraWeight: true,
        measure: "seconds",
        weight: 10,
        reps: 60,
        done: true,
      }),
    ),
    "+10 · 65 s",
  );
  assert.equal(
    targetValueText(
      { weight: 20, reps: 8 },
      set({ load: "assisted", weight: 25, reps: 8, done: true }),
    ),
    "\u221220 × 8",
  );
  assert.equal(
    targetValueText(
      { weight: 10, reps: 9 },
      set({ load: "bodyweight", extraWeight: true, weight: 7.5, done: true }),
    ),
    "+10 × 9",
  );
  assert.equal(
    targetValueText(
      { weight: null, reps: 50 },
      set({ load: "bodyweight", measure: "seconds", done: true }),
    ),
    "50 s",
  );
  assert.equal(
    targetValueText({ weight: null, reps: 12 }, set({ load: "none" })),
    "12 reps",
  );
});

test("fillFrom fills the weight and reps of an unchecked set in one go", () => {
  const last = set({ weight: 85, reps: 5, done: true });
  const filled = fillFrom(set(), targetSource({ weight: 87.5, reps: 5 }, last));
  assert.equal(filled.weight, 87.5);
  assert.equal(filled.reps, 5);
  // From last time's result as it is.
  assert.equal(fillFrom(set({ weight: 60 }), last).weight, 85);
  // Typed text that was not finished goes.
  const typed = fillFrom(
    { ...set(), inputText: { weight: "87," } } as WorkoutSet,
    last,
  );
  assert.equal((typed as { inputText?: object }).inputText, undefined);
});

test("fillFrom leaves a checked or cardio set, and fills only what matches", () => {
  const last = set({ weight: 85, reps: 5, done: true });
  const done = set({ weight: 80, reps: 5, done: true });
  assert.equal(fillFrom(done, last), done);
  const cardio = set({ measure: "cardio", load: "weight" });
  assert.equal(fillFrom(cardio, last), cardio);
  // A weight is not an added weight: only the reps carry over.
  const plus = fillFrom(set({ load: "bodyweight", extraWeight: true }), last);
  assert.equal(plus.weight, null);
  assert.equal(plus.reps, 5);
  // No load: nothing to weigh, the reps still fill.
  const none = fillFrom(set({ load: "none" }), last);
  assert.equal(none.weight, null);
  assert.equal(none.reps, 5);
  // Seconds are not reps.
  const hold = fillFrom(set({ load: "bodyweight", measure: "seconds" }), last);
  assert.equal(hold.reps, null);
  // A hold with added weight fills both from a hold with added weight.
  const plank = fillFrom(
    set({ load: "bodyweight", extraWeight: true, measure: "seconds" }),
    targetSource(
      { weight: 10, reps: 65 },
      set({
        load: "bodyweight",
        extraWeight: true,
        measure: "seconds",
        weight: 10,
        reps: 60,
        done: true,
      }),
    ),
  );
  assert.equal(plank.weight, 10);
  assert.equal(plank.reps, 65);
});
