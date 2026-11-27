import test from "node:test";
import assert from "node:assert/strict";
import type {
  Exercise,
  RecordDoc,
  Routine,
  Workout,
  WorkoutSet,
} from "../src/data/model";
import { validate } from "../src/data/model";
import { readFileSync } from "node:fs";
import {
  NEW_ROUTINE_SETS,
  addExercisesToRoutine,
  copyName,
  duplicateRoutine,
  folderCounts,
  matchFolder,
  namePieces,
  normalizeFolder,
  plannedSetsByCategory,
  routineFromWorkout,
  sortRoutines,
  tileIcons,
  withFolder,
} from "../src/lib/routine-library";
import {
  estimatedMinutes,
  lastResultText,
  previewSetsLine,
  repRangeLabel,
  routineLength,
} from "../src/lib/routine-preview";
import { setCurrentLanguage } from "../src/i18n";
import { setCurrentWeightUnit } from "../src/lib/units";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  load: "weight",
  section: "working",
  done: false,
  ...overrides,
});
const exercise = (
  exerciseId: string,
  sets: WorkoutSet[] = [set()],
  extra: Partial<Exercise> = {},
): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: exerciseId,
  sets,
  ...extra,
});
const categories: Record<string, string> = {
  bench: "Chest",
  fly: "Chest",
  row: "Back",
  curl: "Arms",
  squat: "Legs",
  plank: "Core",
};
const categoryOf = (id: string) => categories[id];

test("a tile shows the first exercise of each category, three at most, and counts the rest", () => {
  const four = ["bench", "fly", "row", "curl", "squat"].map((id) =>
    exercise(id),
  );
  const { icons, more } = tileIcons(four, categoryOf);
  assert.deepEqual(
    icons.map((i) => [i.exerciseId, i.category]),
    [
      ["bench", "Chest"],
      ["row", "Back"],
      ["curl", "Arms"],
    ],
  );
  assert.equal(more, 1);
  assert.deepEqual(tileIcons([exercise("mystery")], categoryOf).icons, [
    { exerciseId: "mystery", category: "Other" },
  ]);
  assert.deepEqual(tileIcons([], categoryOf), { icons: [], more: 0 });
});

test("a routine name may break after | and /, never inside a word", () => {
  assert.deepEqual(namePieces("Bröst|Axlar|Armar"), [
    "Bröst|",
    "Axlar|",
    "Armar",
  ]);
  assert.deepEqual(namePieces("Upper/Lower: Överkropp"), [
    "Upper/",
    "Lower: Överkropp",
  ]);
  assert.deepEqual(namePieces("Push day"), ["Push day"]);
  assert.equal(namePieces("a||b").join(""), "a||b");
});

const routine = (id: string, name: string, folder?: string) => ({
  id,
  payload: { name, exercises: [], ...(folder ? { folder } : {}) } as Routine,
});

test("Last done puts the newest first and the never done A–Ö after; A–Ö sorts by name", () => {
  const items = [
    routine("a", "Legs day"),
    routine("b", "pull day"),
    routine("c", "Arms"),
    routine("d", "Push day"),
  ];
  const lastDone = new Map([
    ["a", "2026-11-15"],
    ["d", "2026-11-16"],
  ]);
  assert.deepEqual(
    sortRoutines(items, lastDone, "recent").map((r) => r.id),
    ["d", "a", "c", "b"],
  );
  assert.deepEqual(
    sortRoutines(items, lastDone, "name").map((r) => r.id),
    ["c", "a", "b", "d"],
  );
  // Swedish puts Ö after Z.
  const sv = [routine("x", "Ölpass"), routine("y", "Zon")];
  assert.deepEqual(
    sortRoutines(sv, new Map(), "name", new Map(), "sv-SE").map((r) => r.id),
    ["y", "x"],
  );
});

