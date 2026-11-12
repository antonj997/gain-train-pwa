import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOSE_DISTANCE,
  closeDuration,
  dragIntent,
  holdsScroll,
  releaseSpeed,
  sheetOffset,
  sheetRelease,
} from "../src/lib/sheet-drag";
import { springValues } from "../src/lib/spring";

test("a press becomes a sheet drag only downward from the top or the handle", () => {
  const at = (dx: number, dy: number, fromTop: boolean, atTop: boolean) =>
    dragIntent({ dx, dy, fromTop, atTop });
  assert.equal(at(2, 3, false, true), "pending");
  // Content at its top: a pull down drags the sheet, a push up scrolls.
  assert.equal(at(0, 12, false, true), "drag");
  assert.equal(at(0, -12, false, true), "none");
  // A scrolled list scrolls back first.
  assert.equal(at(0, 12, false, false), "none");
  // The handle and the title drag at any scroll, up with a little give.
  assert.equal(at(0, 12, true, false), "drag");
  assert.equal(at(0, -12, true, false), "drag");
  // Sideways belongs to whatever is under the finger.
  assert.equal(at(14, 8, true, true), "none");
});

test("iOS is kept from scrolling only while the press may be a drag", () => {
  assert.equal(
    holdsScroll({ dx: 0, dy: 2, fromTop: false, atTop: true }),
    true,
  );
  assert.equal(
    holdsScroll({ dx: 0, dy: -2, fromTop: false, atTop: true }),
    false,
  );
  assert.equal(
    holdsScroll({ dx: 0, dy: 2, fromTop: false, atTop: false }),
    false,
  );
  assert.equal(
    holdsScroll({ dx: 4, dy: 2, fromTop: false, atTop: true }),
    false,
  );
  assert.equal(
    holdsScroll({ dx: 0, dy: -2, fromTop: true, atTop: false }),
    true,
  );
});

test("the sheet follows the finger 1:1 down and gives a little up", () => {
  assert.equal(sheetOffset(0), 0);
  assert.equal(sheetOffset(57), 57);
  assert.equal(sheetOffset(-20), -4);
  assert.equal(sheetOffset(-400), -24);
});

test("release speed comes from the last ~80ms", () => {
  assert.equal(releaseSpeed([{ y: 0, t: 0 }]), 0);
  const samples = [
    { y: 0, t: 0 },
    { y: 10, t: 100 },
    { y: 20, t: 150 },
    { y: 60, t: 200 },
  ];
  // From t=100 to t=200: 50px in 100ms.
  assert.equal(releaseSpeed(samples), 0.5);
});

test("let go: past 90px or a fling closes, else it springs back", () => {
  assert.equal(sheetRelease(CLOSE_DISTANCE - 1, 0.2), "back");
  assert.equal(sheetRelease(CLOSE_DISTANCE + 1, 0), "close");
  assert.equal(sheetRelease(10, 0.7), "close");
  // Pulled far but flicked back up: it stays.
  assert.equal(sheetRelease(200, -0.5), "back");
});

test("closing takes what is left of 240ms, faster after a fling, never under 120ms", () => {
  assert.equal(closeDuration(0, 600, 0), 240);
  assert.equal(closeDuration(300, 600, 0), 120);
  assert.equal(closeDuration(150, 600, 0), 180);
  // 450px left at 5 px/ms: 2 × 450 / 5 = 180ms.
  assert.equal(closeDuration(150, 600, 5), 180);
  assert.equal(closeDuration(590, 600, 0), 120);
});

test("a spring can start with the finger's speed", () => {
  const still = springValues(380, 34, 100, 0);
  const flung = springValues(380, 34, 100, 0, -2000);
  assert.ok(flung.values[0] < still.values[0]);
  assert.equal(flung.values[flung.values.length - 1], 0);
});
