import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as model from "../src/data/model";
import { setBadge } from "../src/data/drops";
import {
  libraryOf,
  libraryRecordId,
  mergeLibraries,
  savedCardioFields,
  withCardioFields,
} from "../src/data/exercises";
import { parseSharedSet, buildSharedPayload } from "../src/lib/shared-routines";
import { getSetIssues } from "../src/lib/workout-editor";
import { cardioFieldsOf, defaultCardioFields } from "../src/lib/cardio";
import { loadComponent } from "./helpers/render";

const cardio = (o: Partial<model.WorkoutSet> = {}): model.WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  load: "weight",
  measure: "cardio",
  section: "working",
  done: true,
  durationSec: 1200,
  ...o,
});
const workout = (sets: model.WorkoutSet[]): model.Workout => ({
  name: "Cardio",
  date: "2026-10-10",
  duration: 20,
  startedAt: null,
  status: "completed",
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "builtin:treadmill",
      name: "Treadmill",
      sets,
    },
  ],
});

test("incline and heart rate are optional set values with the server's limits", () => {
  const saved = model.validate(
    "workout",
    workout([cardio({ inclinePct: 6.5, heartRate: 142 })]),
  );
  assert.equal(saved.exercises[0].sets[0].inclinePct, 6.5);
  assert.equal(saved.exercises[0].sets[0].heartRate, 142);
  assert.ok(model.validSet(cardio({ inclinePct: null, heartRate: undefined })));
  assert.ok(!model.validSet(cardio({ inclinePct: 101 })));
  assert.ok(!model.validSet(cardio({ heartRate: 301 })));
  assert.throws(
    () => model.validate("workout", workout([cardio({ heartRate: 400 })])),
    model.RecordValidationError,
  );
  assert.ok(getSetIssues(cardio({ inclinePct: -1 })).inclinePct);
  assert.ok(getSetIssues(cardio({ heartRate: 500 })).heartRate);
  assert.equal(getSetIssues(cardio({ heartRate: 150 })).heartRate, undefined);
});

test("an older app's schema keeps the new set fields when it saves", () => {
  // keepUnknownFields carries over what a schema does not know.
  const original = workout([cardio({ inclinePct: 4, heartRate: 150 })]);
  const oldSchema = model.workoutSchema.extend({
    exercises: model.workoutSchema.shape.exercises.element
      .extend({
        sets: model.setSchema
          .omit({ inclinePct: true, heartRate: true })
          .array(),
      })
      .array(),
  });
  const parsed = oldSchema.parse(original);
  assert.equal("heartRate" in parsed.exercises[0].sets[0], false);
  const kept = model.keepUnknownFields(original, parsed);
  assert.equal(kept.exercises[0].sets[0].heartRate, 150);
  assert.equal(kept.exercises[0].sets[0].inclinePct, 4);
  assert.equal(model.SCHEMA_VERSION, 2);
});

test("the library saves each exercise's fields and keeps the rest", () => {
  const library: model.Library = { hiddenExerciseIds: ["builtin:squat"] };
  const next = withCardioFields(library, "builtin:exercise-bike", {
    fields: ["time", "distance", "heartRate"],
    distanceUnit: "m",
  });
  const saved = model.validate("library", next);
  assert.deepEqual(saved.hiddenExerciseIds, ["builtin:squat"]);
  assert.deepEqual(saved.cardioFields, {
    "builtin:exercise-bike": {
      fields: ["time", "distance", "heartRate"],
      distanceUnit: "m",
    },
  });
  // A newer app's field name is kept and skipped when read.
  const newer = model.validate("library", {
    hiddenExerciseIds: [],
    cardioFields: { "builtin:treadmill": { fields: ["time", "watts"] } },
  });
  assert.deepEqual(
    cardioFieldsOf(
      newer.cardioFields!["builtin:treadmill"],
      "builtin:treadmill",
    ),
    { fields: ["time"], distanceUnit: "km" },
  );
  assert.throws(
    () =>
      model.validate("library", {
        hiddenExerciseIds: [],
        cardioFields: { x: { fields: "time" } },
      }),
    model.RecordValidationError,
  );
});

