import test from "node:test";
import assert from "node:assert/strict";
import {
  HEATMAP_WEEKS,
  heatmapMonthLabels,
  heatmapWeeks,
  heatmapWindow,
  intensityLevel,
  lastWorkoutDate,
  monthTone,
} from "../src/lib/heatmap";

test("the window starts on the Monday 52 weeks before this week's and ends today", () => {
  // 28 Oct 2026 is a Wednesday, so this week's Monday is 26 Oct.
  assert.deepEqual(heatmapWindow("2026-10-28"), {
    start: "2025-10-27",
    end: "2026-10-28",
  });
});

test("there are 53 Monday-first week columns and days after today are empty", () => {
  const { weeks, start, end } = heatmapWeeks("2026-10-28");
  assert.equal(weeks.length, HEATMAP_WEEKS);
  assert.ok(weeks.every((week) => week.days.length === 7));
  assert.equal(weeks[0].days[0], start);
  assert.deepEqual(weeks.at(-1)!.days, [
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    null,
    null,
    null,
    null,
  ]);
  const dates = weeks.flatMap((week) => week.days).filter(Boolean);
  assert.equal(dates.at(-1), end);
  assert.equal(new Set(dates).size, dates.length);
});

test("a Sunday today fills the last column", () => {
  const { weeks } = heatmapWeeks("2026-11-01");
  assert.equal(weeks.at(-1)!.days.at(-1), "2026-11-01");
  assert.equal(weeks[0].days[0], "2025-10-27");
});

test("month labels sit on the column holding the 1st", () => {
  const { weeks } = heatmapWeeks("2026-10-26");
  const labels = heatmapMonthLabels(weeks);
  assert.equal(labels.at(-1)!.month, "2026-10");
  for (const { column, month } of labels)
    assert.ok(weeks[column].days.includes(month + "-01") || column === 0);
  assert.equal(new Set(labels.map((label) => label.month)).size, labels.length);
});

test("a first-column label is dropped when the next month is too close", () => {
  // Starts Mon 27 Oct 2025, so November's 1st is in column 0 and is the first label.
  const labels = heatmapMonthLabels(heatmapWeeks("2026-10-26").weeks);
  assert.deepEqual(labels[0], { column: 0, month: "2025-11" });
});

test("intensity levels are 0, 1, 2 and 3 or more", () => {
  assert.deepEqual([0, 1, 2, 3, 7].map(intensityLevel), [0, 1, 2, 3, 3]);
});

test("the month tint alternates between neighbouring months, across years too", () => {
  assert.notEqual(monthTone("2026-09-30"), monthTone("2026-10-01"));
  assert.equal(monthTone("2026-10-01"), monthTone("2026-10-31"));
  assert.notEqual(monthTone("2025-12-31"), monthTone("2026-01-01"));
});

test("the last workout date ignores empty and future days", () => {
  const counts = new Map([
    ["2026-09-26", 1],
    ["2026-10-20", 2],
    ["2026-10-22", 0],
    ["2026-10-30", 1],
  ]);
  assert.equal(lastWorkoutDate(counts, "2026-10-26"), "2026-10-20");
  assert.equal(lastWorkoutDate(new Map(), "2026-10-26"), null);
});
