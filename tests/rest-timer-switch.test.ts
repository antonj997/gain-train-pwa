import test from "node:test";
import assert from "node:assert/strict";
import { readTrainingPreferences } from "../src/lib/preferences";
import { restTimerPatch, switchRestTimer } from "../src/lib/rest-timer-switch";
import { storageKeys } from "../src/lib/storage";

// A device's localStorage and window for the save paths.
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  window: { dispatchEvent: () => true },
});

test("a new user's timer switched on follows the tiers (no time for all)", () => {
  assert.deepEqual(restTimerPatch(true, 0, null), {
    restOn: true,
    restSeconds: 0,
  });
  store.clear();
  switchRestTimer(true);
  const prefs = readTrainingPreferences();
  assert.deepEqual([prefs.restOn, prefs.restSeconds], [true, 0]);
});

test("switched on again, a time saved before comes back for all exercises", () => {
  assert.deepEqual(restTimerPatch(true, 0, "150"), {
    restOn: true,
    restSeconds: 150,
  });
  // A time still set is kept as it is.
  assert.deepEqual(restTimerPatch(true, 90, "150"), {
    restOn: true,
    restSeconds: 90,
  });
  // Nonsense in storage is not a time.
  assert.deepEqual(restTimerPatch(true, 0, "abc"), {
    restOn: true,
    restSeconds: 0,
  });
  assert.deepEqual(restTimerPatch(true, 0, "9999"), {
    restOn: true,
    restSeconds: 0,
  });
});

test("switched off, the time is put aside and comes back when on", () => {
  store.clear();
  // An upgraded phone: a saved time with no on/off reads as on.
  store.set(storageKeys.restSeconds, "150");
  assert.equal(readTrainingPreferences().restOn, true);
  switchRestTimer(false);
  let prefs = readTrainingPreferences();
  assert.deepEqual([prefs.restOn, prefs.restSeconds], [false, 0]);
  assert.equal(store.get(storageKeys.restLastSeconds), "150");
  assert.equal(store.get(storageKeys.restOn), "false");
  switchRestTimer(true);
  prefs = readTrainingPreferences();
  assert.deepEqual([prefs.restOn, prefs.restSeconds], [true, 150]);
});

test("off while following the tiers forgets an older time, so on follows the tiers", () => {
  assert.deepEqual(restTimerPatch(false, 0, "150"), {
    restOn: false,
    restSeconds: 0,
  });
  store.clear();
  store.set(storageKeys.restLastSeconds, "150");
  store.set(storageKeys.restOn, "true");
  switchRestTimer(false);
  assert.equal(store.get(storageKeys.restLastSeconds), undefined);
  assert.equal(readTrainingPreferences().restOn, false);
  switchRestTimer(true);
  assert.equal(readTrainingPreferences().restSeconds, 0);
});
