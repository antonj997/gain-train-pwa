import test from "node:test";
import assert from "node:assert/strict";
import type { Plan } from "../src/data/model";
import { REST } from "../src/data/plans";
import { moveDay } from "../src/data/plan-moves";
import { weekStrip } from "../src/lib/week-summary";
import {
  EDGE_HOLD_MS,
  EDGE_IDLE,
  EDGE_OVERSHOOT,
  LINGER_MS,
  allowedInWeek,
  dateInWeek,
  edgeHold,
  resistance,
  weekDates,
  weekOffsetOf,
  weekRange,
  type EdgeInput,
  type EdgeState,
} from "../src/lib/week-nav";

const row = (...cells: (string | null)[]) =>
  Array.from({ length: 7 }, (_, i) => cells[i] ?? null);
// 2026-11-09 is a Monday; today is Thursday 2026-11-12 (week 46).
const TODAY = "2026-11-12";
const plan = (change: Partial<Plan> = {}) => ({
  id: "p",
  name: "Block",
  startDate: "2026-11-09",
  endDate: "2026-11-29",
  cycleWeeks: 1,
  template: [row("push", null, "pull", null, "legs", REST)],
  overrides: {},
  goalIds: [],
  ...change,
});

test("weekOffsetOf counts whole weeks from today's week, Monday to Sunday", () => {
  assert.equal(weekOffsetOf("2026-11-09", TODAY), 0);
  assert.equal(weekOffsetOf("2026-11-15", TODAY), 0);
  assert.equal(weekOffsetOf("2026-11-16", TODAY), 1);
  assert.equal(weekOffsetOf("2026-11-29", TODAY), 2);
  assert.equal(weekOffsetOf("2026-11-08", TODAY), -1);
  // Across a year and a daylight-saving change.
  assert.equal(weekOffsetOf("2027-01-04", "2026-12-31"), 1);
  assert.equal(weekOffsetOf("2026-11-02", "2026-10-25"), 2);
});

test("dateInWeek and weekDates give the days of an offset week", () => {
  assert.equal(dateInWeek(TODAY, 0, 0), "2026-11-09");
  assert.equal(dateInWeek(TODAY, 1, 0), "2026-11-16");
  assert.equal(dateInWeek(TODAY, 1, 6), "2026-11-22");
  assert.equal(dateInWeek(TODAY, -1, 3), "2026-11-05");
  assert.deepEqual(weekDates(TODAY, 1), [
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ]);
  for (let offset = -3; offset <= 3; offset++)
    for (const date of weekDates(TODAY, offset))
      assert.equal(weekOffsetOf(date, TODAY), offset);
});

test("weekStrip shows another week and marks today only in its own", () => {
  const next = weekStrip(["2026-11-17", "2026-11-10"], TODAY, 1);
  assert.equal(next[0].date, "2026-11-16");
  assert.deepEqual(
    next.map((d) => d.done),
    [false, true, false, false, false, false, false],
  );
  assert.ok(next.every((d) => !d.today));
  assert.equal(next[1].day, 17);
  const now = weekStrip([], TODAY, 0);
  assert.equal(now.find((d) => d.today)?.date, TODAY);
});

test("allowedInWeek: past days and days outside the plan are refused", () => {
  const plans = [plan()];
  // Fri 13 legs. This week: today and later, not the day itself.
  assert.deepEqual(allowedInWeek(plans, "2026-11-13", TODAY, 0), [
    "2026-11-12",
    "2026-11-14",
    "2026-11-15",
  ]);
  // Next week: every day (the plan runs to the 29th).
  assert.equal(allowedInWeek(plans, "2026-11-13", TODAY, 1).length, 7);
  // After the plan: none.
  assert.deepEqual(allowedInWeek(plans, "2026-11-13", TODAY, 3), []);
  // A plan ending on Wednesday the 25th: only Mon to Wed.
  assert.deepEqual(
    allowedInWeek([plan({ endDate: "2026-11-25" })], "2026-11-13", TODAY, 2),
    ["2026-11-23", "2026-11-24", "2026-11-25"],
  );
  // Last week: all past.
  assert.deepEqual(allowedInWeek(plans, "2026-11-13", TODAY, -1), []);
});

test("weekRange runs from today's week to the plan's last week", () => {
  assert.deepEqual(weekRange([plan()], "2026-11-13", TODAY), {
    min: 0,
    max: 2,
  });
  assert.deepEqual(
    weekRange([plan({ endDate: "2026-11-15" })], "2026-11-13", TODAY),
    { min: 0, max: 0 },
  );
  // A plan that starts next week cannot reach back into this one.
  assert.deepEqual(
    weekRange(
      [plan({ startDate: "2026-11-18", endDate: "2026-12-06" })],
      "2026-11-18",
      TODAY,
    ),
    { min: 1, max: 3 },
  );
  assert.equal(weekRange([plan()], "2026-12-20", TODAY), null);
});

