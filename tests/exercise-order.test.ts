import test from "node:test";
import assert from "node:assert/strict";
import { moveId, orderChanged, reorderByIds } from "../src/lib/exercise-order";

const items = ["a", "b", "c"].map((id) => ({ id }));

test("reorders by ids and keeps unnamed items after", () => {
  assert.deepEqual(
    reorderByIds(items, ["c", "a", "b"]).map((i) => i.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    reorderByIds(items, ["b", "x"]).map((i) => i.id),
    ["b", "a", "c"],
  );
});

test("moves one place and stops at the ends", () => {
  assert.deepEqual(moveId(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveId(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(moveId(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moveId(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.equal(orderChanged(["a", "b"], ["a", "b"]), false);
  assert.equal(orderChanged(["a", "b"], ["b", "a"]), true);
});
