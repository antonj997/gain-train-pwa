import test from "node:test";
import assert from "node:assert/strict";
import { viewportMetrics } from "../src/lib/visual-viewport";

test("viewportMetrics: a visible area that fills the layout viewport needs no lift", () => {
  assert.deepEqual(
    viewportMetrics(844, { height: 844, offsetTop: 0, scale: 1 }, false),
    { height: 844, top: 0, bottom: 0, keyboardOpen: false },
  );
});

test("viewportMetrics: a visible area slid below the layout viewport pulls the bars down", () => {
  // iPhone, a field focused while the page scrolls: the screen shows 190 px
  // below the layout viewport, so a bar at bottom: 0 would float 190 px up.
  const m = viewportMetrics(
    844,
    { height: 844, offsetTop: 190, scale: 1 },
    true,
  );
  assert.equal(m.bottom, -190);
  assert.equal(m.top, 190);
  assert.equal(m.keyboardOpen, false);
});

test("viewportMetrics: a keyboard lifts the bottom edge and reads as open while a field is edited", () => {
  const m = viewportMetrics(
    844,
    { height: 508, offsetTop: 40, scale: 1 },
    true,
  );
  assert.equal(m.bottom, 296);
  assert.equal(m.height, 508);
  assert.equal(m.keyboardOpen, true);
  assert.equal(
    viewportMetrics(844, { height: 508, offsetTop: 40, scale: 1 }, false)
      .keyboardOpen,
    false,
  );
});

test("viewportMetrics: a short bar under the visible area is not a keyboard", () => {
  const m = viewportMetrics(844, { height: 790, offsetTop: 0, scale: 1 }, true);
  assert.equal(m.bottom, 54);
  assert.equal(m.keyboardOpen, false);
});

test("viewportMetrics: pinch-zoom leaves the bars to the browser", () => {
  assert.deepEqual(
    viewportMetrics(844, { height: 400, offsetTop: 300, scale: 2 }, true),
    { height: 844, top: 0, bottom: 0, keyboardOpen: false },
  );
});

test("viewportMetrics: without visualViewport the layout viewport is the screen", () => {
  assert.deepEqual(viewportMetrics(700, null, true), {
    height: 700,
    top: 0,
    bottom: 0,
    keyboardOpen: false,
  });
});

test("viewportMetrics: subpixel offsets round to whole pixels", () => {
  assert.equal(
    viewportMetrics(844, { height: 843.6, offsetTop: 0.2, scale: 1 }, false)
      .bottom,
    0,
  );
});
