import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as model from "../src/data/model";
import { changeSection, normalizeDrops, setBadge } from "../src/data/drops";
import { initialSet } from "../src/data/workouts";
import {
  appendSet,
  finishWorkout,
  toggleGroupCompletion,
} from "../src/lib/workout-editor";
import { changeSetNumber } from "../src/lib/set-input";
import { parseDuration } from "../src/lib/cardio";
import { setCurrentLanguage } from "../src/i18n";
import { loadComponent } from "./helpers/render";

// The owner saw a cardio set's badge read "U" (warm-up) after checking it.
// Nothing in checking touches a set's section; these keep it that way.

const bikeSet = () => {
  let set = initialSet("builtin:exercise-bike");
  set = changeSetNumber(set, "durationSec", parseDuration("4:00"));
  set = changeSetNumber(set, "distanceM", 3200);
  return set;
};

test("a new Exercise Bike set is a working set numbered 1", () => {
  setCurrentLanguage("sv");
  const set = initialSet("builtin:exercise-bike");
  assert.equal(set.measure, "cardio");
  assert.equal(set.section, "working");
  assert.equal(setBadge([set], 0).text, "1");
  setCurrentLanguage("en");
});

test("checking a cardio set keeps it a working set, badge 1", () => {
  setCurrentLanguage("sv");
  const sets = [bikeSet()];
  const checked = toggleGroupCompletion(sets, sets[0].id, 85);
  assert.equal(checked[0].done, true);
  assert.equal(checked[0].section, "working");
  assert.equal(setBadge(checked, 0).text, "1");
  assert.equal(setBadge(checked, 0).tone, "working");
  // Unchecking and checking again, and saving, change nothing either.
  const again = toggleGroupCompletion(
    toggleGroupCompletion(checked, sets[0].id, 85),
    sets[0].id,
    85,
  );
  assert.equal(again[0].section, "working");
  assert.equal(normalizeDrops(again)[0].section, "working");
  setCurrentLanguage("en");
});

test("a checked cardio set saves and finishes as a working set", () => {
  const sets = toggleGroupCompletion([bikeSet()], "x", null);
  const set = { ...sets[0], done: true };
  const workout: model.Workout = {
    name: "Cardio",
    date: model.today(),
    duration: 20,
    startedAt: null,
    status: "draft",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:exercise-bike",
        name: "Exercise Bike",
        sets: [set],
      },
    ],
  };
  assert.equal(
    model.validate("workout", workout).exercises[0].sets[0].section,
    "working",
  );
  const finished = finishWorkout(workout);
  assert.equal(finished.exercises[0].sets[0].section, "working");
  // A set added after it is set 2, also a working set.
  const next = appendSet(finished.exercises[0]);
  assert.equal(next.sets[1].section, "working");
  assert.equal(setBadge(next.sets, 1).text, "2");
});

test("a checked set's type cannot change, so it cannot become a warm-up", () => {
  const [checked] = toggleGroupCompletion([bikeSet()], bikeSet().id, null);
  const sets = [{ ...checked, done: true }];
  assert.equal(changeSection(sets, sets[0].id, "warmup"), sets);
});

test("the checked cardio row renders badge 1, not U", async () => {
  setCurrentLanguage("sv");
  const SetLine = await loadComponent("../src/components/workout/SetLine.tsx");
  const [set] = toggleGroupCompletion([bikeSet()], bikeSet().id, null);
  const done = { ...set, done: true };
  const html = renderToStaticMarkup(
    createElement(SetLine, {
      set: done,
      name: "Exercise Bike",
      mode: "log",
      badge: setBadge([done], 0),
      marker: "none",
      canCheck: true,
      cardioFields: {
        fields: ["time", "distance", "level"],
        distanceUnit: "km",
      },
      onOpenSheet: () => {},
      onChange: () => {},
    }),
  );
  assert.match(html, /data-tone="working"/);
  assert.match(
    html,
    /<span class="set-badge-chip" aria-hidden="true">1<\/span>/,
  );
  assert.match(html, /value="4:00"/);
  // The loaded component reads its own (English) copy of the language.
  assert.match(html, /value="3\.2"/);
  setCurrentLanguage("en");
});
