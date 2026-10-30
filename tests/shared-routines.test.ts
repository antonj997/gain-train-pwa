import test from "node:test";
import assert from "node:assert/strict";
import {
  SharedRoutineError,
  addedRoutineIds,
  buildSharedPayload,
  customKey,
  importSharedRoutine,
  parseSharedPayload,
  parseSharedSet,
  sharedRoutineChanged,
  sharedRoutineSummary,
  toSharedRoutineInsert,
  type SharedRoutineRow,
} from "../src/lib/shared-routines";
import { normalizeDisplayName, sharedByLine } from "../src/lib/display-name";
import {
  validate,
  type CustomExercise,
  type RecordDoc,
  type Routine,
  type WorkoutSet,
} from "../src/data/model";

const SLED = "22222222-2222-4222-8222-222222222222";
const SLED_SHARED = "33333333-3333-4333-8333-333333333333";
const ROW_ID = "44444444-4444-4444-8444-444444444444";

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: false,
  ...over,
});
const base = { revision: 1, deleted: false, localVersion: 1, dirty: false };
const exerciseRecord = (id: string, payload: CustomExercise): RecordDoc => ({
  ...base,
  id,
  kind: "exercise",
  payload,
});
const routineRecord = (id: string, payload: Routine): RecordDoc => ({
  ...base,
  id,
  kind: "routine",
  payload,
});
const sled: CustomExercise = {
  name: "Sled Push",
  category: "Legs",
  note: "Turf lane",
  favourite: true,
  equipment: "sled",
  aliases: ["prowler"],
  sharedId: SLED_SHARED,
};
const routine = (): Routine => ({
  name: " Leg day ",
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "builtin:squat",
      name: "Squat",
      sets: [
        set({ section: "warmup", weight: 60 }),
        set(),
        set({ drop: true, weight: 80 }),
      ],
    },
    {
      id: crypto.randomUUID(),
      exerciseId: SLED,
      name: "Sled Push",
      sets: [set({ reps: null, weight: null })],
    },
  ],
});
const sharerRecords = { [SLED]: exerciseRecord(SLED, sled) };
const row = (payload: unknown, over: Partial<SharedRoutineRow> = {}) => ({
  id: ROW_ID,
  name: "Leg day",
  note: null,
  payload,
  mine: false,
  by_name: "Anna",
  ...over,
});
let n = 0;
const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

test("a routine's payload references built-ins by id and embeds custom exercises", () => {
  const payload = buildSharedPayload(routine(), sharerRecords);
  assert.equal(payload.version, 1);
  assert.equal(payload.exercises[0].builtin, "builtin:squat");
  assert.equal(payload.exercises[0].custom, undefined);
  assert.deepEqual(payload.exercises[0].sets[0], {
    reps: 5,
    weight: 60,
    load: "weight",
    section: "warmup",
  });
  assert.equal(payload.exercises[0].sets[2].drop, true);
  assert.deepEqual(payload.exercises[1].custom, {
    name: "Sled Push",
    category: "Legs",
    equipment: "sled",
    aliases: ["prowler"],
    note: "Turf lane",
    sharedFrom: SLED_SHARED,
  });
  // No ids, done state or favourites travel.
  const text = JSON.stringify(payload);
  assert.equal(text.includes('"id"'), false);
  assert.equal(text.includes("done"), false);
  assert.equal(text.includes("favourite"), false);
});

test("a deleted custom exercise is shared under its routine name", () => {
  const payload = buildSharedPayload(routine(), {});
  assert.deepEqual(payload.exercises[1].custom, {
    name: "Sled Push",
    category: "Other",
  });
});

