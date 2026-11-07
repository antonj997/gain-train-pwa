import test from "node:test";
import assert from "node:assert/strict";
import { dayCellClass } from "../src/components/items/day-cell.ts";
import { phaseSegments } from "../src/data/phase.ts";
import type { Plan } from "../src/data/model.ts";

test("a day cell's classes: trained wins over planned, today adds the ring", () => {
  assert.equal(dayCellClass({}, "week"), "day-cell is-week");
  assert.equal(
    dayCellClass({ trained: true, planned: true, today: true }, "month"),
    "day-cell is-month is-trained is-today",
  );
  assert.equal(
    dayCellClass({ planned: true }, "grid"),
    "day-cell is-grid is-planned",
  );
});

const plan: Plan = {
  name: "Strength",
  startDate: "2026-10-19",
  endDate: "2026-11-15",
  cycleWeeks: 2,
  template: [Array(7).fill(null), Array(7).fill(null)],
  overrides: {},
  goalIds: [],
  weekKinds: ["normal", "deload"],
};

test("phase segments: one per week, done before this week, deload weeks marked", () => {
  assert.deepEqual(
    phaseSegments(plan, "2026-11-04").map((s) => [s.week, s.state, s.deload]),
    [
      [1, "done", false],
      [2, "done", true],
      [3, "now", false],
      [4, "next", true],
    ],
  );
  assert.ok(phaseSegments(plan, "2026-10-01").every((s) => s.state === "next"));
  assert.ok(phaseSegments(plan, "2026-12-01").every((s) => s.state === "done"));
});