test("a step into next week with the same moveDay rules: a busy day swaps", () => {
  const p = plan();
  const moved = moveDay(p, "2026-11-13", "2026-11-16");
  assert.deepEqual(moved.overrides, {
    "2026-11-16": "legs",
    "2026-11-13": "push",
  });
});

// ---- The edge hold.
const at = (now: number, over: number, change: Partial<EdgeInput> = {}) => ({
  side: (over > 0 ? 1 : 0) as EdgeInput["side"],
  over,
  zone: 20,
  canStep: true,
  now,
  ...change,
});
/** Feeds looks one after another, returning the steps taken. */
function run(looks: EdgeInput[]) {
  let state: EdgeState = EDGE_IDLE;
  const steps: { now: number; step: number }[] = [];
  for (const look of looks) {
    const r = edgeHold(state, look);
    state = r.state;
    if (r.step) steps.push({ now: look.now, step: r.step });
  }
  return { state, steps };
}

test("the thresholds are a 600 ms hold and a 40 px overshoot", () => {
  assert.equal(EDGE_HOLD_MS, 600);
  assert.equal(EDGE_OVERSHOOT, 40);
  assert.equal(LINGER_MS, 1200);
});

test("inside the strip or short of the zone nothing happens", () => {
  const r = edgeHold(EDGE_IDLE, at(0, 0));
  assert.deepEqual(r, { state: EDGE_IDLE, step: 0, wait: null });
  const short = edgeHold(EDGE_IDLE, at(0, 12));
  assert.equal(short.step, 0);
  assert.equal(short.wait, null);
  assert.equal(short.state.side, 0);
});

test("in the zone the hold runs and steps only after 600 ms", () => {
  const enter = edgeHold(EDGE_IDLE, at(1000, 25));
  assert.equal(enter.step, 0);
  assert.equal(enter.state.side, 1);
  assert.equal(enter.wait, 600);
  const mid = edgeHold(enter.state, at(1599, 30));
  assert.equal(mid.step, 0);
  assert.equal(mid.wait, 1);
  const done = edgeHold(mid.state, at(1600, 30));
  assert.equal(done.step, 1);
  assert.equal(done.state.since, 1600);
});

test("a small overshoot let go before the hold never changes week", () => {
  const { steps } = run([at(0, 25), at(200, 35), at(400, 30), at(500, 0)]);
  assert.deepEqual(steps, []);
});

test("leaving the zone resets the hold", () => {
  const { steps } = run([
    at(0, 25),
    at(500, 25),
    at(550, 5),
    at(600, 25),
    at(1100, 25),
    at(1200, 25),
  ]);
  assert.deepEqual(steps, [{ now: 1200, step: 1 }]);
});

test("keep holding to step on, a week every 600 ms", () => {
  const { steps } = run(
    [0, 300, 600, 900, 1200, 1500, 1800].map((t) => at(t, 30)),
  );
  assert.deepEqual(
    steps.map((s) => s.now),
    [600, 1200, 1800],
  );
});

test("an overshoot past 40 px steps at once, then waits for the hold", () => {
  const { steps } = run([
    at(0, 25),
    at(50, 45),
    at(100, 50),
    at(400, 48),
    at(650, 48),
  ]);
  // At once on the push, then once more a full hold after it (not again
  // for staying past 40 px).
  assert.deepEqual(
    steps.map((s) => s.now),
    [50, 650],
  );
});

test("easing back under the overshoot re-arms it", () => {
  const { steps } = run([at(0, 45), at(100, 30), at(150, 45)]);
  assert.deepEqual(
    steps.map((s) => s.now),
    [0, 150],
  );
});

test("the left edge steps back, and an edge that cannot step stays quiet", () => {
  const left = edgeHold(EDGE_IDLE, at(0, 45, { side: -1 }));
  assert.equal(left.step, -1);
  const blocked = edgeHold(EDGE_IDLE, at(0, 45, { canStep: false }));
  assert.equal(blocked.step, 0);
  assert.equal(blocked.wait, null);
  // Switching sides starts the hold over.
  const right = edgeHold(left.state, at(100, 25, { side: 1 }));
  assert.equal(right.state.since, 100);
  assert.equal(right.step, 0);
});

test("a custom hold length (slow motion) is honoured", () => {
  const enter = edgeHold(EDGE_IDLE, at(0, 25), 6000);
  assert.equal(enter.wait, 6000);
  assert.equal(edgeHold(enter.state, at(600, 25), 6000).step, 0);
  assert.equal(edgeHold(enter.state, at(6000, 25), 6000).step, 1);
});

test("resistance gives a little past the stop and never more than its max", () => {
  assert.equal(resistance(0), 0);
  assert.equal(resistance(-5), 0);
  assert.ok(resistance(10) > 0 && resistance(10) < 10);
  assert.ok(resistance(40) > resistance(20));
  assert.ok(resistance(10_000) < 12);
});
