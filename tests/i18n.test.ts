import test from "node:test";
import assert from "node:assert/strict";
import {
  hasUserData,
  interpolate,
  pluralForm,
  languageOnLaunch,
  translate,
} from "../src/i18n/index.ts";
import { en } from "../src/i18n/en.ts";
import { sv } from "../src/i18n/sv.ts";
import { HEADLINES, HEADLINES_SV, headlineFor } from "../src/lib/headlines.ts";
import { localizedDate, weekdayNames } from "../src/lib/dates.ts";
import { countLabel, durationLabel } from "../src/lib/labels.ts";

test("interpolation fills named parameters and leaves unknown ones", () => {
  assert.equal(interpolate("{a} of {b}", { a: 2, b: "5" }), "2 of 5");
  assert.equal(interpolate("{a} and {missing}", { a: 1 }), "1 and {missing}");
  assert.equal(interpolate("no params"), "no params");
});

test("plurals use one for exactly one and other for the rest", () => {
  assert.equal(pluralForm(1), "one");
  assert.equal(pluralForm(0), "other");
  assert.equal(pluralForm(2), "other");
  assert.equal(translate("en", "count.set", { count: 1 }), "1 set");
  assert.equal(translate("en", "count.set", { count: 3 }), "3 sets");
  assert.equal(translate("sv", "count.exercise", { count: 1 }), "1 övning");
  assert.equal(translate("sv", "count.exercise", { count: 4 }), "4 övningar");
});

test("Swedish has exactly the English keys, with the same kind of value", () => {
  assert.deepEqual(Object.keys(sv).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.equal(typeof sv[key], typeof en[key], key);
    if (typeof en[key] === "string")
      assert.deepEqual(
        [...(sv[key] as string).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
        [...(en[key] as string).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
        key,
      );
  }
});

test("the language prompt shows once, only for a device with a log", () => {
  assert.equal(languageOnLaunch(null, true), "prompt");
  // A new user keeps English, remembered, so a first workout never prompts.
  assert.equal(languageOnLaunch(null, false), "default");
  assert.equal(languageOnLaunch("en", true), "none");
  assert.equal(languageOnLaunch("sv", false), "none");
});

test("user data means a live record or a saved bodyweight", () => {
  assert.equal(hasUserData({}), false);
  assert.equal(hasUserData({}, { bodyWeightKg: null }), false);
  assert.equal(hasUserData({}, { bodyWeightKg: 80 }), true);
  assert.equal(hasUserData({ a: { kind: "workout", deleted: true } }), false);
  assert.equal(hasUserData({ a: { kind: "library", deleted: false } }), false);
  for (const kind of ["workout", "routine", "exercise"])
    assert.equal(hasUserData({ a: { kind, deleted: false } }), true, kind);
});

test("Swedish headlines follow the same rules and size as the English ones", () => {
  assert.equal(HEADLINES_SV.length, HEADLINES.length);
  assert.equal(new Set(HEADLINES_SV).size, HEADLINES_SV.length);
  for (const line of HEADLINES_SV) {
    assert.ok(line.length < 40, line);
    assert.ok(!line.includes("!"), line);
  }
  assert.ok(
    HEADLINES_SV.includes(headlineFor(new Date(2026, 9, 28), HEADLINES_SV)),
  );
});

test("dates and weekdays follow the chosen locale, Monday first", () => {
  assert.deepEqual(weekdayNames("narrow", "en-GB"), [
    "M",
    "T",
    "W",
    "T",
    "F",
    "S",
    "S",
  ]);
  assert.equal(weekdayNames("long", "sv-SE")[0], "måndag");
  assert.equal(weekdayNames("long", "en-GB")[6], "Sunday");
  assert.equal(
    localizedDate("2026-10-26", { day: "numeric", month: "long" }, "sv-SE"),
    "26 oktober",
  );
  assert.equal(
    localizedDate("2026-10-26", { day: "numeric", month: "short" }, "en-GB"),
    "26 Oct",
  );
});

test("labels default to English", () => {
  assert.equal(countLabel(2, "workout"), "2 workouts");
  assert.equal(durationLabel(113), "1 h 53 min");
});
