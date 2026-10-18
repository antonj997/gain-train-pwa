import test from "node:test";
import assert from "node:assert/strict";
import {
  beginSetReorder,
  setReorderTarget,
  finishSetReorder,
  bodyWeightForSet,
  toggleSetCompletion,
  createSetReorderController,
  pointerSetTarget,
  edgeScrollDelta,
} from "../src/lib/set-editing.ts";
import { newSet } from "../src/data/model.ts";

const sets = [
  { id: "a", weight: 20, reps: 8, done: true, section: "warmup" },
  { id: "b", weight: 40, reps: 5, done: false, section: "working" },
  { id: "c", weight: 10, reps: 12, done: true, section: "winddown" },
];

test("dropping a moved set preserves its identity and all entered data", () => {
  const grabbed = beginSetReorder(sets, "a");
  assert.ok(grabbed);
  const moved = setReorderTarget(grabbed, 2, sets.length);
  const result = finishSetReorder(sets, moved);
  assert.deepEqual(
    result.map((set) => set.id),
    ["b", "c", "a"],
  );
  assert.equal(result[2], sets[0]);
  assert.equal(result[0], sets[1]);
  assert.deepEqual(
    sets.map((set) => set.id),
    ["a", "b", "c"],
  );
});

test("moving a preview and cancelling never changes the saved order", () => {
  const grabbed = beginSetReorder(sets, "b");
  assert.ok(grabbed);
  const moved = setReorderTarget(grabbed, 0, sets.length);
  assert.equal(grabbed.targetIndex, 1);
  assert.equal(finishSetReorder(sets, moved, true), sets);
  assert.equal(finishSetReorder(sets, grabbed), sets);
});

test("keyboard and pointer targets stop at the first and last set", () => {
  const grabbed = beginSetReorder(sets, "b");
  assert.ok(grabbed);
  assert.equal(setReorderTarget(grabbed, -1, sets.length).targetIndex, 0);
  assert.equal(setReorderTarget(grabbed, 99, sets.length).targetIndex, 2);
  assert.equal(setReorderTarget(grabbed, Number.NaN, sets.length), grabbed);
  assert.deepEqual(
    finishSetReorder(sets, setReorderTarget(grabbed, -4, sets.length)).map(
      (set) => set.id,
    ),
    ["b", "a", "c"],
  );
});

test("a missing or removed grabbed set cannot move another set", () => {
  assert.equal(beginSetReorder(sets, "missing"), null);
  const grabbed = beginSetReorder(sets, "b");
  assert.ok(grabbed);
  const remaining = [sets[0], sets[2]];
  assert.equal(finishSetReorder(remaining, grabbed), remaining);
  assert.equal(finishSetReorder(sets, null), sets);
});

test("bodyweight completion captures profile kilograms without changing load analytics", () => {
  const set = {
    ...newSet(),
    load: "bodyweight" as const,
    weight: null,
    reps: 8,
  };
  const completed = toggleSetCompletion(set, 72.5);
  assert.equal(completed.done, true);
  assert.equal(completed.bodyWeightKg, 72.5);
  assert.equal(completed.weight, null);
  assert.equal(bodyWeightForSet(completed, 80), 72.5);
  assert.equal(bodyWeightForSet(set, 80), 80);
  assert.equal(toggleSetCompletion(set, null).done, true);
  assert.equal(toggleSetCompletion(set, null).bodyWeightKg, undefined);
});

test("legacy logged bodyweight stays unknown and unchecking clears its snapshot", () => {
  const legacy = {
    ...newSet(),
    load: "bodyweight" as const,
    reps: 10,
    done: true,
  };
  assert.equal(bodyWeightForSet(legacy, 80), null);
  const unchecked = toggleSetCompletion({ ...legacy, bodyWeightKg: 70 }, 80);
  assert.equal(unchecked.done, false);
  assert.equal(unchecked.bodyWeightKg, undefined);
  assert.equal(bodyWeightForSet(unchecked, 80), 80);
  const weighted = toggleSetCompletion(
    { ...newSet(), weight: 20, reps: 8 },
    80,
  );
  assert.equal(weighted.bodyWeightKg, undefined);
});

