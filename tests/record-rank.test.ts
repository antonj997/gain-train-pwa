import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, WorkoutSet } from "../src/data/model";
import {
  rankedKindsLabel,
  rankedRecords,
  recordBadgeText,
  recordBadges,
  recordKindShort,
  recordSetKinds,
  workoutRecords,
} from "../src/data/record-rank";
import { setCurrentLanguage } from "../src/i18n";

const ID = "builtin:bench-press";
const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
let order = 0;
const workout = (
  date: string,
  sets: WorkoutSet[],
  more: { exerciseId: string; sets: WorkoutSet[] }[] = [],
): RecordDoc => ({
  id: `w${++order}`,
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name: "Push",
    date,
    duration: null,
    startedAt: null,
    status: "completed",
    exercises: [
      { id: crypto.randomUUID(), exerciseId: ID, name: "Bench", sets },
      ...more.map((ex) => ({
        id: crypto.randomUUID(),
        exerciseId: ex.exerciseId,
        name: ex.exerciseId,
        sets: ex.sets,
      })),
    ],
  },
});

test("a first session holds no record", () => {
  assert.deepEqual(rankedRecords([workout("2026-11-01", [set()])]), []);
});

test("more weight is the heaviest record, ranked above the others it also beat", () => {
  const first = workout("2026-11-01", [set({ weight: 100, reps: 5 })]);
  const second = workout("2026-11-04", [
    set({ weight: 100, reps: 6 }),
    set({ weight: 102.5, reps: 5 }),
  ]);
  const [event] = rankedRecords([first, second]);
  assert.equal(event.workoutId, second.id);
  assert.deepEqual(event.kinds, ["heaviest", "reps", "e1rm"]);
  assert.equal(event.top, "heaviest");
  assert.equal(event.set.weight, 102.5);
});

test("a tie on weight is no heaviest record; more reps at that weight is a rep record", () => {
  const records = [
    workout("2026-11-01", [set({ weight: 100, reps: 5 })]),
    workout("2026-11-04", [set({ weight: 100, reps: 7 })]),
  ];
  const [event] = rankedRecords(records);
  assert.deepEqual(event.kinds, ["reps", "e1rm"]);
  assert.equal(event.top, "reps");
});

test("a rep record needs the same load before; a new weight with a better estimate is quieter", () => {
  const records = [
    workout("2026-11-01", [
      set({ weight: 80, reps: 5 }),
      set({ weight: 85, reps: 3 }),
    ]),
    // 82.5 × 5 has not been done before: e1RM only (96.25 > 93.5).
    workout("2026-11-04", [set({ weight: 82.5, reps: 5 })]),
  ];
  const events = rankedRecords(records);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].kinds, ["e1rm"]);
  const badge = recordBadges(events).get(records[1].id)!;
  assert.deepEqual(badge, { count: 1, top: "e1rm", quiet: true });
});

test("warm-ups never count; drops count for weight but not for reps or e1RM", () => {
  const base = workout("2026-11-01", [set({ weight: 100, reps: 5 })]);
  const warm = workout("2026-11-02", [
    set({ section: "warmup", weight: 120, reps: 10 }),
  ]);
  assert.deepEqual(rankedRecords([base, warm]), []);
  const dropped = workout("2026-11-03", [
    set({ weight: 90, reps: 5 }),
    set({ drop: true, weight: 105, reps: 1 }),
  ]);
  const [event] = rankedRecords([base, dropped]);
  assert.deepEqual(event.kinds, ["heaviest"]);
  // A drop with more reps at 100 kg is not a rep record.
  const dropReps = workout("2026-11-05", [
    set({ weight: 90, reps: 5 }),
    set({ drop: true, weight: 100, reps: 8 }),
  ]);
  assert.deepEqual(rankedRecords([base, dropReps]), []);
});

test("bodyweight reps and added weight count separately; no load, holds and assisted weight do not count as heaviest", () => {
  const bw = (reps: number) => set({ load: "bodyweight", weight: null, reps });
  const plus = (weight: number, reps = 5) =>
    set({ load: "bodyweight", extraWeight: true, weight, reps });
  const records = [
    workout("2026-11-01", [bw(10), plus(10)]),
    workout("2026-11-03", [bw(12), plus(12.5)]),
  ];
  const [event] = rankedRecords(records);
  assert.deepEqual(event.kinds, ["heaviest", "reps"]);
  assert.equal(event.set.weight, 12.5);
  // Holds and sets with no load hold no record.
  const none = (reps: number) => set({ load: "none", weight: null, reps });
  const hold = (seconds: number, weight = 16) =>
    set({ measure: "seconds", weight, reps: seconds });
  assert.deepEqual(
    rankedRecords([
      workout("2026-11-01", [none(10), hold(30)]),
      workout("2026-11-03", [none(20), hold(60, 24)]),
    ]),
    [],
  );
  // Assisted: more reps at the same help is a rep record; less help alone is nothing.
  const assisted = (weight: number, reps: number) =>
    set({ load: "assisted", weight, reps });
  const [rep] = rankedRecords([
    workout("2026-11-01", [assisted(20, 5)]),
    workout("2026-11-03", [assisted(20, 8), assisted(10, 3)]),
  ]);
  assert.deepEqual(rep.kinds, ["reps"]);
});

test("one record per exercise; the badge counts exercises and is loud when any is real", () => {
  const OHP = "builtin:overhead-press";
  const records = [
    workout(
      "2026-11-01",
      [set({ weight: 100 })],
      [{ exerciseId: OHP, sets: [set({ weight: 50, reps: 5 })] }],
    ),
    workout(
      "2026-11-04",
      [set({ weight: 105 })],
      [
        // 47.5 × 8: a better estimate only.
        { exerciseId: OHP, sets: [set({ weight: 47.5, reps: 8 })] },
      ],
    ),
  ];
  const events = workoutRecords(records, records[1].id);
  assert.deepEqual(
    events.map((e) => [e.exerciseId, e.top]),
    [
      [ID, "heaviest"],
      [OHP, "e1rm"],
    ],
  );
  assert.deepEqual(recordBadges(events).get(records[1].id), {
    count: 2,
    top: "heaviest",
    quiet: false,
  });
  const bySet = recordSetKinds(events);
  assert.deepEqual(bySet.get(events[0].set.id), ["heaviest", "e1rm"]);
  assert.equal(recordBadges(events).get(records[0].id), undefined);
});

test("a later record does not take an earlier one away", () => {
  const records = [
    workout("2026-11-01", [set({ weight: 100 })]),
    workout("2026-11-04", [set({ weight: 102.5 })]),
    workout("2026-11-08", [set({ weight: 105 })]),
  ];
  assert.deepEqual(
    rankedRecords(records).map((e) => e.workoutId),
    [records[1].id, records[2].id],
  );
});

test("record words in both languages", () => {
  setCurrentLanguage("en");
  assert.equal(recordBadgeText({ count: 2 }), "2 records");
  assert.equal(recordBadgeText({ count: 1 }), "1 record");
  assert.equal(recordKindShort("heaviest"), "Record");
  assert.equal(
    rankedKindsLabel(["heaviest", "reps"]),
    "Record: Heaviest weight · Rep record",
  );
  setCurrentLanguage("sv");
  assert.equal(recordBadgeText({ count: 2 }), "2 rekord");
  assert.equal(recordKindShort("reps"), "Reps");
  setCurrentLanguage("en");
});
