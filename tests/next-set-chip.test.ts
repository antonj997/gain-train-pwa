import test from "node:test";
import assert from "node:assert/strict";
import { topBarRootMargin } from "../src/components/workout/NextSetChip.tsx";

test("the next-set observer margin is always a length Safari accepts", () => {
  assert.equal(topBarRootMargin(64.2), "-65px 0px 0px 0px");
  assert.equal(topBarRootMargin(0), "0px");
  assert.equal(topBarRootMargin(-12), "0px");
  assert.equal(topBarRootMargin(Number.NaN), "0px");
  assert.equal(topBarRootMargin(Number.POSITIVE_INFINITY), "0px");
});
