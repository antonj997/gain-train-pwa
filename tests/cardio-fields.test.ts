import test from "node:test";
import assert from "node:assert/strict";
import {
  CARDIO_METRICS,
  cardioFieldsOf,
  cardioGridColumns,
  cardioLabel,
  cardioTotals,
  defaultCardioFields,
  digitsToSeconds,
  distanceLabel,
  formatDistance,
  formatDuration,
  formatPace,
  formatTimerDigits,
  metresIn,
  paceSeconds,
  parseDistance,
  parseDuration,
  secondsToDigits,
  timerDigits,
  timerEntry,
  totalsLabel,
  withMetric,
} from "../src/lib/cardio";
import { setCurrentLanguage } from "../src/i18n";
import type { WorkoutSet } from "../src/data/model";

/** What the field shows after typing `keys` into an empty field, one at a time. */
function typeInto(keys: string, start = "") {
  let shown = start;
  for (const key of keys) {
    const next = key === "\b" ? shown.slice(0, -1) : shown + key;
    shown = timerEntry(next, shown) ?? shown;
  }
  return shown;
}

test("timer digits fill from the right: the owner's 0400 is 4:00, not 400 minutes", () => {
  assert.equal(digitsToSeconds("0400"), 240);
  assert.equal(parseDuration(typeInto("0400")), 240);
  assert.equal(typeInto("0400"), "4:00");
  // Before, a bare number was minutes: "0400" became 400 minutes, 6:40:00.
  assert.notEqual(parseDuration("0400"), 400 * 60);
});

test("each typed digit shifts in and the colons come by themselves", () => {
  const cases: [string, string, number][] = [
    ["4", "0:04", 4],
    ["40", "0:40", 40],
    ["400", "4:00", 240],
    ["0400", "4:00", 240],
    ["4500", "45:00", 2700],
    ["13000", "1:30:00", 5400],
    ["2000", "20:00", 1200],
    ["123456", "12:34:56", 45296],
  ];
  for (const [keys, shown, seconds] of cases) {
    assert.equal(typeInto(keys), shown, keys);
    assert.equal(parseDuration(typeInto(keys)), seconds, keys);
  }
});

test("a lone zero shows 0:00 but is no time yet", () => {
  assert.equal(typeInto("0"), "0:00");
  assert.equal(parseDuration("0:00"), null);
  assert.equal(typeInto("00"), "0:00");
});

test("backspace removes the last digit", () => {
  assert.equal(typeInto("4500\b"), "4:50");
  assert.equal(typeInto("4500\b\b"), "0:45");
  assert.equal(typeInto("4\b"), "");
  assert.equal(typeInto("13000\b"), "13:00");
});

test("up to six digits mean h:mm:ss; a seventh is refused", () => {
  assert.equal(typeInto("1234567"), "12:34:56");
  assert.equal(timerEntry("12:34:567", "12:34:56"), null);
  assert.equal(timerDigits("0:04:00"), "400");
  assert.ok(Number.isNaN(digitsToSeconds("1234567")));
});

test("seconds or minutes of 60 and more roll over once the field is left", () => {
  assert.equal(typeInto("90"), "0:90");
  assert.equal(formatDuration(parseDuration("0:90")), "1:30");
  assert.equal(formatDuration(parseDuration(typeInto("9000"))), "1:30:00");
  assert.equal(formatDuration(parseDuration(typeInto("199"))), "2:39");
});

test("pasting a written time works, padded or not", () => {
  assert.equal(timerEntry("4:00", ""), "4:00");
  assert.equal(timerEntry("04:00", ""), "4:00");
  assert.equal(timerEntry("1:30:00", ""), "1:30:00");
  assert.equal(timerEntry("4:5", ""), "4:05");
  assert.equal(timerEntry("90:00", ""), "1:30:00");
  assert.equal(parseDuration(timerEntry("04:00", "")!), 240);
  // Pasted over a selected value, the paste wins.
  assert.equal(timerEntry("45:00", "4:00"), "45:00");
  assert.equal(timerEntry("abc", ""), null);
  assert.equal(timerEntry("", "4:00"), "");
});

