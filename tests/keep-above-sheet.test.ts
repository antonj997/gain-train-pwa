import test from "node:test";
import assert from "node:assert/strict";
import { centreScrollDelta } from "../src/lib/keep-above-sheet";

test("centreScrollDelta scrolls a row below the visible area up to its middle", () => {
  // Visible area 70-470, middle 270; the row's centre is at 500.
  assert.equal(
    centreScrollDelta({
      visibleTop: 70,
      sheetTop: 470,
      rowTop: 478,
      rowHeight: 44,
    }),
    230,
  );
});

test("centreScrollDelta leaves a centred row alone", () => {
  assert.equal(
    centreScrollDelta({
      visibleTop: 70,
      sheetTop: 470,
      rowTop: 248,
      rowHeight: 44,
    }),
    0,
  );
});

test("centreScrollDelta scrolls back for a row above the visible area", () => {
  assert.ok(
    centreScrollDelta({
      visibleTop: 70,
      sheetTop: 470,
      rowTop: 10,
      rowHeight: 44,
    }) < 0,
  );
});
