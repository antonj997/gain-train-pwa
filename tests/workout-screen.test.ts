import test from "node:test";
import assert from "node:assert/strict";
import { finishSummary } from "../src/lib/labels";

test("finish summary counts sets and unchecked sets", () => {
  assert.equal(
    finishSummary(5, 1),
    "5 sets will be saved · 1 unchecked set left out",
  );
  assert.equal(finishSummary(1, 0), "1 set will be saved");
  assert.equal(
    finishSummary(2, 3),
    "2 sets will be saved · 3 unchecked sets left out",
  );
});

test("finish summary asks for one completed set first", () => {
  assert.equal(finishSummary(0, 2), "Complete at least one set");
  assert.equal(finishSummary(0, 0), "Complete at least one set");
});