test("timer digits round-trip through seconds", () => {
  assert.equal(secondsToDigits(240), "400");
  assert.equal(secondsToDigits(5400), "13000");
  assert.equal(formatTimerDigits(""), "");
  assert.equal(formatTimerDigits("", true), "0:00");
  assert.equal(formatTimerDigits("5"), "0:05");
  for (const seconds of [1, 59, 60, 61, 599, 3600, 45296, 86400])
    assert.equal(digitsToSeconds(secondsToDigits(seconds)), seconds);
});

test("each catalogue machine starts with its own fields", () => {
  const fields = (id: string) => defaultCardioFields(id).fields.join(",");
  const unit = (id: string) => defaultCardioFields(id).distanceUnit;
  assert.equal(fields("builtin:treadmill"), "time,distance,incline");
  assert.equal(fields("builtin:exercise-bike"), "time,distance,level");
  assert.equal(fields("builtin:cross-trainer"), "time,distance,level");
  assert.equal(fields("builtin:rowing-machine"), "time,distance");
  assert.equal(unit("builtin:rowing-machine"), "m");
  assert.equal(fields("builtin:ski-erg"), "time,distance");
  assert.equal(unit("builtin:ski-erg"), "m");
  assert.equal(fields("builtin:stair-climber"), "time,level,calories");
  assert.equal(fields("builtin:assault-bike"), "time,distance,calories");
  assert.equal(
    fields("7a1d2c3e-0000-4000-8000-0000000000c1"),
    "time,distance,calories",
  );
  assert.equal(unit("builtin:treadmill"), "km");
});

test("saved fields are read leniently, in column order, always with time", () => {
  const bike = "builtin:exercise-bike";
  assert.deepEqual(
    cardioFieldsOf(
      { fields: ["heartRate", "distance"], distanceUnit: "m" },
      bike,
    ),
    { fields: ["time", "distance", "heartRate"], distanceUnit: "m" },
  );
  // A newer app's field is skipped; a bad unit keeps the default.
  assert.deepEqual(
    cardioFieldsOf({ fields: ["watts", "level"], distanceUnit: "yd" }, bike),
    { fields: ["time", "level"], distanceUnit: "km" },
  );
  assert.deepEqual(cardioFieldsOf(undefined, bike), defaultCardioFields(bike));
  assert.deepEqual(cardioFieldsOf("junk", bike), defaultCardioFields(bike));
  assert.equal(CARDIO_METRICS[0], "time");
});

test("turning fields on and off keeps time, and pace goes with distance", () => {
  const bike = defaultCardioFields("builtin:exercise-bike");
  const noTime = withMetric(bike, "time", false);
  assert.deepEqual(noTime.fields, bike.fields);
  const hr = withMetric(withMetric(bike, "calories", false), "heartRate", true);
  assert.deepEqual(hr.fields, ["time", "distance", "level", "heartRate"]);
  const pace = withMetric(
    defaultCardioFields("builtin:stair-climber"),
    "pace",
    true,
  );
  assert.deepEqual(pace.fields, [
    "time",
    "distance",
    "pace",
    "level",
    "calories",
  ]);
  assert.deepEqual(withMetric(pace, "distance", false).fields, [
    "time",
    "level",
    "calories",
  ]);
});

