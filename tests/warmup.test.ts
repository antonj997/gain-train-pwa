import test from "node:test";
import assert from "node:assert/strict";
import {
  PLATES,
  platesPerSide,
  warmupLadder,
  warmupSets,
} from "../src/lib/warmup";
import { newSet } from "../src/data/model";

test("a barbell ladder: the empty bar, then 40, 60 and 80 % to the step", () => {
  const ladder = warmupLadder(100, 2.5, 20, true);
  assert.deepEqual(
    ladder.map((row) => row.kg),
    [20, 40, 60, 80],
  );
  assert.deepEqual(
    ladder.map((row) => row.reps),
    [10, 8, 5, 2],
  );
  assert.equal(ladder[0].emptyBar, true);
  assert.deepEqual(ladder[0].plates, []);
  assert.deepEqual(ladder[3].plates, [25, 5]);
  assert.equal(ladder[1].emptyBar, false);
});

test("plates per side are greedy from 25 down, or null when they cannot make it", () => {
  assert.deepEqual(platesPerSide(80, 20), [25, 5]);
  assert.deepEqual(platesPerSide(40, 20), [10]);
  assert.deepEqual(platesPerSide(20, 20), []);
  assert.equal(platesPerSide(21, 20), null);
  assert.equal(platesPerSide(15, 20), null);
  assert.deepEqual(platesPerSide(102.5, 20), [25, 15, 1.25]);
  // Only the plates you have.
  assert.deepEqual(platesPerSide(60, 20, [20, 10, 5]), [20]);
  assert.equal(platesPerSide(65, 20, [20, 10]), null);
  assert.deepEqual([...PLATES], [25, 20, 15, 10, 5, 2.5, 1.25]);
});

test("other equipment: three rows at 40, 60 and 80 %, no bar and no plates", () => {
  const ladder = warmupLadder(22, 2, 20, false);
  assert.deepEqual(
    ladder.map((row) => row.kg),
    [8, 14, 18],
  );
  assert.deepEqual(
    ladder.map((row) => row.reps),
    [8, 5, 2],
  );
  assert.ok(ladder.every((row) => row.plates === null && !row.emptyBar));
});

test("a light work set never warms up below the bar or twice at one weight", () => {
  const ladder = warmupLadder(30, 2.5, 20, true);
  assert.deepEqual(
    ladder.map((row) => row.kg),
    [20, 25],
  );
  assert.deepEqual(warmupLadder(0, 2.5, 20, false), []);
});

test("the ladder goes in as warm-up sets before the first working set", () => {
  const work = { ...newSet(), id: "w1", weight: 100, reps: 5 };
  const sets = warmupSets(
    [{ ...newSet(), id: "u0", section: "warmup" as const }, work],
    warmupLadder(100, 2.5, 20, true),
  );
  assert.deepEqual(
    sets.map((s) => [s.section, s.weight, s.reps]),
    [
      ["warmup", null, null],
      ["warmup", 20, 10],
      ["warmup", 40, 8],
      ["warmup", 60, 5],
      ["warmup", 80, 2],
      ["working", 100, 5],
    ],
  );
  assert.ok(sets.slice(1, 5).every((s) => !s.done && s.load === "weight"));
  assert.equal(new Set(sets.map((s) => s.id)).size, sets.length);
});
