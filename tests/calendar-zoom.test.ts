import test from "node:test";
import assert from "node:assert/strict";
import {
  flipTransform,
  insideRect,
  rowDelay,
  zoomPlan,
  type Rect,
} from "../src/lib/calendar-zoom";

const rect = (left: number, top: number, width = 12, height = 12): Rect => ({
  left,
  top,
  width,
  height,
});

test("a FLIP transform puts the month cell back on its square", () => {
  assert.equal(
    flipTransform(rect(300, 120), rect(40, 200, 48, 44)),
    "translate(260px, -80px) scale(0.25, 0.273)",
  );
  // The same box: no move, no scale.
  assert.equal(
    flipTransform(rect(10, 10, 20, 20), rect(10, 10, 20, 20)),
    "translate(0px, 0px) scale(1, 1)",
  );
  // A box with no size never divides by zero.
  assert.equal(
    flipTransform(rect(0, 0), rect(0, 0, 0, 0)),
    "translate(0px, 0px) scale(1, 1)",
  );
});

test("a square counts as visible only when it is wholly inside the grid's window", () => {
  const clip = rect(20, 0, 300, 120);
  assert.equal(insideRect(rect(20, 0), clip), true);
  assert.equal(insideRect(rect(308, 108), clip), true);
  assert.equal(insideRect(rect(15, 10), clip), false); // scrolled off to the left
  assert.equal(insideRect(rect(312, 10), clip), false); // past the right edge
  assert.equal(insideRect(rect(40, 10, 0, 0), clip), false); // not laid out
});

test("rows set off from the top as it opens and from the bottom as it closes", () => {
  assert.deepEqual(
    [0, 1, 5].map((w) => rowDelay(w, 6, true, 20)),
    [0, 20, 100],
  );
  assert.deepEqual(
    [0, 1, 5].map((w) => rowDelay(w, 6, false, 20)),
    [100, 80, 0],
  );
});

test("days with a visible square fly; future and hidden days fade", () => {
  const squares = new Map<string, Rect>([
    ["2026-11-02", rect(300, 20)],
    ["2026-11-03", rect(300, 35)],
    ["2026-10-26", rect(10, 20)], // scrolled out of sight
  ]);
  const cells = [
    { date: "2026-10-26", box: rect(16, 60, 44, 44) },
    { date: "2026-11-02", box: rect(16, 108, 44, 44) },
    { date: "2026-11-03", box: rect(64, 108, 44, 44) },
    { date: "2026-11-20", box: rect(208, 156, 44, 44) }, // in the future: no square
  ];
  const plan = zoomPlan(
    cells,
    squares,
    rect(20, 0, 320, 120),
    rect(0, 10, 360, 120),
  );
  assert.deepEqual(
    plan.flights.map((f) => f.date),
    ["2026-11-02", "2026-11-03"],
  );
  assert.deepEqual(plan.flights[1].from, rect(300, 35));
  assert.deepEqual(plan.flights[1].to, rect(64, 108, 44, 44));
  assert.deepEqual(plan.fades, ["2026-10-26", "2026-11-20"]);
  // The middle of the two squares (300–312 × 20–47), from the layer's corner.
  assert.deepEqual(plan.origin, { x: 306, y: 23.5 });
  assert.equal(
    zoomPlan(cells, new Map(), rect(0, 0, 1, 1), rect(0, 0, 1, 1)).origin,
    null,
  );
});
