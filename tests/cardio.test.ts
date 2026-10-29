import test from "node:test";
import assert from "node:assert/strict";
import {
  type RecordDoc,
  type Workout,
  type WorkoutSet,
  RecordValidationError,
  SCHEMA_VERSION,
  isFromNewerApp,
  labelSet,
  newSet,
  validSet,
  validate,
} from "../src/data/model";
import {
  bestEvents,
  cardioProgressFor,
  progressFor,
} from "../src/data/analytics";
import { summarize } from "../src/data/summary";
import { catalogueById } from "../src/data/catalogue";
import { initialSet } from "../src/data/workouts";
import { getSetIssues } from "../src/lib/workout-editor";
import {
  cardioTotals,
  formatDuration,
  formatKm,
  parseDuration,
  parseKm,
} from "../src/lib/cardio";

const cardio = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  load: "weight",
  measure: "cardio",
  section: "working",
  done: true,
  durationSec: 1200,
  distanceM: 3200,
  ...overrides,
});
const lift = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
const workout = (sets: WorkoutSet[], cardioSets: WorkoutSet[]): Workout => ({
  name: "Mixed",
  date: "2026-10-10",
  duration: 60,
  startedAt: null,
  status: "completed",
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "builtin:bench-press",
      name: "Bench Press",
      sets,
    },
    {
      id: crypto.randomUUID(),
      exerciseId: "builtin:treadmill",
      name: "Treadmill",
      sets: cardioSets,
    },
  ],
});
const doc = (payload: Workout): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload,
});

test("time is typed as mm:ss, h:mm:ss or minutes and shown as mm:ss", () => {
  assert.equal(parseDuration("20:00"), 1200);
  assert.equal(parseDuration("0:45"), 45);
  assert.equal(parseDuration("1:05:00"), 3900);
  assert.equal(parseDuration("20"), 1200);
  assert.equal(parseDuration(" "), null);
  for (const unfinished of ["20:", "20:5", "20:75", "a", "1.5"])
    assert.ok(Number.isNaN(parseDuration(unfinished)), unfinished);
  assert.equal(formatDuration(1200), "20:00");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(3900), "1:05:00");
  assert.equal(formatDuration(null), "");
});

test("distance is typed in km with a dot or comma and stored in metres", () => {
  assert.equal(parseKm("3.2"), 3200);
  assert.equal(parseKm("3,25"), 3250);
  assert.equal(parseKm(""), null);
  assert.ok(Number.isNaN(parseKm("3.2.1")));
  assert.ok(Number.isNaN(parseKm("-1")));
  assert.equal(formatKm(3200), "3.2");
  assert.equal(formatKm(5000), "5");
});

test("a cardio set round-trips through validation and keeps its values", () => {
  const w = workout([lift()], [cardio({ level: 8, calories: 250 })]);
  const saved = validate("workout", w);
  assert.deepEqual(saved.exercises[1].sets[0], w.exercises[1].sets[0]);
});

test("cardio sets follow the server rules", () => {
  assert.ok(validSet(cardio()));
  assert.ok(validSet(cardio({ distanceM: null, level: null })));
  assert.ok(!validSet(cardio({ durationSec: null })));
  assert.ok(!validSet(cardio({ durationSec: 0 })));
  assert.ok(!validSet(cardio({ durationSec: 86401 })));
  assert.ok(!validSet(cardio({ reps: 5 })));
  assert.ok(!validSet(cardio({ weight: 10 })));
  assert.ok(!validSet(cardio({ distanceM: 1_000_001 })));
  assert.ok(!validSet(cardio({ level: 101 })));
  assert.ok(!validSet(cardio({ calories: 100_001 })));
  assert.throws(
    () => validate("workout", workout([lift()], [cardio({ durationSec: 0 })])),
    RecordValidationError,
  );
  assert.throws(
    () => validate("workout", workout([lift()], [cardio({ level: 101 })])),
    RecordValidationError,
  );
  assert.throws(
    () => validate("workout", workout([lift()], [cardio({ reps: 3 })])),
    RecordValidationError,
  );
  // An unchecked cardio set may be blank.
  assert.doesNotThrow(() =>
    validate(
      "workout",
      workout([lift()], [cardio({ done: false, durationSec: null })]),
    ),
  );
});

test("a new cardio set copies the measure but not the values", () => {
  const next = newSet(cardio({ level: 8, calories: 250 }));
  assert.equal(next.measure, "cardio");
  assert.equal(next.durationSec, undefined);
  assert.equal(next.distanceM, undefined);
  assert.equal(next.level, undefined);
  assert.equal(next.calories, undefined);
  assert.equal(next.reps, null);
  assert.equal(next.weight, null);
  assert.equal(next.done, false);
});

