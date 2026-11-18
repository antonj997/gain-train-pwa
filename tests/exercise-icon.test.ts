import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RecordDoc } from "../src/data/model.ts";
import { MUSCLES_BY_NAME } from "../src/data/exercise-muscles.ts";
import { categoryTone, exerciseIcon } from "../src/lib/exercise-icon.ts";
import * as useData from "../src/contexts/useData.ts";
import { loadComponent } from "./helpers/render";

const own = (id: string, payload: Record<string, unknown>): RecordDoc =>
  ({
    id,
    kind: "exercise",
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted: false,
    payload: { name: id, note: "", favourite: false, ...payload },
  }) as RecordDoc;

const records: Record<string, RecordDoc> = {
  plain: own("plain", { category: "Chest" }),
  kettle: own("kettle", { category: "Legs", icon: "kettlebell" }),
  newer: own("newer", { category: "Legs", icon: "sled" }),
  body: own("body", {
    category: "Back",
    icon: "body",
    muscles: { lats: 1, biceps: 0.5 },
  }),
  derived: own("derived", { category: "Arms", icon: "body" }),
  run: own("run", { category: "Cardio", icon: "body" }),
};

test("built-in exercises show their muscles, cardio the heart figure", () => {
  assert.deepEqual(exerciseIcon({}, "builtin:squat"), {
    kind: "muscles",
    muscles: MUSCLES_BY_NAME.Squat,
    cardio: false,
  });
  assert.deepEqual(exerciseIcon({}, "builtin:rowing-machine"), {
    kind: "muscles",
    muscles: {},
    cardio: true,
  });
  assert.equal(exerciseIcon({}, "builtin:treadmill").kind, "muscles");
});

test("own exercises show their equipment glyph, the dumbbell by default", () => {
  assert.deepEqual(exerciseIcon(records, "plain"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
  assert.deepEqual(exerciseIcon(records, "kettle"), {
    kind: "equipment",
    equipment: "kettlebell",
  });
  // A newer app's icon this version doesn't know.
  assert.deepEqual(exerciseIcon(records, "newer"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
});

test("an own exercise with the body icon shows its muscles", () => {
  assert.deepEqual(exerciseIcon(records, "body"), {
    kind: "muscles",
    muscles: { lats: 1, biceps: 0.5 },
    cardio: false,
  });
  // Nothing chosen: the muscles of its category.
  const derived = exerciseIcon(records, "derived");
  assert.equal(derived.kind, "muscles");
  assert.equal(derived.kind === "muscles" && derived.muscles.biceps, 1);
  assert.deepEqual(exerciseIcon(records, "run"), {
    kind: "muscles",
    muscles: {},
    cardio: true,
  });
});

test("shared and unknown exercises", () => {
  assert.deepEqual(exerciseIcon({}, "shared:abc", "Legs"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
  const unknown = exerciseIcon({}, "builtin:new-thing", "Legs");
  assert.equal(unknown.kind === "muscles" && unknown.muscles.quads, 1);
  assert.equal(
    exerciseIcon({}, "builtin:new-cardio", "Cardio").kind === "muscles",
    true,
  );
  assert.deepEqual(exerciseIcon({}, "builtin:new-thing", "Other"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
});

test("category tones", () => {
  assert.equal(categoryTone("Full body"), "full-body");
  assert.equal(categoryTone("Chest"), "chest");
  assert.equal(categoryTone("Other"), "other");
  assert.equal(categoryTone("Mobility"), "other");
  assert.equal(categoryTone(undefined), "other");
});

const ExerciseAvatar = await loadComponent(
  "@/components/items/ExerciseAvatar.tsx",
  { "@/contexts/useData": useData },
);

const avatar = (exerciseId: string, size?: 40 | 60) =>
  renderToStaticMarkup(
    createElement(
      useData.DataContext.Provider,
      { value: { state: { records } } as never },
      createElement(ExerciseAvatar, { exerciseId, size }),
    ),
  );

test("the avatar draws the muscle figure, the heart or the glyph", () => {
  const squat = avatar("builtin:squat");
  assert.match(squat, /class="ex-avatar"/);
  assert.match(squat, /data-tone="legs"/);
  assert.match(squat, /class="muscle-icon" width="32"/);
  assert.doesNotMatch(squat, /data-view="cardio"/);
  assert.match(avatar("builtin:squat", 60), /class="muscle-icon" width="50"/);
  assert.match(avatar("builtin:rowing-machine"), /data-view="cardio"/);
  const plain = avatar("plain");
  assert.match(plain, /data-tone="chest"/);
  assert.match(plain, /data-equipment="dumbbell"/);
  assert.match(plain, /width="22"/);
  assert.match(avatar("kettle", 60), /data-equipment="kettlebell"/);
  assert.match(avatar("body"), /data-tone="back"/);
  assert.match(avatar("body"), /class="muscle-icon"/);
});