test("a copy made this session sits right after its original in either order", () => {
  const items = [
    routine("orig", "Pull day"),
    routine("copy", "Pull day (kopia)"),
    routine("other", "Arms"),
    routine("copy2", "Zzz"),
  ];
  const lastDone = new Map([["orig", "2026-11-16"]]);
  const pins = new Map([
    ["copy", "orig"],
    ["copy2", "orig"],
  ]);
  // The newest copy goes first, right after the original.
  assert.deepEqual(
    sortRoutines(items, lastDone, "recent", pins).map((r) => r.id),
    ["orig", "copy2", "copy", "other"],
  );
  assert.deepEqual(
    sortRoutines(items, lastDone, "name", pins).map((r) => r.id),
    ["other", "orig", "copy2", "copy"],
  );
  // A pin whose original is gone changes nothing.
  assert.deepEqual(
    sortRoutines(items.slice(1), lastDone, "name", pins).map((r) => r.id),
    ["other", "copy", "copy2"],
  );
});

test("folders are names on routines: counted A–Ö, matched without case, set and cleared", () => {
  assert.equal(normalizeFolder("  Push   Pull  "), "Push Pull");
  assert.equal(normalizeFolder("   "), null);
  assert.equal(normalizeFolder("x".repeat(50))?.length, 40);
  assert.equal(matchFolder("push", ["Push", "Hemma"]), "Push");
  assert.equal(matchFolder(" Ben ", ["Push"]), "Ben");
  assert.equal(matchFolder("  ", ["Push"]), null);
  assert.deepEqual(
    folderCounts(
      [
        routine("a", "A", "Push").payload,
        routine("b", "B", "Hemma").payload,
        routine("c", "C", "Push").payload,
        routine("d", "D").payload,
      ].map((payload) => ({ payload })),
    ),
    [
      { name: "Hemma", count: 1 },
      { name: "Push", count: 2 },
    ],
  );
  const base: Routine = { name: "A", exercises: [] };
  assert.equal(withFolder(base, "Push").folder, "Push");
  assert.equal(
    "folder" in withFolder({ ...base, folder: "Push" }, null),
    false,
  );
  assert.equal("folder" in withFolder(base, "  "), false);
});

test("Duplicate copies the routine under a new name with new ids, unshared, in the same folder", () => {
  const original: Routine = {
    name: "Pull day",
    folder: "Push/Pull",
    sharedId: crypto.randomUUID(),
    sharedFrom: crypto.randomUUID(),
    exercises: [
      exercise("row", [set({ reps: 8, weight: 80, target: true }), set()], {
        repRange: { min: 8, max: 12 },
      }),
    ],
  };
  const copy = duplicateRoutine(original, copyName("Pull day", "(kopia)"));
  assert.equal(copy.name, "Pull day (kopia)");
  assert.equal(copy.folder, "Push/Pull");
  assert.equal(copy.sharedId, undefined);
  assert.equal(copy.sharedFrom, undefined);
  assert.notEqual(copy.exercises[0].id, original.exercises[0].id);
  assert.notEqual(
    copy.exercises[0].sets[0].id,
    original.exercises[0].sets[0].id,
  );
  assert.equal(copy.exercises[0].sets[0].weight, 80);
  assert.equal(copy.exercises[0].sets[0].target, true);
  assert.deepEqual(copy.exercises[0].repRange, { min: 8, max: 12 });
  // The original is untouched, and the copy is a valid routine.
  assert.equal(original.exercises[0].sets[0].weight, 80);
  assert.ok(original.sharedId);
  validate("routine", copy);
  // The name stays within 100 characters.
  assert.equal(copyName("x".repeat(100), "(kopia)").length, 100);
  assert.ok(copyName("x".repeat(100), "(copy)").endsWith(" (copy)"));
});

