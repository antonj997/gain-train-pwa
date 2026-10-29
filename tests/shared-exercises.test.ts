import test from "node:test";
import assert from "node:assert/strict";
import {
  fromSharedRow,
  toSharedInsert,
  visibleShared,
  type SharedRow,
} from "../src/lib/shared-exercises";
import { validate } from "../src/data/model";
import { filterExercises, type LibraryExercise } from "../src/lib/library";

const row = (over: Partial<SharedRow> = {}): SharedRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  owner: "other",
  name: "Sled Push",
  category: "Legs",
  equipment: "sled",
  aliases: ["prowler"],
  load: "weight",
  measure: null,
  ...over,
});

test("a custom exercise maps to a row insert", () => {
  const insert = toSharedInsert(
    validate("exercise", { name: " Curl ", category: "Arms", note: "x" }),
  );
  assert.deepEqual(insert, {
    name: "Curl",
    category: "Arms",
    equipment: null,
    aliases: [],
    load: null,
    measure: null,
  });
});

test("a row becomes a custom exercise that points back at it", () => {
  const copy = fromSharedRow(row());
  assert.equal(copy.sharedFrom, row().id);
  assert.equal(copy.sharedId, undefined);
  assert.equal(copy.equipment, "sled");
  assert.deepEqual(copy.aliases, ["prowler"]);
  assert.equal(copy.measure, undefined);
  assert.deepEqual(validate("exercise", copy), { ...copy });
});

test("the shared list leaves out own rows and ones already added", () => {
  const a = row({ id: "a" });
  const mine = row({ id: "b", owner: "me" });
  const added = row({ id: "c" });
  assert.deepEqual(visibleShared([a, mine, added], "me", new Set(["c"])), [a]);
});

test("search applies to shared rows", () => {
  const items: LibraryExercise[] = [
    row(),
    row({ id: "z", name: "Curl", aliases: [] }),
  ].map((r) => ({
    ...r,
    equipment: r.equipment ?? undefined,
    custom: false,
    favourite: false,
    note: "",
    lastDate: null,
    best: null,
  }));
  assert.deepEqual(
    filterExercises(items, "prowler", "all").map((i) => i.name),
    ["Sled Push"],
  );
});

test("sharedId and sharedFrom survive validation", () => {
  const ids = {
    sharedId: "22222222-2222-4222-8222-222222222222",
    sharedFrom: "33333333-3333-4333-8333-333333333333",
  };
  const out = validate("exercise", {
    name: "A",
    category: "Other",
    note: "",
    favourite: false,
    ...ids,
  });
  assert.equal(out.sharedId, ids.sharedId);
  assert.equal(out.sharedFrom, ids.sharedFrom);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), { ...out });
});