test("the insert trims the name and routines beyond the limits are refused", () => {
  assert.equal(toSharedRoutineInsert(routine(), sharerRecords).name, "Leg day");
  const big = routine();
  big.exercises = Array.from({ length: 41 }, () => ({
    ...big.exercises[0],
    id: crypto.randomUUID(),
  }));
  assert.throws(
    () => buildSharedPayload(big, {}),
    (e) => e instanceof SharedRoutineError && e.reason === "tooMany",
  );
  const heavy = routine();
  heavy.exercises = Array.from({ length: 40 }, () => ({
    ...heavy.exercises[0],
    id: crypto.randomUUID(),
    sets: Array.from({ length: 100 }, () => set()),
  }));
  assert.throws(
    () => buildSharedPayload(heavy, {}),
    (e) => e instanceof SharedRoutineError && e.reason === "tooBig",
  );
  assert.throws(
    () => buildSharedPayload({ name: "x", exercises: [] }, {}),
    (e) => e instanceof SharedRoutineError && e.reason === "empty",
  );
});

test("only changes the shared copy shows count as changes", () => {
  const before = routine();
  const same = { ...structuredClone(before), sharedId: ROW_ID };
  same.exercises[0].sets[0].id = crypto.randomUUID();
  assert.equal(sharedRoutineChanged(before, same, sharerRecords), false);
  const renamed = { ...before, name: "Legs" };
  assert.equal(sharedRoutineChanged(before, renamed, sharerRecords), true);
});

test("adding a shared routine makes a valid copy that points back at the row", () => {
  const payload = buildSharedPayload(routine(), sharerRecords);
  const copy = importSharedRoutine(row(payload), {}, ids)!;
  assert.equal(copy.routine.sharedFrom, ROW_ID);
  assert.equal(copy.routine.sharedId, undefined);
  assert.equal(copy.routine.name, "Leg day");
  assert.equal(copy.exercises.length, 1);
  const made = copy.exercises[0];
  assert.deepEqual(made.payload, {
    name: "Sled Push",
    category: "Legs",
    note: "Turf lane",
    favourite: false,
    sharedFrom: SLED_SHARED,
    equipment: "sled",
    aliases: ["prowler"],
  });
  assert.equal(copy.routine.exercises[1].exerciseId, made.id);
  assert.equal(copy.routine.exercises[0].exerciseId, "builtin:squat");
  assert.equal(copy.routine.exercises[0].sets.length, 3);
  assert.ok(copy.routine.exercises.every((e) => e.sets.every((s) => !s.done)));
  validate("routine", copy.routine);
  validate("exercise", made.payload);
});

test("adding reuses the user's matching exercise instead of duplicating it", () => {
  const payload = buildSharedPayload(routine(), sharerRecords);
  const mineId = "55555555-5555-4555-8555-555555555555";
  // Copied earlier from the same shared exercise, under another name.
  const bySource = importSharedRoutine(
    row(payload),
    {
      [mineId]: exerciseRecord(mineId, {
        name: "Prowler",
        category: "Legs",
        note: "",
        favourite: false,
        sharedFrom: SLED_SHARED,
      }),
    },
    ids,
  )!;
  assert.equal(bySource.exercises.length, 0);
  assert.equal(bySource.routine.exercises[1].exerciseId, mineId);
  // Same name and category, written differently.
  const byName = importSharedRoutine(
    row(payload),
    {
      [mineId]: exerciseRecord(mineId, {
        name: "  sled   PUSH ",
        category: "legs",
        note: "",
        favourite: false,
      }),
    },
    ids,
  )!;
  assert.equal(byName.exercises.length, 0);
  assert.equal(byName.routine.exercises[1].exerciseId, mineId);
  // A deleted one is not reused.
  const deleted = {
    ...exerciseRecord(mineId, { ...sled, sharedId: undefined }),
    deleted: true,
  };
  const fresh = importSharedRoutine(row(payload), { [mineId]: deleted }, ids)!;
  assert.equal(fresh.exercises.length, 1);
});

test("an exercise used twice in a shared routine is created once", () => {
  const payload = {
    exercises: [
      { name: "Sled", custom: { name: "Sled", category: "Legs" }, sets: [] },
      { name: "Sled", custom: { name: "sled", category: "Legs" }, sets: [] },
    ],
  };
  const copy = importSharedRoutine(row(payload), {}, ids)!;
  assert.equal(copy.exercises.length, 1);
  assert.equal(
    copy.routine.exercises[0].exerciseId,
    copy.routine.exercises[1].exerciseId,
  );
});

