import test from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "./helpers/render";
import { newSet, type WorkoutSet } from "../src/data/model";

type Sheet = {
  reorderGroups: (sets: WorkoutSet[], parentIds: string[]) => WorkoutSet[];
};

const set = (id: string, drop = false): WorkoutSet => ({
  ...newSet(),
  id,
  section: "working",
  ...(drop ? { drop: true } : {}),
});

test("reordering keeps drops with their set", async () => {
  const { reorderGroups } = await loadModule<Sheet>(
    "../src/components/workout/ReorderSetsSheet.tsx",
  );
  const sets = [set("A"), set("a1", true), set("B")];
  // Array.from: the module runs in its own realm, whose arrays differ for deepEqual.
  const ids = (parents: string[]) =>
    Array.from(reorderGroups(sets, parents), (s) => s.id);
  assert.deepEqual(ids(["B", "A"]), ["B", "A", "a1"]);
  assert.deepEqual(ids(["A", "B"]), ["A", "a1", "B"]);
});
