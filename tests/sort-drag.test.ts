import assert from "node:assert/strict";
import test from "node:test";
import {
  dropOffset,
  moveItem,
  slotPitch,
  slotShift,
} from "../src/lib/sort-drag";

// Four rows 60px tall with a 4px gap; the third is taller (80px).
const slots = { tops: [0, 64, 128, 212], heights: [60, 60, 80, 60] };

test("slotPitch is the held row's height plus the gap", () => {
  assert.equal(slotPitch(slots, 0), 64);
  assert.equal(slotPitch(slots, 2), 84);
  assert.equal(slotPitch({ tops: [0], heights: [50] }, 0), 50);
});

test("slotShift moves the rows between out of the way", () => {
  // Row 0 held over slot 2: rows 1 and 2 slide up, row 3 stays.
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => slotShift(i, 0, 2, 64)),
    [0, -64, -64, 0],
  );
  // Row 3 held over slot 1: rows 1 and 2 slide down.
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => slotShift(i, 3, 1, 64)),
    [0, 64, 64, 0],
  );
  // Held over its own slot: nothing moves.
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => slotShift(i, 1, 1, 64)),
    [0, 0, 0, 0],
  );
});

test("dropOffset lands the row exactly in its new slot", () => {
  assert.equal(dropOffset(slots, 1, 1), 0);
  // Up: to the target's top.
  assert.equal(dropOffset(slots, 3, 0), -212);
  assert.equal(dropOffset(slots, 3, 1), -148);
  // Down: its bottom meets the target's bottom (rows between slid up).
  assert.equal(dropOffset(slots, 0, 2), 148);
  assert.equal(dropOffset(slots, 0, 3), 212);
  // A short row passing a tall one lands one gap below where it slid to.
  const pitch = slotPitch(slots, 0);
  const landed = slots.tops[0] + dropOffset(slots, 0, 2);
  const tallBottom =
    slots.tops[2] + slotShift(2, 0, 2, pitch) + slots.heights[2];
  assert.equal(landed, tallBottom + 4);
});

test("moveItem moves one item and keeps the rest in order", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b"], 1, 1), ["a", "b"]);
  assert.deepEqual(moveItem(["a", "b"], 5, 0), ["a", "b"]);
});
