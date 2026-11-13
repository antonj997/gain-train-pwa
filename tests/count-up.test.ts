import test from "node:test";
import assert from "node:assert/strict";
import { COUNT_UP_MS, countUpValue, easeOutCubic } from "../src/lib/count-up";

test("the ease-out starts at 0, ends at 1 and is ahead of linear", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
  assert.equal(easeOutCubic(-1), 0);
  assert.ok(easeOutCubic(0.5) > 0.5);
  assert.equal(easeOutCubic(0.5), 0.875);
});

test("a count up runs from 0 to the value in 500 ms and lands on it exactly", () => {
  assert.equal(COUNT_UP_MS, 500);
  assert.equal(countUpValue(12, 0), 0);
  assert.equal(countUpValue(12, 250), Math.round(12 * 0.875));
  assert.equal(countUpValue(12, 500), 12);
  assert.equal(countUpValue(12, 9999), 12);
  // Whole numbers unless asked for decimals.
  assert.ok(Number.isInteger(countUpValue(4210.5, 123)));
  assert.equal(countUpValue(4210.5, 500), 4210.5);
  assert.equal(countUpValue(2.5, 250, 500, 1), 2.2);
  // A slowed or empty duration.
  assert.equal(countUpValue(58, 2500, 5000), Math.round(58 * 0.875));
  assert.equal(countUpValue(58, 0, 0), 58);
});
