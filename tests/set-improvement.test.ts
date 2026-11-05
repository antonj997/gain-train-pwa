import test from "node:test";
import assert from "node:assert/strict";
import type { WorkoutSet } from "../src/data/model";
import { improvedSetIds, improvedSince } from "../src/data/set-improvement";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
const better = (prev: Partial<WorkoutSet>, cur: Partial<WorkoutSet>) =>
  improvedSince(set(prev), set(cur));

test("weighted: more weight at the same reps or more, or the same weight with more reps", () => {
  assert.equal(better({}, { weight: 102.5 }), true);
  assert.equal(better({}, { weight: 102.5, reps: 6 }), true);
  assert.equal(better({}, { reps: 6 }), true);
  assert.equal(better({}, {}), false);
  assert.equal(better({}, { reps: 4 }), false);
  assert.equal(better({}, { weight: 97.5, reps: 6 }), false);
  assert.equal(better({ weight: 0, reps: 10 }, { weight: 0, reps: 12 }), true);
});

test("weighted: a higher set volume counts only with the weight not lower", () => {
  // 130 × 5 = 650 beats 100 × 6 = 600 at fewer reps.
  assert.equal(better({ reps: 6 }, { weight: 130, reps: 5 }), true);
  // 105 × 4 = 420 is under 100 × 6 = 600.
  assert.equal(better({ reps: 6 }, { weight: 105, reps: 4 }), false);
  // 90 × 8 = 720 beats 500, but the weight is lower.
  assert.equal(better({}, { weight: 90, reps: 8 }), false);
});

test("bodyweight: more reps; added weight compares like weight", () => {
  const bw = { load: "bodyweight" as const, weight: null };
  assert.equal(better({ ...bw, reps: 10 }, { ...bw, reps: 11 }), true);
  assert.equal(better({ ...bw, reps: 10 }, { ...bw, reps: 10 }), false);
  // The body weight a set saved does not count.
  assert.equal(
    better(
      { ...bw, reps: 10, bodyWeightKg: 80 },
      { ...bw, reps: 10, bodyWeightKg: 82 },
    ),
    false,
  );
  const plus = { load: "bodyweight" as const, extraWeight: true };
  assert.equal(
    better(
      { ...plus, weight: 10, reps: 8 },
      { ...plus, weight: 12.5, reps: 8 },
    ),
    true,
  );
  assert.equal(
    better({ ...plus, weight: 10, reps: 8 }, { ...plus, weight: 10, reps: 9 }),
    true,
  );
  assert.equal(
    better(
      { ...plus, weight: 10, reps: 8 },
      { ...plus, weight: 7.5, reps: 12 },
    ),
    false,
  );
  // Added weight against plain bodyweight is not the same kind of set.
  assert.equal(
    better({ ...bw, reps: 8 }, { ...plus, weight: 10, reps: 8 }),
    false,
  );
});

test("assisted: less assistance is better", () => {
  const help = (weight: number, reps: number) => ({
    load: "assisted" as const,
    weight,
    reps,
  });
  assert.equal(better(help(30, 8), help(25, 8)), true);
  assert.equal(better(help(30, 8), help(30, 9)), true);
  assert.equal(better(help(30, 8), help(35, 10)), false);
  // Less help with fewer reps: no volume rule for assistance.
  assert.equal(better(help(30, 8), help(20, 6)), false);
  assert.equal(better(help(30, 8), help(30, 8)), false);
});

test("timed holds: more seconds; with added weight, more weight at the same time", () => {
  const hold = (reps: number, extra?: number) => ({
    load: "bodyweight" as const,
    measure: "seconds" as const,
    reps,
    weight: extra ?? null,
    ...(extra ? { extraWeight: true } : {}),
  });
  assert.equal(better(hold(45), hold(50)), true);
  assert.equal(better(hold(45), hold(45)), false);
  assert.equal(better(hold(45), hold(40)), false);
  assert.equal(better(hold(45, 10), hold(45, 15)), true);
  assert.equal(better(hold(45, 10), hold(60, 10)), true);
  // A timed set has no volume: 15 kg × 30 s is not better than 10 kg × 45 s.
  assert.equal(better(hold(45, 10), hold(30, 15)), false);
  // Seconds against reps never compare.
  assert.equal(
    better({ load: "bodyweight", weight: null, reps: 45 }, hold(50)),
    false,
  );
});

test("reps + hold: the hold must not be shorter; a longer hold at the same reps is better", () => {
  assert.equal(better({ holdSec: 2 }, { reps: 6, holdSec: 2 }), true);
  assert.equal(better({ holdSec: 2 }, { reps: 6, holdSec: 1 }), false);
  assert.equal(better({ holdSec: 2 }, { holdSec: 3 }), true);
  assert.equal(better({ holdSec: 2 }, { holdSec: 2 }), false);
  assert.equal(better({ holdSec: 2 }, { reps: 4, holdSec: 5 }), false);
  // A set without a hold compares on weight and reps alone.
  assert.equal(better({}, { reps: 6, holdSec: 1 }), true);
  assert.equal(better({ holdSec: 3 }, { reps: 6 }), true);
  assert.equal(better({}, { holdSec: 3 }), false);
});

test("no previous set, another load, cardio or an invalid set: no arrow", () => {
  assert.equal(improvedSince(undefined, set()), false);
  assert.equal(improvedSince(null, set()), false);
  assert.equal(
    better({ load: "bodyweight", weight: null }, { reps: 8 }),
    false,
  );
  assert.equal(better({}, { reps: null }), false);
  const run = {
    measure: "cardio" as const,
    reps: null,
    weight: null,
    durationSec: 600,
    distanceM: 2000,
  };
  assert.equal(better(run, { ...run, durationSec: 700 }), false);
});

test("improved sets: working sets only, matched like the Previous column", () => {
  const prior = [
    set({ section: "warmup", weight: 60, reps: 8 }),
    set({ weight: 100, reps: 5 }),
    set({ weight: 90, reps: 8, drop: true }),
    set({ weight: 100, reps: 5 }),
    set({ weight: 100, reps: 5, done: false }),
  ];
  const sets = [
    set({ section: "warmup", weight: 70, reps: 8 }),
    set({ weight: 100, reps: 6 }),
    set({ weight: 95, reps: 10, drop: true }),
    set({ weight: 100, reps: 5 }),
    // A third set has no third set last time: it compares with the last one,
    // as the Previous column shows.
    set({ weight: 102.5, reps: 5 }),
    set({ weight: 110, reps: 5, done: false }),
  ];
  assert.deepEqual([...improvedSetIds(sets, prior)], [sets[1].id, sets[4].id]);
  assert.equal(improvedSetIds(sets, undefined).size, 0);
  assert.equal(improvedSetIds(sets, []).size, 0);
});