test("catalogue cardio machines and Cardio-category customs start with cardio sets", () => {
  for (const id of [
    "builtin:treadmill",
    "builtin:rowing-machine",
    "builtin:cross-trainer",
    "builtin:exercise-bike",
    "builtin:stair-climber",
    "builtin:ski-erg",
  ])
    assert.equal(catalogueById.get(id)?.measure, "cardio", id);
  assert.equal(initialSet("builtin:treadmill").measure, "cardio");
  assert.equal(
    initialSet("custom-id", { category: "Cardio" }).measure,
    "cardio",
  );
  assert.equal(
    initialSet("custom-id", { category: "Legs" }).measure,
    undefined,
  );
  assert.equal(initialSet("builtin:bench-press").measure, undefined);
});

test("issues follow the existing messages", () => {
  assert.deepEqual(getSetIssues(cardio({ done: false, durationSec: null })), {
    durationSec: "Enter a time to complete this set.",
  });
  assert.deepEqual(getSetIssues(cardio()), {});
  assert.equal(
    getSetIssues(cardio({ distanceM: 2_000_000 })).distanceM,
    "Enter a distance from 0 to 1,000 km.",
  );
  assert.equal(
    getSetIssues(cardio({ level: 150 })).level,
    "Enter a level from 0 to 100.",
  );
  const typing = {
    ...cardio(),
    inputText: { durationSec: "20:" },
  } as WorkoutSet;
  assert.ok(getSetIssues(typing).durationSec);
  assert.ok(!validSet(typing));
});

test("labels leave out empty parts", () => {
  assert.equal(
    labelSet(cardio({ level: 8, calories: 250 })),
    "20:00 · 3.2 km · L8 · 250 kcal",
  );
  assert.equal(labelSet(cardio()), "20:00 · 3.2 km");
  assert.equal(
    labelSet(cardio({ distanceM: null, calories: 120 })),
    "20:00 · 120 kcal",
  );
  assert.equal(labelSet(cardio({ distanceM: undefined })), "20:00");
});

test("cardio is not a strength best, new best or volume", () => {
  const records = [
    doc({
      ...workout([lift({ weight: 100, reps: 5 })], [cardio()]),
      date: "2026-10-01",
    }),
    doc({
      ...workout(
        [lift({ weight: 100, reps: 5 })],
        [cardio({ durationSec: 3000 })],
      ),
      date: "2026-10-08",
    }),
  ];
  const strength = progressFor(records);
  assert.deepEqual(
    strength.map((item) => item.id),
    ["builtin:bench-press"],
  );
  assert.deepEqual(
    bestEvents(progressFor(records)).filter(
      (event) => event.exerciseId === "builtin:treadmill",
    ),
    [],
  );
  const summary = summarize(
    records.map((r) => r.payload as Workout),
    30,
    "2026-10-10",
  );
  assert.equal(summary.volume, 1000);
  assert.equal(summary.workingSets, 2);
  assert.equal(summary.cardioSec, 4200);
  assert.equal(summary.cardioM, 6400);
});

test("cardio progress lists time and distance per session", () => {
  const records = [
    doc({
      ...workout(
        [lift()],
        [cardio(), cardio({ durationSec: 600, distanceM: 1000 })],
      ),
      date: "2026-10-01",
    }),
    doc({
      ...workout([lift()], [cardio({ calories: 200 })]),
      date: "2026-10-08",
    }),
  ];
  const [item] = cardioProgressFor(records);
  assert.equal(item.id, "builtin:treadmill");
  assert.deepEqual(
    item.sessions.map((s) => [s.date, s.durationSec, s.distanceM]),
    [
      ["2026-10-01", 1800, 4200],
      ["2026-10-08", 1200, 3200],
    ],
  );
  assert.deepEqual(cardioTotals([cardio({ calories: 5 }), cardio()]), {
    durationSec: 2400,
    distanceM: 6400,
    calories: 5,
  });
});

test("schema 2 records are newer than version 1, and version 1 records stay editable", () => {
  assert.equal(SCHEMA_VERSION, 2);
  assert.equal(isFromNewerApp({ schemaVersion: 1 }), false);
  assert.equal(isFromNewerApp({}), false);
  assert.equal(isFromNewerApp({ schemaVersion: 3 }), true);
});
