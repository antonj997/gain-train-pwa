import test from "node:test";
import assert from "node:assert/strict";
import {
  countChoice,
  holdLabel,
  holdOf,
  repHoldIds,
  withRepHold,
  withoutHiddenHolds,
} from "../src/lib/rep-hold";
import { countHeading } from "../src/lib/load-keys";
import { plannedSummary } from "../src/lib/routine-preview";
import { mergeLibraries } from "../src/data/exercises";
import { getSetIssues } from "../src/lib/workout-editor";
import { changeSetNumber, hasUnfinishedInput } from "../src/lib/set-input";
import {
  labelSet,
  newSet,
  validSet,
  validate,
  type WorkoutSet,
} from "../src/data/model";
import { setCurrentLanguage } from "../src/i18n";

const set = (extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  ...newSet(),
  reps: 6,
  weight: 60,
  done: true,
  ...extra,
});

test("a reps set's hold reads as seconds after the reps", () => {
  setCurrentLanguage("en");
  assert.equal(holdOf(set({ holdSec: 2 })), 2);
  assert.equal(holdOf(set({ holdSec: 0 })), null);
  assert.equal(holdOf(set()), null);
  // A timed set has no hold to show.
  assert.equal(
    holdOf(set({ measure: "seconds", load: "bodyweight", holdSec: 2 })),
    null,
  );
  assert.equal(holdLabel(set({ holdSec: 2 })), "2 s");
  assert.equal(labelSet(set({ holdSec: 2 })), "60 kg × 6 · 2 s");
  assert.equal(
    labelSet(set({ load: "bodyweight", weight: null, holdSec: 3 })),
    "BW × 6 · 3 s",
  );
  // Records and best sets stay weight × reps.
  assert.equal(labelSet(set({ holdSec: 2 }), false), "60 kg × 6");
  assert.equal(labelSet(set()), "60 kg × 6");
  setCurrentLanguage("sv");
  assert.equal(
    labelSet(set({ load: "bodyweight", weight: null, holdSec: 2 })),
    "KV × 6 · 2 s",
  );
  setCurrentLanguage("en");
});

test("a new set copies the hold of the set above", () => {
  assert.equal(newSet(set({ holdSec: 2 })).holdSec, 2);
  assert.equal("holdSec" in newSet(set()), false);
  assert.equal("holdSec" in newSet(set({ holdSec: null })), false);
});

test("a hold is optional, whole seconds from 0 to 600", () => {
  assert.equal(validSet(set({ holdSec: 2 })), true);
  assert.equal(validSet(set({ holdSec: null })), true);
  assert.equal(validSet(set({ holdSec: 601 })), false);
  assert.equal(validSet(set({ holdSec: 1.5 })), false);
  assert.equal(
    getSetIssues(set({ holdSec: 2, done: false })).holdSec,
    undefined,
  );
  assert.match(
    getSetIssues(set({ holdSec: 700, done: false })).holdSec ?? "",
    /600/,
  );
  const typing = changeSetNumber(set({ done: false }), "holdSec", null, "2.");
  assert.equal(hasUnfinishedInput(typing), true);
  assert.ok(getSetInputText(typing));
  const workout = {
    name: "W",
    date: "2026-11-01",
    duration: null,
    startedAt: null,
    status: "completed" as const,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:squat",
        name: "Squat",
        sets: [set({ holdSec: 2 })],
      },
    ],
  };
  assert.equal(validate("workout", workout).exercises[0].sets[0].holdSec, 2);
  workout.exercises[0].sets[0].holdSec = 900;
  assert.throws(() => validate("workout", workout), /600/);
});

function getSetInputText(s: WorkoutSet) {
  return (s as { inputText?: { holdSec?: string } }).inputText?.holdSec;
}

test("the count menu and heading follow the saved hold choice", () => {
  setCurrentLanguage("en");
  assert.equal(countChoice("reps", true), "repsHold");
  assert.equal(countChoice("reps", false), "reps");
  assert.equal(countChoice("seconds", true), "seconds");
  assert.equal(countHeading([set()], true), "Reps · hold");
  assert.equal(countHeading([set()]), "Reps");
  assert.equal(
    countHeading([set({ measure: "seconds", load: "bodyweight" })], true),
    "Sec",
  );
});

test("the library remembers which exercises count reps + hold", () => {
  const empty = { hiddenExerciseIds: [] };
  const on = withRepHold(empty, "builtin:squat", true);
  assert.deepEqual(on.repHold, ["builtin:squat"]);
  assert.deepEqual(withRepHold(on, "builtin:squat", true).repHold, [
    "builtin:squat",
  ]);
  assert.deepEqual(withRepHold(on, "builtin:squat", false).repHold, []);
  assert.equal(repHoldIds(on).has("builtin:squat"), true);
  assert.equal(repHoldIds(empty).size, 0);
  assert.deepEqual(validate("library", on).repHold, ["builtin:squat"]);
  assert.throws(() => validate("library", { ...empty, repHold: [""] }));
  assert.deepEqual(
    mergeLibraries(on, { hiddenExerciseIds: [], repHold: ["builtin:dip"] })
      .repHold,
    ["builtin:squat", "builtin:dip"],
  );
  assert.equal("repHold" in mergeLibraries(empty, empty), false);
});

test("a set checked while the hold field is hidden is logged without it", () => {
  const open = set({ done: false, holdSec: 2 });
  const kept = set({ holdSec: 3 });
  const before = [kept, open];
  const after = [kept, { ...open, done: true }];
  const result = withoutHiddenHolds(before, after);
  assert.equal(result[0].holdSec, 3);
  assert.equal("holdSec" in result[1], false);
  // Nothing newly checked: the same array back.
  assert.equal(withoutHiddenHolds(after, after), after);
});

test("a routine's summary includes a shared hold", () => {
  setCurrentLanguage("en");
  const exercise = {
    id: crypto.randomUUID(),
    exerciseId: "builtin:squat",
    name: "Squat",
    sets: [set({ holdSec: 2 }), set({ holdSec: 2 }), set({ holdSec: 2 })],
  };
  assert.equal(plannedSummary(exercise), "3 × 6 · 2 s · 60 kg");
  exercise.sets[2] = set();
  assert.equal(plannedSummary(exercise), "3 sets");
});
