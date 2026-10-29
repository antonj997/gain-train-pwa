import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  RecordValidationError,
  recordKinds,
  recordLabel,
  validate,
  type Goal,
  type Plan,
  type RecordDoc,
  type RemoteDoc,
} from "../src/data/model";
import { initialSet } from "../src/data/workouts";
import {
  favouriteChange,
  favouriteIds,
  hiddenIds,
  libraryRecordId,
  visibleExercises,
  withHidden,
} from "../src/data/exercises";
import { filterExercises, type LibraryExercise } from "../src/lib/library";
import { readAccount } from "../src/data/database";
import { syncAccount } from "../src/data/sync";

const week = () => [
  null,
  "rest",
  crypto.randomUUID(),
  null,
  null,
  "rest",
  null,
];
const plan = (): Plan => ({
  name: "Autumn block",
  startDate: "2026-11-02",
  endDate: "2027-01-31",
  cycleWeeks: 2,
  template: [week(), week()],
  overrides: { "2026-12-24": "rest", "2026-12-25": null },
  goalIds: [crypto.randomUUID()],
});
const goal = (): Goal => ({
  kind: "lift",
  targetKg: 110,
  reps: 1,
  exerciseId: "builtin:bench-press",
  exerciseName: "Bench Press",
  byDate: "2027-01-01",
  createdAt: 1_790_000_000_000,
});
const rejects = (kind: "plan" | "goal" | "library", payload: unknown) =>
  assert.throws(() => validate(kind as "plan", payload), RecordValidationError);