test("distance is stored in metres whatever unit it is typed in", () => {
  setCurrentLanguage("en");
  assert.equal(parseDistance("3.2", "km"), 3200);
  assert.equal(parseDistance("3,2", "km"), 3200);
  assert.equal(parseDistance("2000", "m"), 2000);
  assert.equal(parseDistance("1", "mi"), 1609);
  assert.equal(parseDistance("2.5", "mi"), 4023);
  assert.equal(parseDistance("", "mi"), null);
  assert.ok(Number.isNaN(parseDistance("-1", "m")));
  assert.equal(formatDistance(3200, "km"), "3.2");
  assert.equal(formatDistance(3200, "m"), "3200");
  assert.equal(formatDistance(3200, "mi"), "1.99");
  assert.equal(formatDistance(parseDistance("2", "mi"), "mi"), "2");
  assert.equal(metresIn(1609, "mi"), 1);
  assert.equal(distanceLabel(2000, "m"), "2000 m");
  setCurrentLanguage("sv");
  assert.equal(formatDistance(3200, "km"), "3,2");
  setCurrentLanguage("en");
});

test("pace is time over distance, per km or per mile", () => {
  assert.equal(paceSeconds(1200, 4000, "km"), 300);
  assert.equal(formatPace(1200, 4000, "km"), "5:00");
  assert.equal(formatPace(1200, 4000, "m"), "5:00");
  assert.equal(formatPace(600, 1609.344, "mi"), "10:00");
  assert.equal(formatPace(1250, 3000, "km"), "6:57");
  assert.equal(paceSeconds(1200, null), null);
  assert.equal(paceSeconds(null, 3000), null);
  assert.equal(formatPace(0, 3000), "");
});

const set = (o: Partial<WorkoutSet>): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: null,
  weight: null,
  load: "weight",
  measure: "cardio",
  section: "working",
  done: true,
  ...o,
});

test("labels list every value a set holds, in its unit", () => {
  setCurrentLanguage("en");
  const s = set({
    durationSec: 1200,
    distanceM: 3200,
    level: 8,
    inclinePct: 2.5,
    calories: 250,
    heartRate: 142,
  });
  assert.equal(
    cardioLabel(s),
    "20:00 · 3.2 km · L8 · 2.5% incline · 250 kcal · 142 bpm",
  );
  assert.equal(
    cardioLabel(s, "m"),
    "20:00 · 3200 m · L8 · 2.5% incline · 250 kcal · 142 bpm",
  );
  setCurrentLanguage("sv");
  assert.equal(
    cardioLabel(set({ durationSec: 60, inclinePct: 1.5 })),
    "1:00 · 1,5 % lutning",
  );
  setCurrentLanguage("en");
});

test("totals add time, distance and calories and average heart rate by time", () => {
  const totals = cardioTotals([
    set({ durationSec: 600, distanceM: 2000, heartRate: 120, calories: 100 }),
    set({ durationSec: 1200, distanceM: 4000, heartRate: 150, inclinePct: 4 }),
    set({ durationSec: 300 }),
  ]);
  assert.equal(totals.durationSec, 2100);
  assert.equal(totals.distanceM, 6000);
  assert.equal(totals.calories, 100);
  assert.equal(totals.heartRate, 140);
  assert.equal(totals.inclinePct, 4);
  assert.equal(cardioTotals([set({ durationSec: 60 })]).heartRate, null);
  assert.equal(totalsLabel(totals), "35:00 · 6 km · 100 kcal · 140 bpm");
  assert.equal(totalsLabel(totals, "m"), "35:00 · 6000 m · 100 kcal · 140 bpm");
  assert.equal(totalsLabel({ durationSec: 60, distanceM: 0 }), "1:00");
});

test("up to four fields share one line; more wrap to a second", () => {
  const columns = (n: number, narrow = false) =>
    cardioGridColumns(n, narrow).split(" minmax").length;
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((n) => columns(n)),
    [1, 2, 3, 4, 3, 3, 4],
  );
  // Under 380px four fields take two lines of two, seven three lines of three.
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((n) => columns(n, true)),
    [1, 2, 3, 2, 3, 3, 3],
  );
  assert.match(
    cardioGridColumns(3),
    /^minmax\(56px, 1\.3fr\) minmax\(44px, 1fr\)/,
  );
  assert.equal(cardioGridColumns(0), "minmax(56px, 1.3fr)");
});
