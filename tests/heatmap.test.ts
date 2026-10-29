import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  countWorkoutsBetween,
  heatmapMonthLabels,
  heatmapWeeks,
  heatmapWindow,
  intensityLevel,
  stepHeatmapEnd,
} from "../src/lib/heatmap";

test("month arithmetic clamps to the last day of the month", () => {
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(addMonths("2026-01-15", -2), "2025-11-15");
});

test("a span covers whole days ending on the given date", () => {
  assert.deepEqual(heatmapWindow("2026-10-26", "month"), {
    start: "2026-09-27",
    end: "2026-10-26",
  });
  assert.equal(heatmapWindow("2026-10-26", "year").start, "2025-10-27");
});

test("weeks start on Monday and leave slots outside the span empty", () => {
  const { weeks, start, end } = heatmapWeeks("2026-10-28", "month");
  // 28 Oct 2026 is a Wednesday; 29 Sep is a Tuesday.
  assert.equal(start, "2026-09-29");
  assert.deepEqual(weeks[0].days, [
    null,
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ]);
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
  assert.equal(dates.length, 30);
  assert.equal(dates[0], start);
  assert.equal(dates.at(-1), end);
});

test("a year is 53 or 54 week columns", () => {
  const { weeks } = heatmapWeeks("2026-10-26", "year");
  assert.equal(weeks.length, 53);
  assert.ok(weeks.every((week) => week.days.length === 7));
});

test("month labels sit on the column holding the 1st", () => {
  const { weeks } = heatmapWeeks("2026-10-26", "3m");
  const labels = heatmapMonthLabels(weeks);
  // The window starts Mon 27 Jul, so August's 1st is already in column 0.
  assert.deepEqual(
    labels.map((label) => label.month),
    ["2026-08", "2026-09", "2026-10"],
  );
  assert.equal(labels[0].column, 0);
  for (const { column, month } of labels)
    assert.ok(weeks[column].days.includes(month + "-01"));
});

test("a first-column label is dropped when the next month is too close", () => {
  // Starts Sun 27 Sep, so the first column holds one day; October starts in
  // column 1 and September's label would collide with it.
  const labels = heatmapMonthLabels(heatmapWeeks("2026-10-26", "month").weeks);
  assert.deepEqual(labels, [{ column: 1, month: "2026-10" }]);
});

test("intensity levels are 0, 1, 2 and 3 or more", () => {
  assert.deepEqual([0, 1, 2, 3, 7].map(intensityLevel), [0, 1, 2, 3, 3]);
});

test("workouts are counted inside the span only and stepping stops at today", () => {
  const counts = new Map([
    ["2026-09-26", 1],
    ["2026-09-27", 2],
    ["2026-10-26", 1],
  ]);
  assert.equal(countWorkoutsBetween(counts, "2026-09-27", "2026-10-26"), 3);
  assert.equal(
    stepHeatmapEnd("2026-10-26", "3m", -1, "2026-10-26"),
    "2026-07-26",
  );
  assert.equal(
    stepHeatmapEnd("2026-08-26", "6m", 1, "2026-10-26"),
    "2026-10-26",
  );
});
