import test from "node:test";
import assert from "node:assert/strict";
import { finishSummary } from "../src/lib/labels";

test("finish summary counts the unchecked sets it leaves out", () => {
  assert.equal(finishSummary(5, 1), "1 unchecked set left out");
  assert.equal(finishSummary(2, 3), "3 unchecked sets left out");
  // Every set checked: nothing to say, the Sets tile counts them.
  assert.equal(finishSummary(1, 0), "");
});

test("finish summary asks for one completed set first", () => {
  assert.equal(finishSummary(0, 2), "Complete at least one set");
  assert.equal(finishSummary(0, 0), "Complete at least one set");
});