test("pointer previews emit no save and a matching pointer drop commits once", () => {
  const interaction = createSetReorderController();
  interaction.send(sets, { type: "pointer-start", id: "a", pointerId: 5 });
  const moved = interaction.send(sets, {
    type: "pointer-move",
    pointerId: 5,
    targetIndex: 2,
  });
  assert.equal(moved.commit, null);
  assert.equal(moved.order?.targetIndex, 2);
  assert.equal(
    interaction.send(sets, { type: "pointer-end", pointerId: 8 }).handled,
    false,
  );
  const dropped = interaction.send(sets, { type: "pointer-end", pointerId: 5 });
  assert.deepEqual(
    dropped.commit?.map((set) => set.id),
    ["b", "c", "a"],
  );
  assert.equal(dropped.order, null);
  assert.equal(
    interaction.send(sets, { type: "pointer-end", pointerId: 5 }).commit,
    null,
  );
});

test("pointer cancellation restores order and never emits a save", () => {
  const interaction = createSetReorderController();
  interaction.send(sets, { type: "pointer-start", id: "a", pointerId: 5 });
  interaction.send(sets, {
    type: "pointer-move",
    pointerId: 5,
    targetIndex: 2,
  });
  const cancelled = interaction.send(sets, {
    type: "pointer-cancel",
    pointerId: 5,
  });
  assert.equal(cancelled.commit, null);
  assert.equal(cancelled.order, null);
  assert.equal(cancelled.finished?.cancelled, true);
  assert.deepEqual(
    sets.map((set) => set.id),
    ["a", "b", "c"],
  );
});

test("keyboard grab and arrows wait for drop, and Escape cancels the next move", () => {
  const interaction = createSetReorderController();
  interaction.send(sets, { type: "key", id: "b", key: " " });
  const moved = interaction.send(sets, {
    type: "key",
    id: "b",
    key: "ArrowUp",
  });
  assert.equal(moved.commit, null);
  assert.equal(moved.order?.targetIndex, 0);
  assert.equal(
    interaction.send(sets, { type: "key", id: "b", key: "ArrowUp" }).order
      ?.targetIndex,
    0,
  );
  const dropped = interaction.send(sets, {
    type: "key",
    id: "b",
    key: "Enter",
  });
  assert.deepEqual(
    dropped.commit?.map((set) => set.id),
    ["b", "a", "c"],
  );
  interaction.send(sets, { type: "key", id: "a", key: "Enter" });
  interaction.send(sets, { type: "key", id: "a", key: "ArrowDown" });
  const cancelled = interaction.send(sets, {
    type: "key",
    id: "a",
    key: "Escape",
  });
  assert.equal(cancelled.commit, null);
  assert.equal(cancelled.order, null);
  assert.equal(cancelled.finished?.cancelled, true);
});

test("scrolling a dialog under a stationary pointer updates the insertion position", () => {
  const centers = [160, 240];
  assert.equal(pointerSetTarget(145, 5, 30, 30, centers), 0);
  assert.equal(pointerSetTarget(145, 5, 30, 70, centers), 1);
  assert.equal(pointerSetTarget(145, 5, 30, 150, centers), 2);
  // Body scrolling follows the same offset calculation as a dialog.
  assert.equal(pointerSetTarget(145, 5, 400, 520, centers), 2);
});

test("edge scrolling uses the container edges and stops at its scroll bounds", () => {
  assert.equal(edgeScrollDelta(200, 100, 300, 50, 400, 16), 0);
  assert.equal(edgeScrollDelta(300, 100, 300, 50, 400, 16), 8);
  assert.equal(edgeScrollDelta(100, 100, 300, 50, 400, 16), -8);
  assert.equal(edgeScrollDelta(300, 100, 300, 397, 400, 16), 3);
  assert.equal(edgeScrollDelta(100, 100, 300, 0, 400, 16), 0);
  assert.equal(edgeScrollDelta(300, 100, 300, 50, 400, 5000), 24);
});
