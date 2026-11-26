import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveRest,
  normalizeTrainingPreferences,
  readTrainingPreferences,
  saveRestTimerOn,
  saveTrainingPreferences,
  type TrainingPreferences,
} from "../src/lib/preferences";
import { storageKeys } from "../src/lib/storage";

// A device's localStorage and window for the read and save paths.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  window: { dispatchEvent: () => true },
});

test("an existing saved time reads as on", () => {
  const prefs = normalizeTrainingPreferences({ rest: "150", restOn: null });
  assert.equal(prefs.restOn, true);
  assert.equal(prefs.restSeconds, 150);
});

test("a new user is off, with RIR off, fatigue suggest and tips on", () => {
  const prefs = normalizeTrainingPreferences({});
  assert.equal(prefs.restOn, false);
  assert.equal(prefs.restSeconds, 0);
  assert.equal(prefs.askRir, false);
  assert.equal(prefs.fatigueMode, "suggest");
  assert.equal(prefs.workoutTips, true);
  assert.equal(prefs.restSound, true);
  assert.equal(prefs.haptics, false);
});

test("an explicit off wins and keeps the time", () => {
  const prefs = normalizeTrainingPreferences({ rest: "150", restOn: "false" });
  assert.equal(prefs.restOn, false);
  assert.equal(prefs.restSeconds, 150);
  // On with no time follows the tiers.
  const tiers = normalizeTrainingPreferences({ rest: "0", restOn: "true" });
  assert.deepEqual([tiers.restOn, tiers.restSeconds], [true, 0]);
});

test("workout tips, fatigue mode and the positional form", () => {
  assert.equal(
    normalizeTrainingPreferences({ workoutTips: "false" }).workoutTips,
    false,
  );
  for (const mode of ["off", "suggest", "auto"] as const)
    assert.equal(
      normalizeTrainingPreferences({ fatigueMode: mode }).fatigueMode,
      mode,
    );
  assert.equal(
    normalizeTrainingPreferences({ fatigueMode: "always" }).fatigueMode,
    "suggest",
  );
  // The positional form older callers use still works, with the migration.
  const positional = normalizeTrainingPreferences(
    "90",
    "true",
    "3",
    "lb",
    "false",
    "true",
  );
  assert.equal(positional.restSeconds, 90);
  assert.equal(positional.restOn, true);
  assert.equal(positional.haptics, true);
  assert.equal(positional.weeklyGoal, 3);
  assert.equal(positional.weightUnit, "lb");
  assert.equal(positional.restSound, false);
  assert.equal(positional.askRir, true);
});

const prefs = (patch: Partial<TrainingPreferences>): TrainingPreferences => ({
  ...normalizeTrainingPreferences({}),
  ...patch,
});

test("effectiveRest: own, then off, then the all-exercises time, then the tier", () => {
  const on = prefs({ restOn: true });
  const off = prefs({ restOn: false });
  assert.equal(effectiveRest(on, undefined, 90), 90);
  assert.equal(
    effectiveRest(prefs({ restOn: true, restSeconds: 150 }), undefined, 90),
    150,
  );
  assert.equal(effectiveRest(off, 120, 90), 120);
  assert.equal(effectiveRest(on, 0, 90), 0);
  assert.equal(effectiveRest(off, undefined, 90), 0);
  assert.equal(
    effectiveRest(prefs({ restOn: false, restSeconds: 150 }), undefined, 90),
    0,
  );
});

test("reading the device: an upgrade keeps the saved time on", () => {
  store.clear();
  store.set(storageKeys.restSeconds, "150");
  const read = readTrainingPreferences();
  assert.deepEqual([read.restOn, read.restSeconds], [true, 150]);
  store.clear();
  const fresh = readTrainingPreferences();
  assert.deepEqual([fresh.restOn, fresh.restSeconds], [false, 0]);
});

test("saving writes the new keys, and the timer switch writes restOn", () => {
  store.clear();
  saveTrainingPreferences({ fatigueMode: "auto", workoutTips: false });
  assert.equal(store.get(storageKeys.fatigueMode), "auto");
  assert.equal(store.get(storageKeys.workoutTips), "false");
  saveTrainingPreferences({ fatigueMode: "suggest", workoutTips: true });
  assert.equal(store.has(storageKeys.fatigueMode), false);
  assert.equal(store.has(storageKeys.workoutTips), false);

  store.clear();
  store.set(storageKeys.restSeconds, "150");
  saveRestTimerOn(false);
  assert.equal(store.get(storageKeys.restOn), "false");
  assert.equal(readTrainingPreferences().restOn, false);
  saveRestTimerOn(true);
  assert.equal(store.get(storageKeys.restOn), "true");
  const back = readTrainingPreferences();
  assert.deepEqual([back.restOn, back.restSeconds], [true, 150]);
  assert.equal(storageKeys.barKg, "gt-bar-kg");
  assert.equal(storageKeys.plates, "gt-plates");
});
