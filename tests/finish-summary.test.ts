import test from "node:test";
import assert from "node:assert/strict";
import type { Workout, WorkoutSet } from "../src/data/model";
import {
  finishSummary,
  formatVolume,
  weekOrdinal,
  weekWorkoutNumber,
} from "../src/lib/finish-summary";

test("week ordinals: 1:a, 2:a, 3:e … in Swedish; 1st, 2nd, 3rd … in English", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((n) => weekOrdinal(n, "sv")),
    ["1:a", "2:a", "3:e", "4:e", "5:e", "6:e", "7:e"],
  );
  assert.equal(weekOrdinal(11, "sv"), "11:e");
  assert.equal(weekOrdinal(21, "sv"), "21:a");
  assert.deepEqual(
    [1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => weekOrdinal(n, "en")),
    ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"],
  );
});

test("volume has a narrow no-break space from 1 000", () => {
  assert.equal(formatVolume(6252), "6 252");
  assert.equal(formatVolume(980), "980");
  assert.equal(formatVolume(1000), "1 000");
  assert.equal(formatVolume(1234567.4), "1 234 567");
  assert.equal(formatVolume(0), "0");
});

const set = (extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  weight: 100,
  reps: 6,
  load: "weight",
  section: "working",
  done: true,
  ...extra,
});
const workout = (sets: WorkoutSet[][]): Workout => ({
  name: "Benpass",
  date: "2026-11-19",
  duration: null,
  startedAt: null,
  status: "draft",
  exercises: sets.map((s, i) => ({
    id: crypto.randomUUID(),
    exerciseId: `ex${i}`,
    name: `Ex ${i}`,
    sets: s,
  })),
});

test("the summary counts done and open sets, the volume and the strongest record", () => {
  const w = workout([
    [set(), set(), set({ done: false })],
    [set({ done: false }), set({ done: false })],
  ]);
  const summary = finishSummary(w, [
    { text: "Knäböj 100 kg × 6", previous: "97,5 kg × 6" },
    { text: "Benpress 200 kg × 10", previous: null },
  ]);
  assert.equal(summary.done, 2);
  assert.equal(summary.total, 5);
  assert.equal(summary.unchecked, 3);
  assert.equal(summary.volumeKg, 1200);
  assert.deepEqual(summary.record, {
    text: "Knäböj 100 kg × 6",
    previous: "97,5 kg × 6",
    more: 1,
  });
  assert.equal(finishSummary(w, []).record, null);
});

test("nothing checked: no volume, every set open", () => {
  const w = workout([[set({ done: false }), set({ done: false })]]);
  const summary = finishSummary(w, []);
  assert.deepEqual(
    [summary.done, summary.total, summary.unchecked, summary.volumeKg],
    [0, 2, 2, 0],
  );
});

test("the reward counts this week's workouts up to this one", () => {
  const dates = ["2026-11-16", "2026-11-12", "2026-11-18", "2026-11-23"];
  // Monday 16 to Sunday 22 November: the 16th and the 18th, then this one.
  assert.equal(weekWorkoutNumber(dates, "2026-11-19"), 3);
  assert.equal(weekWorkoutNumber([], "2026-11-19"), 1);
});