test("plan, goal and library records validate and round-trip", () => {
  for (const [kind, payload] of [
    ["plan", plan()],
    ["goal", goal()],
    [
      "goal",
      {
        kind: "bodyweight",
        targetKg: 80,
        byDate: "2027-01-01",
        createdAt: 1_790_000_000_000,
      },
    ],
    ["library", { hiddenExerciseIds: ["builtin:squat", crypto.randomUUID()] }],
  ] as const) {
    const saved = validate(kind as "plan", structuredClone(payload));
    const again = validate(kind as "plan", JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(again, saved);
  }
});

test("fields from a newer app version survive validation of the new kinds", () => {
  const saved = validate("library", {
    hiddenExerciseIds: [],
    pinned: ["x"],
  }) as { pinned?: string[] };
  assert.deepEqual(saved.pinned, ["x"]);
});

test("invalid plans, goals and library records are refused", () => {
  rejects("plan", { ...plan(), cycleWeeks: 7 });
  rejects("plan", { ...plan(), cycleWeeks: 3 });
  rejects("plan", { ...plan(), endDate: "2026-10-01" });
  rejects("plan", { ...plan(), startDate: "2026-02-31" });
  rejects("plan", { ...plan(), name: " " });
  rejects("plan", { ...plan(), template: [[null], [null]] });
  rejects("plan", { ...plan(), overrides: { tomorrow: "rest" } });
  rejects("plan", { ...plan(), goalIds: ["not-a-uuid"] });
  rejects("goal", { ...goal(), kind: "mile" });
  rejects("goal", { ...goal(), targetKg: 0 });
  rejects("goal", { ...goal(), exerciseId: undefined });
  rejects("goal", { ...goal(), byDate: "soon" });
  rejects("library", {});
  rejects("library", { hiddenExerciseIds: [""] });
  assert.throws(() => validate("chart" as "plan", {}), /Unknown record type/);
  assert.deepEqual([...recordKinds].sort(), [
    "exercise",
    "goal",
    "library",
    "plan",
    "routine",
    "workout",
  ]);
});

test("records without a name get a label for lists", () => {
  const doc = (kind: string, payload: object) =>
    ({ id: "x", kind, payload }) as unknown as RemoteDoc;
  assert.equal(recordLabel(doc("plan", { name: "Block" })), "Block");
  assert.equal(recordLabel(doc("goal", {})), "Goal");
  assert.equal(recordLabel(doc("library", {})), "Exercise settings");
});

test("the library record id is a stable uuid per account", () => {
  const a = libraryRecordId("6f1c3a52-1111-4222-8333-944455556666");
  assert.match(
    a,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(a, libraryRecordId("6f1c3a52-1111-4222-8333-944455556666"));
  assert.notEqual(a, libraryRecordId("6f1c3a52-1111-4222-8333-944455556667"));
  assert.match(libraryRecordId("phone"), /^[0-9a-f-]{36}$/);
});

const lib = (id: string, ids: string[], deleted = false) => ({
  id,
  kind: "library" as const,
  payload: { hiddenExerciseIds: ids },
  revision: 1,
  localVersion: 0,
  deleted,
  dirty: false,
});

test("hidden ids come from live library records and hiding is reversible", () => {
  const records = {
    a: lib("a", ["builtin:squat", "mine"]),
    b: lib("b", ["builtin:dip"], true),
  };
  assert.deepEqual([...hiddenIds(records)].sort(), ["builtin:squat", "mine"]);
  const hidden = hiddenIds(records);
  assert.deepEqual(withHidden(hidden, "builtin:plank", true).sort(), [
    "builtin:plank",
    "builtin:squat",
    "mine",
  ]);
  assert.deepEqual(withHidden(hidden, "mine", false), ["builtin:squat"]);
  assert.deepEqual(withHidden(hidden, "mine", true).sort(), [
    "builtin:squat",
    "mine",
  ]);
  const items = [{ id: "builtin:squat" }, { id: "mine" }, { id: "other" }];
  assert.deepEqual(visibleExercises(items, hidden), [{ id: "other" }]);
});

const row = (name: string, hidden = false): LibraryExercise => ({
  id: name,
  name,
  category: "Legs",
  equipment: "barbell",
  aliases: ["knäböj"],
  custom: false,
  favourite: false,
  note: "",
  lastDate: null,
  best: null,
  hidden,
});

test("hidden exercises show only under the Hidden filter", () => {
  const all = [row("Squat"), row("Lunge", true), row("Press")];
  assert.deepEqual(
    filterExercises(all, "", "all").map((e) => e.name),
    ["Lunge", "Press", "Squat"].filter((n) => n !== "Lunge"),
  );
  assert.deepEqual(
    filterExercises(all, "", "hidden").map((e) => e.name),
    ["Lunge"],
  );
  assert.deepEqual(filterExercises(all, "lunge", "all"), []);
  assert.deepEqual(
    filterExercises(all, "lunge", "hidden").map((e) => e.name),
    ["Lunge"],
  );
  assert.deepEqual(
    filterExercises(all, "knaboj", "all").map((e) => e.name),
    ["Press", "Squat"],
  );
  assert.deepEqual(filterExercises(all, "", "all", { equipment: "cable" }), []);
});

test("new record kinds sync, and a kind this version does not know is parked", async () => {
  const account = crypto.randomUUID();
  const future = crypto.randomUUID();
  const hiddenDoc: RemoteDoc = {
    id: libraryRecordId(account),
    kind: "library",
    payload: { hiddenExerciseIds: ["builtin:squat"] },
    revision: 1,
    deleted: false,
    change_seq: 1,
  };
  const futureDoc = {
    id: future,
    kind: "reminder",
    payload: { name: "Later" },
    revision: 1,
    deleted: false,
    change_seq: 2,
  } as unknown as RemoteDoc;
  await syncAccount(
    account,
    {
      push: async () => assert.fail("nothing to push"),
      pull: async (cursor) =>
        [hiddenDoc, futureDoc].filter((r) => r.change_seq > cursor),
    },
    () => {},
  );
  const state = await readAccount(account);
  assert.deepEqual([...hiddenIds(state.records)], ["builtin:squat"]);
  assert.equal(state.quarantine?.[future]?.revision, 1);
  assert.equal(state.cursor, 2);
});

test("starring a built-in exercise again reuses its marker instead of adding tombstones", () => {
  const records: Record<string, RecordDoc> = {};
  const bench = {
    id: "builtin:bench-press",
    name: "Bench Press",
    category: "Chest",
  };
  const apply = (change: ReturnType<typeof favouriteChange>) => {
    records[change.id] = {
      id: change.id,
      kind: "exercise",
      payload: change.payload,
      revision: 1,
      localVersion: 1,
      dirty: true,
      deleted: change.deleted,
    };
  };
  const star = favouriteChange(records, bench);
  assert.equal(star.deleted, false);
  apply(star);
  assert.equal(favouriteIds(records).has(bench.id), true);
  const unstar = favouriteChange(records, bench);
  assert.deepEqual([unstar.id, unstar.deleted], [star.id, true]);
  apply(unstar);
  assert.equal(favouriteIds(records).has(bench.id), false);
  // Starring again brings the same record back.
  assert.equal(favouriteChange(records, bench).id, star.id);
  assert.equal(Object.keys(records).length, 1);
});

test("a custom exercise's saved load and measure start its first set", () => {
  assert.equal(initialSet("custom", { load: "bodyweight" }).load, "bodyweight");
  const timed = initialSet("custom", { measure: "seconds", load: "weight" });
  assert.deepEqual([timed.measure, timed.load], ["seconds", "bodyweight"]);
  assert.equal(initialSet("custom", { measure: "cardio" }).measure, "cardio");
  assert.equal(initialSet("custom", { measure: "furlongs" }).load, "weight");
});
