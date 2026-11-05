import test from "node:test";
import assert from "node:assert/strict";
import { setCurrentLanguage } from "../src/i18n";
import {
  categoryGroups,
  favouriteGroups,
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
    filterExercises(all, "", "mine").map((e) => e.name),
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
  assert.deepEqual(
    [bench.hidden, bench.custom, bench.favourite],
    [true, false, false],
  );
  const sled = all.find((e) => e.id === own)!;
  assert.deepEqual(
    [sled.custom, sled.favourite, sled.lastDate],
    [true, true, null],
  );
});

test("favourites lead the unfiltered list, ahead of Recently used and A–Z", () => {
  const items = [
    item("Squat", { lastDate: "2026-10-20", favourite: true }),
    item("Bench Press", { lastDate: "2026-10-28" }),
    item("Arnold Press", { favourite: true }),
    item("Curl"),
  ];
  const groups = groupExercises(filterExercises(items, "", "all"));
  assert.deepEqual(
    groups.map((g) => [g.title, g.items.map((e) => e.name)]),
    [
      ["Favourites", ["Arnold Press", "Squat"]],
      ["Recently used", ["Bench Press"]],
      ["A–Z", ["Curl"]],
    ],
  );
});

test("a category lists its favourites, its own exercises, then those that also train it", () => {
  const items = [
    item("Squat", { category: "Legs", lastDate: "2026-10-20" }),
    item("Lunge", { category: "Legs", favourite: true }),
    item("Snatch", { category: "Full body", categories: ["Legs", "Back"] }),
    item("Trap Bar Deadlift", {
      category: "Back",
      categories: ["Legs"],
      favourite: true,
    }),
    item("Thruster", { category: "Full body", categories: ["Legs"] }),
    item("Leg Press", { category: "Legs" }),
    item("Bench Press"),
  ];
  const shown = filterExercises(items, "", "all", { category: "Legs" });
  const groups = groupExercises(shown, "all", false, "Legs");
  assert.deepEqual(
    groups.map((g) => [g.title, g.items.map((e) => e.name)]),
    [
      ["Favourites", ["Lunge"]],
      ["Legs", ["Leg Press", "Squat"]],
      ["Also trains Legs", ["Snatch", "Thruster", "Trap Bar Deadlift"]],
    ],
  );
  setCurrentLanguage("sv");
  assert.deepEqual(
    categoryGroups(shown, "Legs").map((g) => g.title),
    ["Favoriter", "Ben", "Tränar även Ben"],
  );
  setCurrentLanguage("en");
  // No favourites, no Favourites group.
  assert.deepEqual(
    categoryGroups(
      shown.map((e) => ({ ...e, favourite: false })),
      "Legs",
    ).map((g) => g.title),
    ["Legs", "Also trains Legs"],
  );
});

test("searching ranks favourites first among equally good matches", () => {
  const items = [
    item("Bench Press"),
    item("Incline Bench Press", { favourite: true }),
    item("Close-Grip Bench Press", { favourite: true }),
    item("Bench"),
  ];
  assert.deepEqual(
    filterExercises(items, "bench", "all").map((e) => e.name),
    ["Bench", "Bench Press", "Close-Grip Bench Press", "Incline Bench Press"],
  );
  assert.deepEqual(
    filterExercises(items, "press", "all").map((e) => e.name),
    ["Close-Grip Bench Press", "Incline Bench Press", "Bench Press"],
  );
  assert.deepEqual(
    favouriteGroups([item("B"), item("A")], []).map((g) => g.title),
    ["A–Z"],
  );
});