test("Save as a routine keeps exercises and set structure, never weights, reps or other values", () => {
  const workout: Pick<Workout, "name" | "exercises"> = {
    name: "Monday",
    exercises: [
      exercise("bench", [
        set({ section: "warmup", reps: 10, weight: 40, done: true }),
        set({ reps: 5, weight: 100, done: true, rir: 2 }),
        set({ reps: 4, weight: 80, done: true, drop: true }),
      ]),
      exercise("plank", [
        set({ measure: "seconds", load: "none", reps: 60, done: true }),
      ]),
      exercise("row", [
        set({
          load: "bodyweight",
          extraWeight: true,
          weight: 10,
          reps: 8,
          holdSec: 2,
          done: true,
        }),
      ]),
    ],
  };
  const routine = routineFromWorkout(workout);
  assert.equal(routine.name, "Monday");
  const sets = routine.exercises.flatMap((e) => e.sets);
  assert.equal(sets.length, 5);
  for (const s of sets) {
    assert.equal(s.reps, null);
    assert.equal(s.weight, null);
    assert.equal(s.done, false);
    assert.equal(s.rir, undefined);
    assert.equal(s.target, undefined);
  }
  assert.deepEqual(
    sets.map((s) => [s.section, s.load, s.drop ?? false, s.measure ?? "reps"]),
    [
      ["warmup", "weight", false, "reps"],
      ["working", "weight", false, "reps"],
      ["working", "weight", true, "reps"],
      ["working", "none", false, "seconds"],
      ["working", "bodyweight", false, "reps"],
    ],
  );
  // Reps + hold stays reps + hold, without the seconds.
  assert.equal(sets[4].holdSec, null);
  assert.equal(sets[4].extraWeight, true);
  const ids = new Set([
    ...workout.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)]),
  ]);
  for (const e of routine.exercises) {
    assert.ok(!ids.has(e.id));
    for (const s of e.sets) assert.ok(!ids.has(s.id));
  }
  validate("routine", routine);
});

test("the preview's bar counts working sets per main category, most first", () => {
  const sets = (n: number, extra: Partial<WorkoutSet> = {}) =>
    Array.from({ length: n }, () => set(extra));
  assert.deepEqual(
    plannedSetsByCategory(
      [
        exercise("curl", sets(2)),
        exercise("row", [...sets(1, { section: "warmup" }), ...sets(3)]),
        exercise("row", [...sets(3), set({ drop: true })]),
        exercise("mystery", sets(1)),
        exercise("bench", []),
      ],
      categoryOf,
    ),
    [
      { category: "Back", sets: 6 },
      { category: "Arms", sets: 2 },
      { category: "Other", sets: 1 },
    ],
  );
});

test("a routine never done gets a length from its sets: 3 min a working set, 2 per exercise", () => {
  const routine: Pick<Routine, "exercises"> = {
    exercises: [
      exercise("bench", [set({ section: "warmup" }), set(), set(), set()]),
      exercise("row", [set(), set(), set({ drop: true })]),
    ],
  };
  // 2 × 2 + 1.5 + 5 × 3 + 0.5 = 21 → 20.
  assert.equal(estimatedMinutes(routine), 20);
  assert.equal(estimatedMinutes({ exercises: [] }), null);
  assert.equal(estimatedMinutes({ exercises: [exercise("bench", [])] }), null);
  // Cardio: its planned time, else 10 minutes.
  assert.equal(
    estimatedMinutes({
      exercises: [
        exercise("run", [set({ measure: "cardio", durationSec: 1800 })]),
      ],
    }),
    30,
  );
  assert.equal(
    estimatedMinutes({
      exercises: [exercise("run", [set({ measure: "cardio" })])],
    }),
    10,
  );
  // Never under 5 minutes.
  assert.equal(estimatedMinutes({ exercises: [exercise("x", [set()])] }), 5);
});

test("a routine's length comes from its history first, else the estimate", () => {
  const id = crypto.randomUUID();
  const planned: Pick<Routine, "exercises"> = {
    exercises: [exercise("bench", [set(), set(), set()])],
  };
  const done = {
    id: crypto.randomUUID(),
    kind: "workout",
    deleted: false,
    payload: {
      name: "Push",
      date: "2026-11-01",
      duration: 52,
      startedAt: null,
      status: "completed",
      exercises: [],
      routineId: id,
    },
  } as unknown as RecordDoc;
  assert.deepEqual(routineLength(id, planned, [done]), {
    minutes: 50,
    estimated: false,
  });
  assert.deepEqual(routineLength(id, planned, []), {
    minutes: 10,
    estimated: true,
  });
});

