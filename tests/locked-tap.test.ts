import test from "node:test";
import assert from "node:assert/strict";
import { LOCKED_TAP_MS, lockedTap } from "../src/lib/locked-tap";

test("the first tap on a locked row is quiet", () => {
  const first = lockedTap(null, 1000);
  assert.deepEqual(first, { taps: { at: 1000, count: 1 }, warn: false });
});

test("a second tap within the window warns, and so do more", () => {
  const first = lockedTap(null, 1000);
  const second = lockedTap(first.taps, 1000 + LOCKED_TAP_MS);
  assert.equal(second.warn, true);
  assert.equal(second.taps?.count, 2);
  const third = lockedTap(second.taps, 1000 + LOCKED_TAP_MS + 500);
  assert.equal(third.warn, true);
});

test("a tap after the window starts over", () => {
  const first = lockedTap(null, 1000);
  const late = lockedTap(first.taps, 1000 + LOCKED_TAP_MS + 1);
  assert.deepEqual(late, {
    taps: { at: 1000 + LOCKED_TAP_MS + 1, count: 1 },
    warn: false,
  });
});

test("a clock that went back never counts as a second tap", () => {
  const first = lockedTap(null, 5000);
  assert.equal(lockedTap(first.taps, 4000).warn, false);
});
