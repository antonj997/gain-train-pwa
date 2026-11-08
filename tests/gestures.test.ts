import test from "node:test";
import assert from "node:assert/strict";
import {
  AXIS_SLOP,
  SNAP_PULL,
  bubbleScale,
  commitThreshold,
  decideAxis,
  displayOffset,
  isArmed,
  resistedOffset,
  rubberBand,
  settle,
  swipeProgress,
  type SwipeConfig,
} from "../src/lib/swipe";

const card: SwipeConfig = {
  right: { kind: "commit", threshold: 100, max: 200 },
  left: { kind: "reveal", threshold: 60, max: 160 },
};
const setRow: SwipeConfig = {
  left: { kind: "commit", threshold: 100, max: 220 },
};

test("a drag picks no axis until it has moved past the slop", () => {
  assert.equal(decideAxis(3, 2), "pending");
  assert.equal(decideAxis(AXIS_SLOP - 1, 0), "pending");
  assert.equal(decideAxis(AXIS_SLOP + 1, 0), "x");
  assert.equal(decideAxis(-20, 2), "x");
  assert.equal(decideAxis(0, -12), "y");
});

test("vertical scrolling wins every ambiguous drag", () => {
  // Diagonal, or only a little more sideways: a scroll.
  assert.equal(decideAxis(10, 10), "y");
  assert.equal(decideAxis(12, 10), "y");
  assert.equal(decideAxis(-12, -10), "y");
  // Clearly sideways: a swipe.
  assert.equal(decideAxis(14, 10), "x");
  assert.equal(decideAxis(-30, 8), "x");
});

test("the rubber band gives less for every px and never reaches its limit", () => {
  assert.equal(rubberBand(0, 100), 0);
  assert.equal(rubberBand(-5, 100), 0);
  const a = rubberBand(50, 100);
  const b = rubberBand(100, 100);
  const c = rubberBand(1000, 100);
  assert.ok(a > 0 && a < 50);
  assert.ok(b > a && b - a < a, "each further px moves less");
  assert.ok(c < 100);
});

test("the item follows the finger up to its free travel, then resists", () => {
  assert.equal(resistedOffset(80, card), 80);
  assert.equal(resistedOffset(-160, card), -160);
  const past = resistedOffset(-260, card);
  assert.ok(past < -160 && past > -260);
  assert.equal(resistedOffset(0, card), 0);
});

test("a side with no action only gives a little", () => {
  const right = resistedOffset(200, setRow);
  assert.ok(right > 0 && right < 36);
  assert.ok(resistedOffset(20, setRow) < 20);
});

test("arming has hysteresis so it does not flicker at the threshold", () => {
  assert.equal(isArmed(99, card), false);
  assert.equal(isArmed(100, card), true);
  assert.equal(isArmed(92, card, true), true);
  assert.equal(isArmed(86, card, true), false);
  assert.equal(isArmed(50, { left: null }), false);
});

test("armed, a commit side snaps a little past the threshold", () => {
  assert.equal(displayOffset(101, card, true), 100 + SNAP_PULL);
  assert.equal(displayOffset(-104, setRow, true), -(100 + SNAP_PULL));
  assert.equal(displayOffset(150, card, true), 150);
  assert.equal(displayOffset(90, card, false), 90);
  // A reveal side never jumps.
  assert.equal(displayOffset(-70, card, true), -70);
});

test("progress runs 0–1 towards the threshold", () => {
  assert.equal(swipeProgress(50, card), 0.5);
  assert.equal(swipeProgress(250, card), 1);
  assert.equal(swipeProgress(30, setRow), 0);
});

test("a commit side acts only on a release past its threshold", () => {
  assert.deepEqual(settle(120, 0, card), { action: "commit", side: "right" });
  assert.deepEqual(settle(90, 2, card), { action: "close" });
  assert.deepEqual(settle(-101, 0, setRow), { action: "commit", side: "left" });
  assert.deepEqual(settle(-40, -3, setRow), { action: "close" });
});

test("a reveal side opens past its threshold or on a flick out, and a flick back closes it", () => {
  assert.deepEqual(settle(-70, 0, card), {
    action: "open",
    side: "left",
    offset: -160,
  });
  assert.deepEqual(settle(-30, -0.8, card), {
    action: "open",
    side: "left",
    offset: -160,
  });
  assert.deepEqual(settle(-120, 0.8, card), { action: "close" });
  assert.deepEqual(settle(-30, 0, card), { action: "close" });
  assert.deepEqual(settle(0, 0, card), { action: "close" });
});

test("the commit threshold is about a third of the item, 72–110px", () => {
  assert.equal(commitThreshold(200), 72);
  assert.equal(commitThreshold(300), 90);
  assert.equal(commitThreshold(1000), 110);
});

test("the delete bubble grows to 0.82 while dragging and is full once armed", () => {
  assert.equal(bubbleScale(0, false), 0);
  assert.equal(bubbleScale(0.5, false), 0.41);
  assert.equal(bubbleScale(2, false), 0.82);
  assert.equal(bubbleScale(1, true), 1);
});
