import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, WorkoutSet } from "../src/data/model";
import { setCurrentLanguage } from "../src/i18n";
import {
  setKindLabel,
  sharedRoutinePreview,
  sharedSetsSummary,
} from "../src/lib/shared-routine-preview";
import type { SharedRoutineRow } from "../src/lib/shared-routines";

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  load: "weight",
  section: "working",
  done: false,
  ...over,
});

test("a shared exercise's sets read by structure: a headline and a line per type", () => {
  setCurrentLanguage("en");
  const sets = [
    set({ section: "warmup" }),
    set(),
    set(),
    set({ drop: true }),
    set({ load: "bodyweight", holdSec: null }),
    set({ section: "winddown", load: "bodyweight", measure: "seconds" }),
  ];
  assert.deepEqual(sharedSetsSummary(sets), {
    headline: "5 sets · 1 warm-up · 1 cool-down · 1 drop",
    lines: [
      "Warm-up · 1 set · Weight · reps",
      "Working · 2 sets · Weight · reps · 1 drop",
      "Working · 1 set · Bodyweight · reps + hold",
      "Cool-down · 1 set · Bodyweight · seconds",
    ],
  });
  assert.deepEqual(sharedSetsSummary([]), { headline: "No sets", lines: [] });
  assert.equal(setKindLabel(set({ measure: "cardio" })), "Cardio");
  assert.equal(
    setKindLabel(set({ load: "bodyweight", extraWeight: true })),
    "Bodyweight + weight · reps",
  );
  assert.equal(setKindLabel(set({ load: "assisted" })), "Assisted · reps");
});

test("the summary reads in Swedish", () => {
  setCurrentLanguage("sv");
  try {
    const { headline, lines } = sharedSetsSummary([
      set({ section: "warmup" }),
      set(),
      set(),
    ]);
    assert.equal(headline, "3 set · 1 uppvärmning");
    assert.deepEqual(lines, [
      "Uppvärmning · 1 set · Vikt · reps",
      "Arbetsset · 2 set · Vikt · reps",
    ]);
  } finally {
    setCurrentLanguage("en");
  }
});

test("the preview lists exercises in order, marks new custom ones and finds the categories", () => {
  setCurrentLanguage("en");
  const mine = "11111111-1111-4111-8111-111111111111";
  const records: Record<string, RecordDoc> = {
    [mine]: {
      id: mine,
      kind: "exercise",
      revision: 1,
      deleted: false,
      localVersion: 1,
      dirty: false,
      payload: {
        name: "sled push",
        category: "Legs",
        note: "",
        favourite: false,
      },
    },
  };
  const row: SharedRoutineRow = {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Legs",
    note: null,
    mine: false,
    payload: {
      version: 1,
      exercises: [
        {
          name: "Squat",
          builtin: "builtin:squat",
          // An old row with values: the preview shows none of them.
          sets: [
            { reps: 5, weight: 60, load: "weight", section: "warmup" },
            { reps: 5, weight: 120, load: "weight", section: "working" },
          ],
        },
        {
          name: "Sled Push",
          custom: { name: "Sled Push", category: "Legs" },
          sets: [{ load: "weight", section: "working" }],
        },
        {
          name: "Band Thing",
          custom: { name: "Band Thing", category: "Back" },
          sets: [{ load: "bodyweight", section: "working" }],
        },
      ],
    },
  };
  const preview = sharedRoutinePreview(row, records);
  assert.deepEqual(
    preview.exercises.map((e) => [e.name, e.isNew, e.headline]),
    [
      ["Squat", false, "2 sets · 1 warm-up"],
      ["Sled Push", false, "1 set"],
      ["Band Thing", true, "1 set"],
    ],
  );
  assert.equal(preview.sets, 4);
  assert.deepEqual(preview.categories, ["Legs", "Back"]);
  assert.ok(!JSON.stringify(preview).includes("120"));
});