test("malformed payloads are cleaned up instead of failing the add", () => {
  const payload = {
    exercises: [
      "nope",
      { name: "No source", sets: [] },
      { name: "Bad id", builtin: "builtin:../../x", sets: [] },
      {
        name: "Curl",
        custom: {
          name: "C".repeat(150),
          category: "",
          note: "favourite:builtin:squat",
          aliases: ["ok", 3, ""],
          load: "levitating",
          sharedFrom: "not-a-uuid",
        },
        sets: [
          { reps: 8, weight: 20, load: "weight", section: "working" },
          { reps: -1, weight: 20, load: "weight", section: "working" },
          { reps: 30, weight: null, load: "weight", measure: "seconds" },
          { reps: 5, weight: 10, load: "weight", extraWeight: true },
          { reps: 5, weight: 0, load: "bodyweight", extraWeight: true },
          { measure: "cardio", reps: 5, weight: 5, durationSec: 600 },
          "x",
        ],
      },
    ],
  };
  const parsed = parseSharedPayload(payload);
  assert.equal(parsed.length, 1);
  const copy = importSharedRoutine(row(payload, { id: "nope" }), {}, ids)!;
  assert.equal(copy.routine.sharedFrom, undefined);
  const made = copy.exercises[0].payload;
  assert.equal(made.name.length, 100);
  assert.equal(made.category, "Other");
  assert.equal(made.note, "");
  assert.deepEqual(made.aliases, ["ok"]);
  assert.equal(made.load, undefined);
  assert.equal(made.sharedFrom, undefined);
  const sets = copy.routine.exercises[0].sets;
  assert.equal(sets.length, 5);
  assert.equal(sets[1].measure, "reps");
  assert.equal(sets[2].extraWeight, undefined);
  assert.equal(sets[3].weight, null);
  assert.equal(sets[4].reps, null);
  assert.equal(sets[4].weight, null);
  validate("routine", copy.routine);
  validate("exercise", made);
  assert.equal(importSharedRoutine(row({}), {}, ids), null);
  assert.equal(importSharedRoutine(row({ exercises: [1, 2] }), {}, ids), null);
  assert.equal(parseSharedSet(null, ids()), null);
});

test("the summary lists the exercises and added routines are known by row", () => {
  const payload = buildSharedPayload(routine(), sharerRecords);
  assert.deepEqual(sharedRoutineSummary(row(payload)), {
    count: 2,
    names: ["Squat", "Sled Push"],
  });
  const copy = importSharedRoutine(row(payload), {}, ids)!;
  const records = { r: routineRecord("r", copy.routine) };
  assert.deepEqual([...addedRoutineIds(records)], [ROW_ID]);
  assert.equal(addedRoutineIds({ r: { ...records.r, deleted: true } }).size, 0);
});

test("custom keys ignore case and spacing but not the category", () => {
  assert.equal(
    customKey(" Sled  Push", "Legs"),
    customKey("sled push", "legs"),
  );
  assert.notEqual(
    customKey("Sled Push", "Legs"),
    customKey("Sled Push", "Back"),
  );
});

test("display names are tidied, limited to 40 characters and may be cleared", () => {
  assert.equal(normalizeDisplayName("  Anna \n  Svensson "), "Anna Svensson");
  assert.equal(normalizeDisplayName("   "), null);
  assert.equal(normalizeDisplayName("Å".repeat(40)), "Å".repeat(40));
  assert.equal(normalizeDisplayName("😀".repeat(40)), "😀".repeat(40));
  assert.throws(() => normalizeDisplayName("x".repeat(41)));
  assert.equal(sharedByLine("Anna"), "by Anna");
  assert.equal(sharedByLine(null), "by someone");
  assert.equal(sharedByLine(" "), "by someone");
});