test("merged libraries keep both sides' fields; the account's own wins", () => {
  const mine = withCardioFields(
    { hiddenExerciseIds: [] },
    "builtin:treadmill",
    defaultCardioFields("builtin:rowing-machine"),
  );
  const phone = withCardioFields(
    withCardioFields({ hiddenExerciseIds: [] }, "builtin:treadmill", {
      fields: ["time"],
      distanceUnit: "mi",
    }),
    "builtin:ski-erg",
    { fields: ["time", "calories"], distanceUnit: "km" },
  );
  const merged = mergeLibraries(mine, phone);
  assert.equal(merged.cardioFields!["builtin:treadmill"].distanceUnit, "m");
  assert.deepEqual(merged.cardioFields!["builtin:ski-erg"].fields, [
    "time",
    "calories",
  ]);
  const account = "acc";
  const record = (id: string, payload: model.Library): model.RecordDoc => ({
    id,
    kind: "library",
    payload,
    revision: 1,
    deleted: false,
    localVersion: 1,
    dirty: false,
  });
  const records = {
    [libraryRecordId(account)]: record(libraryRecordId(account), mine),
    other: record("other", phone),
  };
  assert.equal(
    (
      savedCardioFields(records, account)["builtin:treadmill"] as {
        distanceUnit: string;
      }
    ).distanceUnit,
    "m",
  );
  assert.ok(libraryOf(records, account).cardioFields!["builtin:ski-erg"]);
});

test("shared routines keep a cardio set's shape but not its incline or heart rate", () => {
  const routine: model.Routine = {
    name: "Hill walk",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:treadmill",
        name: "Treadmill",
        sets: [cardio({ done: false, inclinePct: 8, heartRate: 130 })],
      },
    ],
  };
  const payload = buildSharedPayload(routine, {});
  const shared = payload.exercises[0].sets[0];
  assert.equal(shared.measure, "cardio");
  assert.equal(shared.inclinePct, null);
  assert.equal(shared.heartRate, null);
  const back = parseSharedSet(
    { ...shared, inclinePct: 8, heartRate: 130 },
    crypto.randomUUID(),
  )!;
  assert.equal(back.measure, "cardio");
  assert.equal(back.inclinePct, null);
  assert.equal(back.heartRate, null);
});

async function cardioRow(fields: unknown, set: model.WorkoutSet) {
  const SetLine = await loadComponent("../src/components/workout/SetLine.tsx");
  return renderToStaticMarkup(
    createElement(SetLine, {
      set,
      name: "Exercise Bike",
      mode: "log",
      badge: setBadge([set], 0),
      marker: "none",
      canCheck: true,
      cardioFields: cardioFieldsOf(fields, "builtin:exercise-bike"),
      onOpenSheet: () => {},
      onChange: () => {},
    }),
  );
}

test("a cardio row shows only the chosen fields; hidden values stay in the set", async () => {
  const set = cardio({
    done: false,
    distanceM: 12500,
    calories: 250,
    heartRate: 142,
  });
  const html = await cardioRow(
    {
      fields: ["time", "distance", "level", "heartRate", "pace"],
      distanceUnit: "m",
    },
    set,
  );
  const labels = [
    ...html.matchAll(/aria-label="Exercise Bike set 1 ([^"]+)"/g),
  ].map((m) => m[1]);
  assert.deepEqual(labels, [
    "time",
    "distance in metres",
    "level",
    "average heart rate in beats per minute",
  ]);
  assert.doesNotMatch(html, /calories/);
  assert.match(html, /value="12500"/);
  // Pace: 20:00 over 12.5 km is 1:36 per km, shown, not typed.
  assert.match(html, /set-pace/);
  assert.match(html, />1:36</);
  // Time takes the number pad.
  assert.match(
    html,
    /aria-label="Exercise Bike set 1 time"[^>]*inputMode="numeric" pattern="\[0-9\]\*"/,
  );
  assert.match(html, /value="20:00"/);
});
