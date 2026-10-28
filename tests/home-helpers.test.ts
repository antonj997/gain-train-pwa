import test from "node:test";
import assert from "node:assert/strict";
import { HEADLINES, pickHeadline } from "../src/lib/headlines.ts";
import { goalStreak, weekStrip, weekTotals } from "../src/lib/week-summary.ts";
import {
  normalizeTrainingPreferences,
  parseWeeklyGoal,
} from "../src/lib/preferences.ts";
import { timeTrainedLabel } from "../src/lib/labels.ts";

test("headlines fit the rules and never repeat the previous pick", () => {
  assert.ok(HEADLINES.length >= 24);
  assert.equal(new Set(HEADLINES).size, HEADLINES.length);
  for (const line of HEADLINES) {
    assert.ok(line.length < 40, line);
    assert.ok(!line.includes("!"), line);
  }
  for (const previous of HEADLINES) {
    for (const r of [0, 0.3, 0.999999]) {
      assert.notEqual(
        pickHeadline(previous, () => r),
        previous,
      );
    }
  }
  assert.ok(HEADLINES.includes(pickHeadline(null, () => 0.5)));
  assert.equal(
    pickHeadline("a", () => 0, ["a"]),
    "a",
  );
});

test("week strip runs Monday to Sunday and marks done days and today", () => {
  // 2026-10-28 is a Wednesday.
  const strip = weekStrip(
    ["2026-10-26", "2026-10-28", "2026-10-20"],
    "2026-10-28",
  );
  assert.deepEqual(
    strip.map((d) => d.date),
    [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ],
  );
  assert.deepEqual(
    strip.map((d) => d.done),
    [true, false, true, false, false, false, false],
  );
  assert.deepEqual(
    strip.map((d) => d.today),
    [false, false, true, false, false, false, false],
  );
  assert.equal(strip[6].day, 1);
  assert.equal(strip[0].label, "M");
});

test("week totals count only this week's workouts", () => {
  const set = { id: "s", reps: 5, weight: 20, done: true } as never;
  const workout = (date: string, duration: number | null) => ({
    date,
    duration,
    exercises: [{ id: "e", sets: [set, set] }] as never,
  });
  const totals = weekTotals(
    [
      workout("2026-10-26", 60),
      workout("2026-10-25", 30),
      workout("2026-10-28", null),
    ],
    "2026-10-28",
  );
  assert.equal(totals.workouts, 2);
  assert.equal(totals.minutes, 60);
  assert.equal(totals.sets, totals.workouts * 2);
});

test("goal streak counts finished weeks that met the goal", () => {
  const week = (monday: string, n: number) =>
    Array.from({ length: n }, () => monday);
  const dates = [
    ...week("2026-10-26", 1), // this week, 1 so far
    ...week("2026-10-19", 3),
    ...week("2026-10-12", 4),
    ...week("2026-10-05", 2), // missed
    ...week("2026-09-28", 3),
  ];
  assert.equal(goalStreak(dates, 3, "2026-10-28"), 2);
  // The current week joins once it reaches the goal.
  assert.equal(
    goalStreak([...dates, "2026-10-27", "2026-10-28"], 3, "2026-10-28"),
    3,
  );
  assert.equal(goalStreak(dates, null, "2026-10-28"), 0);
  assert.equal(goalStreak([], 3, "2026-10-28"), 0);
});

test("weekly goal parsing accepts 1-14 and treats everything else as off", () => {
  assert.equal(parseWeeklyGoal("3"), 3);
  assert.equal(parseWeeklyGoal("14"), 14);
  for (const bad of [null, "", "0", "15", "-1", "2.5", "abc"])
    assert.equal(parseWeeklyGoal(bad), null);
  assert.equal(normalizeTrainingPreferences("60", "false", "4").weeklyGoal, 4);
});

test("time trained reads in minutes and hours", () => {
  assert.equal(timeTrainedLabel(0), "0 min");
  assert.equal(timeTrainedLabel(45), "45 min");
  assert.equal(timeTrainedLabel(113), "1 h 53 min");
  assert.equal(timeTrainedLabel(120), "2 h");
});
