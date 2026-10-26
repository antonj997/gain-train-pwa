import test from "node:test";
import assert from "node:assert/strict";
import { calendarCells, calendarRangeEdges } from "../src/lib/history-calendar";

test("detailed ranges join adjacent days and cap only visible week segments", () => {
  const cells = calendarCells("2026-10");
  const bounds = { start: "2026-10-02", end: "2026-10-13" };
  const edges = cells.map((cell, index) => ({
    date: cell.date,
    edges: calendarRangeEdges(cells, index, bounds),
  }));
  assert.deepEqual(
    edges.filter((cell) => cell.edges?.start).map((cell) => cell.date),
    ["2026-10-02", "2026-10-05", "2026-10-12"],
  );
  assert.deepEqual(
    edges.filter((cell) => cell.edges?.end).map((cell) => cell.date),
    ["2026-10-04", "2026-10-11", "2026-10-13"],
  );
  assert.equal(edges.filter((cell) => cell.edges).length, 12);
});

test("compact ranges join actual-month cells without phantom outside-month days", () => {
  const cells = calendarCells("2026-10", "simple");
  const bounds = { start: "2026-10-02", end: "2026-10-13" };
  const edges = cells.map((cell, index) => ({
    date: cell.date,
    edges: calendarRangeEdges(cells, index, bounds),
  }));
  assert.deepEqual(
    edges.filter((cell) => cell.edges?.start).map((cell) => cell.date),
    ["2026-10-02", "2026-10-08"],
  );
  assert.deepEqual(
    edges.filter((cell) => cell.edges?.end).map((cell) => cell.date),
    ["2026-10-07", "2026-10-13"],
  );
});

test("cross-month and one-day ranges receive complete visible ends", () => {
  const cells = calendarCells("2026-10");
  const index = (date: string) => cells.findIndex((cell) => cell.date === date);
  const crossing = { start: "2026-09-29", end: "2026-10-10" };
  assert.equal(
    calendarRangeEdges(cells, index("2026-10-01"), crossing)?.start,
    true,
  );
  assert.equal(calendarRangeEdges(cells, index("2026-09-29"), crossing), null);
  const one = { start: "2026-10-14", end: "2026-10-14" };
  assert.deepEqual(calendarRangeEdges(cells, index(one.start), one), {
    start: true,
    end: true,
  });
  assert.equal(calendarRangeEdges(cells, index(one.start), null), null);
});
