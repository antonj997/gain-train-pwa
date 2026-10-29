import test from "node:test";
import assert from "node:assert/strict";
import {
  dragShape,
  heatmapCell,
  heatmapDragSelection,
  monthDragRange,
  selectionDates,
  selectionEdges,
} from "../src/lib/drag-selection";
import { historyCaption } from "../src/lib/history-caption";
import { createHistoryCalendar } from "../src/lib/history-calendar";

// Window starts on Monday 2025-10-27, so 2026-10-26 (Monday) is column 52.
const start = "2025-10-27";

test("a heatmap square is found by week column and weekday row", () => {
  assert.deepEqual(heatmapCell("2025-10-27", start), { column: 0, row: 0 });
  assert.deepEqual(heatmapCell("2025-11-02", start), { column: 0, row: 6 });
  assert.deepEqual(heatmapCell("2026-10-28", start), { column: 52, row: 2 });
});

test("the drag direction decides the shape", () => {
  const a = { column: 4, row: 2 };
  assert.equal(dragShape(a, a), "day");
  assert.equal(dragShape(a, { column: 4, row: 5 }), "week-days");
  assert.equal(dragShape(a, { column: 9, row: 2 }), "weekday");
  assert.equal(dragShape(a, { column: 9, row: 4 }), "period");
  assert.equal(dragShape(a, { column: 1, row: 0 }), "period");
});

test("vertical keeps the days of one week, in either direction", () => {
  const selection = heatmapDragSelection("2026-10-22", "2026-10-20", start);
  assert.deepEqual(selection, {
    kind: "range",
    from: "2026-10-20",
    to: "2026-10-22",
  });
  assert.equal(selectionDates(selection).length, 3);
});

test("horizontal picks one weekday in every week between the columns", () => {
  const selection = heatmapDragSelection("2026-10-26", "2026-09-07", start);
  assert.equal(selection.kind, "dates");
  if (selection.kind !== "dates") return;
  assert.equal(selection.dates.length, 8);
  assert.equal(selection.dates[0], "2026-09-07");
  assert.equal(selection.dates.at(-1), "2026-10-26");
  assert.ok(selection.dates.every((d) => heatmapCell(d, start).row === 0));
  assert.match(selection.label, /^Mondays, /);
});

test("diagonal is the whole period from the earlier to the later day", () => {
  assert.deepEqual(heatmapDragSelection("2026-10-12", "2026-10-25", start), {
    kind: "range",
    from: "2026-10-12",
    to: "2026-10-25",
  });
  assert.deepEqual(heatmapDragSelection("2026-10-25", "2026-10-12", start), {
    kind: "range",
    from: "2026-10-12",
    to: "2026-10-25",
  });
  assert.deepEqual(heatmapDragSelection("2026-10-12", "2026-10-12", start), {
    kind: "day",
    date: "2026-10-12",
  });
});

test("a month drag is the contiguous range either way round", () => {
  assert.deepEqual(monthDragRange("2026-10-20", "2026-10-03"), {
    from: "2026-10-03",
    to: "2026-10-20",
  });
});

test("the caption describes a set of dates with its workout count", () => {
  const counts = new Map([
    ["2026-10-05", 2],
    ["2026-10-12", 1],
    ["2026-10-13", 4],
  ]);
  const state = {
    ...createHistoryCalendar("2026-10-28"),
    dates: {
      dates: ["2026-10-05", "2026-10-12"],
      label: "Mondays, 5 – 12 Oct",
    },
  };
  assert.equal(
    historyCaption(state, counts, "2026-10-28"),
    "Mondays, 5 – 12 Oct · 3 workouts",
  );
});

test("a selection's edges are its first and last day", () => {
  assert.deepEqual(selectionEdges({ kind: "day", date: "2025-10-02" }), [
    "2025-10-02",
    "2025-10-02",
  ]);
  assert.deepEqual(
    selectionEdges({ kind: "range", from: "2025-10-01", to: "2025-10-05" }),
    ["2025-10-01", "2025-10-05"],
  );
  assert.deepEqual(
    selectionEdges({
      kind: "dates",
      dates: ["2025-09-01", "2025-09-08", "2025-09-15"],
      label: "Mondays",
    }),
    ["2025-09-01", "2025-09-15"],
  );
});
