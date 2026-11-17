import test from "node:test";
import assert from "node:assert/strict";
import { orderChanged, reorderByIds } from "../src/lib/exercise-order";

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

test("orderChanged tells a new order from the same one", () => {
  assert.equal(orderChanged(["a", "b"], ["a", "b"]), false);
  assert.equal(orderChanged(["a", "b"], ["b", "a"]), true);
});
