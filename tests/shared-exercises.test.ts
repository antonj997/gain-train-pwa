import test from "node:test";
import assert from "node:assert/strict";
import {
  fromLegacyRow,
  fromSharedRow,
  sharedFieldsChanged,
  toSharedInsert,
  visibleShared,
  type SharedRow,
} from "../src/lib/shared-exercises";
import { validate } from "../src/data/model";
import { filterExercises, type LibraryExercise } from "../src/lib/library";

const row = (over: Partial<SharedRow> = {}): SharedRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  mine: false,
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
  const mine = row({ id: "b", mine: true });
  const added = row({ id: "c" });
  assert.deepEqual(visibleShared([a, mine, added], new Set(["c"])), [a]);
});

test("an older server's row says whether it is mine instead of whose it is", () => {
  const { mine: _mine, ...rest } = row();
  const legacy = { ...rest, owner: "me" };
  assert.equal(fromLegacyRow(legacy, "me").mine, true);
  assert.equal(fromLegacyRow(legacy, "you").mine, false);
  assert.equal("owner" in fromLegacyRow(legacy, "me"), false);
});

test("a shared row with oversized fields still adds as a valid exercise", () => {
  const copy = fromSharedRow(
    row({
      name: "  " + "N".repeat(120),
      aliases: ["a".repeat(5000), " ok ", "", ...Array(30).fill("x")],
      equipment: "e".repeat(80),
      measure: "m".repeat(40),
      load: "levitating" as SharedRow["load"],
    }),
  );
  assert.equal(copy.name.length, 100);
  assert.equal(copy.aliases?.[0], "ok");
  assert.equal(copy.aliases?.length, 20);
  assert.equal(copy.equipment?.length, 50);
  assert.equal(copy.measure?.length, 20);
  assert.equal(copy.load, undefined);
  assert.doesNotThrow(() => validate("exercise", copy));
});

test("only edits to the published fields need the shared copy updated", () => {
  const base = validate("exercise", {
    name: "Curl",
    category: "Arms",
    note: "",
  });
  assert.equal(sharedFieldsChanged(base, { ...base, note: "slow" }), false);
  assert.equal(sharedFieldsChanged(base, { ...base, name: "Curls" }), true);
  assert.equal(sharedFieldsChanged(base, { ...base, category: "Back" }), true);
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
