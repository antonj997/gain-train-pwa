import test from "node:test";
import assert from "node:assert/strict";
import { planSchema, type Plan } from "../src/data/model";
import { REST, plannedFor } from "../src/data/plans";
import {
  canEditDay,
  canMoveTo,
  isWorkoutCell,
  moveDay,
  restoreDay,
  skipDay,
  snapshotDay,
} from "../src/data/plan-moves";

const row = (...cells: (string | null)[]) =>
  Array.from({ length: 7 }, (_, i) => cells[i] ?? null);
// 2026-11-09 is a Monday. Week: Mon push, Wed pull, Fri legs, Sat rest.
const plan = (change: Partial<Plan> = {}): Plan => ({
  name: "Block",
  startDate: "2026-11-09",
  endDate: "2026-11-29",
  cycleWeeks: 1,
  template: [row("push", null, "pull", null, "legs", REST)],
  overrides: {},
  goalIds: [],
  ...change,
});
const cell = (p: Plan, date: string) =>
  plannedFor([{ ...p, id: "p" }], date)?.cell ?? null;

test("moveDay to an empty day moves the workout and leaves nothing behind", () => {
  const next = moveDay(plan(), "2026-11-11", "2026-11-12");
  assert.equal(cell(next, "2026-11-12"), "pull");
  assert.equal(cell(next, "2026-11-11"), null);
  assert.deepEqual(next.overrides, {
    "2026-11-11": null,
    "2026-11-12": "pull",
  });
  assert.ok(planSchema.safeParse(next).success, "the record keeps its shape");
});

test("moveDay onto a busy day swaps the two workouts", () => {
  const next = moveDay(plan(), "2026-11-11", "2026-11-13");
  assert.equal(cell(next, "2026-11-13"), "pull");
  assert.equal(cell(next, "2026-11-11"), "legs");
});

test("moveDay onto a rest day replaces the rest and leaves nothing behind", () => {
  const next = moveDay(plan(), "2026-11-13", "2026-11-14");
  assert.equal(cell(next, "2026-11-14"), "legs");
  assert.equal(cell(next, "2026-11-13"), null);
});

test("moving a workout back where it was drops the overrides", () => {
  const there = moveDay(plan(), "2026-11-11", "2026-11-12");
  const back = moveDay(there, "2026-11-12", "2026-11-11");
  assert.deepEqual(back.overrides, {});
});

test("moveDay keeps other overrides and ignores a move to the same day", () => {
  const base = plan({ overrides: { "2026-11-20": "push" } });
  assert.equal(moveDay(base, "2026-11-11", "2026-11-11"), base);
  const next = moveDay(base, "2026-11-11", "2026-11-12");
  assert.equal(next.overrides["2026-11-20"], "push");
});

test("skipDay makes a rest day and Undo restores exactly the earlier state", () => {
  const base = plan({ overrides: { "2026-11-12": "legs" } });
  for (const date of ["2026-11-11", "2026-11-12"]) {
    const snap = snapshotDay(base, date);
    const skipped = skipDay(base, date);
    assert.equal(cell(skipped, date), REST);
    assert.deepEqual(restoreDay(skipped, snap).overrides, base.overrides);
  }
});

test("canMoveTo keeps a workout inside its plan, today or later", () => {
  const plans = [{ ...plan(), id: "a" }];
  const today = "2026-11-11";
  assert.equal(canMoveTo(plans, "2026-11-11", "2026-11-15", today), true);
  assert.equal(canMoveTo(plans, "2026-11-11", "2026-11-10", today), false);
  assert.equal(canMoveTo(plans, "2026-11-11", "2026-11-11", today), false);
  assert.equal(canMoveTo(plans, "2026-11-27", "2026-11-30", today), false);
});

test("canEditDay: a planned workout from today on", () => {
  const plans = [{ ...plan(), id: "a" }];
  const today = "2026-11-11";
  assert.equal(canEditDay(plans, "2026-11-11", today), true);
  assert.equal(canEditDay(plans, "2026-11-09", today), false);
  assert.equal(canEditDay(plans, "2026-11-12", today), false);
  assert.equal(canEditDay(plans, "2026-11-14", today), false);
  assert.equal(isWorkoutCell("type:legs"), true);
  assert.equal(isWorkoutCell(REST), false);
});