test("the preview lists warm-ups and the rep range with the sets", () => {
  setCurrentLanguage("en");
  assert.equal(
    previewSetsLine(
      exercise("row", [set({ section: "warmup" }), set(), set(), set()], {
        repRange: { min: 8, max: 12 },
      }),
    ),
    "1 warm-up + 3 sets · 8–12 reps",
  );
  assert.equal(previewSetsLine(exercise("curl", [set(), set()])), "2 sets");
  assert.equal(previewSetsLine(exercise("curl", [])), "No sets");
  assert.equal(repRangeLabel({ min: 30, max: 45 }, true), "30–45 s");
  assert.equal(repRangeLabel({ min: 5, max: 5 }), "5 reps");
  setCurrentLanguage("sv");
  assert.equal(
    previewSetsLine(
      exercise("row", [set({ section: "warmup" }), set(), set(), set()]),
    ),
    "1 uppv. + 3 set",
  );
  setCurrentLanguage("en");
});

test("the preview's Förra is last time's first working set", () => {
  setCurrentLanguage("en");
  setCurrentWeightUnit("kg");
  const planned = exercise("row", [set({ section: "warmup" }), set(), set()]);
  const last = {
    date: "2026-11-16",
    sets: [
      set({ section: "warmup", reps: 10, weight: 40, done: true }),
      set({ reps: 8, weight: 70, done: true }),
      set({ reps: 7, weight: 70, done: true }),
    ],
  };
  assert.equal(lastResultText(planned, last), "70 × 8");
  assert.equal(lastResultText(planned, undefined), null);
  assert.equal(
    lastResultText(exercise("run", [set({ measure: "cardio" })]), last),
    null,
  );
});

// ---- v6 §E5: a new routine ----

test("v6: exercises added to a routine get three working sets", () => {
  assert.equal(NEW_ROUTINE_SETS, 3);
  const routine: Routine = { name: "", exercises: [] };
  const next = addExercisesToRoutine(routine, [
    { id: "builtin:bench-press", name: "Bench Press" },
    { id: "builtin:pull-up", name: "Pull Up" },
    { id: "own", name: "Mine", category: "Cardio" },
  ]);
  assert.equal(next.exercises.length, 3);
  for (const exercise of next.exercises) {
    assert.equal(exercise.sets.length, 3);
    for (const set of exercise.sets) {
      assert.equal(set.section, "working");
      assert.equal(set.weight, null);
      assert.equal(set.reps, null);
    }
  }
  assert.equal(next.exercises[1].sets[0].load, "bodyweight");
  assert.equal(next.exercises[2].sets[0].measure, "cardio");
  // New ids for every exercise and set.
  const ids = next.exercises.flatMap((e) => [e.id, ...e.sets.map((x) => x.id)]);
  assert.equal(new Set(ids).size, ids.length);
  // Added after what the routine had.
  const more = addExercisesToRoutine(next, [
    { id: "builtin:squat", name: "Squat" },
  ]);
  assert.equal(more.exercises[3].exerciseId, "builtin:squat");
});

test("v6: the routine editor focuses the name and keeps no draft buttons before a change", () => {
  const source = readFileSync(
    new URL("../src/components/library/RoutinesPanel.tsx", import.meta.url),
    "utf8",
  );
  // The name field has focus at once in a new routine.
  assert.match(source, /ref=\{nameInput\}\s+autoFocus=/);
  // No "Close and keep draft": closing the sheet keeps the draft.
  assert.doesNotMatch(source, /routines\.closeKeep/);
  // Discard waits for a change.
  assert.match(
    source,
    /\{changed && \(\s*<button\s+type="button"\s+className="text-button danger/,
  );
  assert.match(source, /routines\.closeSaves/);
  assert.match(source, /addExercisesToRoutine\(/);
});
