import test from "node:test";
import assert from "node:assert/strict";
import {
  filterExercises,
  groupExercises,
  exerciseSub,
  libraryExercises,
  type LibraryExercise,
} from "../src/lib/library.ts";

const item = (
  name: string,
  extra: Partial<LibraryExercise> = {},
): LibraryExercise => ({
  id: name,
  name,
  category: "Chest",
  custom: false,
  favourite: false,
  note: "",
  lastDate: null,
  best: null,
  ...extra,
});

const all = [
  item("Squat", { lastDate: "2026-10-20" }),
  item("Bench Press", { lastDate: "2026-10-28", best: "100 kg × 5" }),
  item("Arnold Press"),
  item("Cable Fly", { custom: true, lastDate: "2026-10-23" }),
  item("Dip", { lastDate: "2026-10-23" }),
  item("Row", { lastDate: "2026-10-01" }),
  item("Curl", { lastDate: "2026-09-01" }),
  item("my custom", { custom: true }),
];

test("filters search by name and the chosen chip", () => {
  assert.equal(filterExercises(all, "", "all").length, all.length);
  assert.deepEqual(
    filterExercises(all, " PRESS ", "all").map((e) => e.name),
    ["Arnold Press", "Bench Press"],
  );
  assert.deepEqual(
    filterExercises(all, "", "yours").map((e) => e.name),
    ["Cable Fly", "my custom"],
  );
  assert.equal(filterExercises(all, "", "recent").length, 6);
  assert.deepEqual(
    filterExercises(all, "cable", "recent").map((e) => e.name),
    ["Cable Fly"],
  );
  assert.deepEqual(filterExercises(all, "zzz", "all"), []);
});

test("groups the five most recently used, then the rest A to Z", () => {
  const [recent, rest] = groupExercises(all);
  assert.equal(recent.title, "Recently used");
  // Same-day ties fall back to the name.
  assert.deepEqual(
    recent.items.map((e) => e.name),
    ["Bench Press", "Cable Fly", "Dip", "Squat", "Row"],
  );
  assert.equal(rest.title, "A–Z");
  assert.deepEqual(
    rest.items.map((e) => e.name),
    ["Arnold Press", "Curl", "my custom"],
  );
});

test("empty groups are left out and the recent filter lists every used exercise", () => {
  assert.deepEqual(groupExercises([]), []);
  const unused = [item("B"), item("a")];
  const groups = groupExercises(unused);
  assert.deepEqual(
    groups.map((g) => g.title),
    ["A–Z"],
  );
  assert.deepEqual(
    groups[0].items.map((e) => e.name),
    ["a", "B"],
  );
  const recent = groupExercises(all, "recent");
  assert.equal(recent.length, 1);
  assert.equal(recent[0].items.length, 6);
  assert.equal(recent[0].items.at(-1)?.name, "Curl");
  assert.deepEqual(groupExercises(unused, "recent"), []);
});

test("the muted line lists category, last date and best set", () => {
  assert.equal(
    exerciseSub(all[1], "2026-10-28"),
    "Chest · last today · best 100 kg × 5",
  );
  assert.equal(exerciseSub(all[2], "2026-10-28"), "Chest · never logged");
});

test("the library lists the catalogue and own exercises with their flags", () => {
  const own = crypto.randomUUID();
  const records = {
    [own]: {
      id: own,
      kind: "exercise" as const,
      payload: { name: "Sled", category: "Legs", note: "", favourite: true },
      revision: 1,
      localVersion: 1,
      dirty: false,
      deleted: false,
    },
  };
  const all = libraryExercises(records, new Set(["builtin:bench-press"]));
  const bench = all.find((e) => e.id === "builtin:bench-press")!;
  assert.deepEqual([bench.hidden, bench.custom, bench.favourite], [true, false, false]);
  const sled = all.find((e) => e.id === own)!;
  assert.deepEqual([sled.custom, sled.favourite, sled.lastDate], [true, true, null]);
});
