import test from "node:test";
import assert from "node:assert/strict";
import {
  REST,
  emptyPlan,
  hasPlan,
  parsePlan,
  plannedFor,
  planHorizon,
  prunePlan,
  weeklyFor,
  type TrainingPlan,
} from "../src/lib/plan.ts";

const plan: TrainingPlan = {
  weekly: ["push", null, "pull", REST, null, null, null],
  dated: { "2026-10-29": "legs", "2026-11-02": REST, "2026-10-20": "old" },
};

test("plannedFor gives a dated choice first, then the weekday", () => {
  // 2026-10-28 is a Wednesday, 2026-11-02 a Monday.
  assert.equal(plannedFor(plan, "2026-10-28"), "pull");
  assert.equal(plannedFor(plan, "2026-10-29"), "legs");
  assert.equal(plannedFor(plan, "2026-11-02"), REST);
  assert.equal(plannedFor(plan, "2026-11-09"), "push");
  assert.equal(plannedFor(plan, "2026-10-27"), null);
  assert.equal(plannedFor(null, "2026-10-28"), null);
  assert.equal(weeklyFor(plan, "2026-10-29"), REST);
});

test("prunePlan drops dated entries before today and leaves the rest", () => {
  const pruned = prunePlan(plan, "2026-10-28");
  assert.deepEqual(pruned.dated, {
    "2026-10-29": "legs",
    "2026-11-02": REST,
  });
  assert.deepEqual(pruned.weekly, plan.weekly);
  assert.ok(plan.dated["2026-10-20"], "the input is not changed");
  assert.deepEqual(prunePlan(plan, "2026-10-29").dated["2026-10-29"], "legs");
});

test("planHorizon is three months ahead and clamps short months", () => {
  assert.equal(planHorizon("2026-10-28"), "2027-01-28");
  assert.equal(planHorizon("2026-11-30"), "2027-02-28");
  assert.equal(planHorizon("2026-12-31"), "2027-03-31");
  assert.equal(planHorizon("2027-11-30"), "2028-02-29");
});

test("parsePlan keeps valid entries and drops malformed ones", () => {
  assert.equal(parsePlan(null), null);
  assert.equal(parsePlan("not json"), null);
  assert.equal(parsePlan("[]"), null);
  assert.equal(parsePlan('{"weekly":[],"dated":{}}'), null);
  assert.deepEqual(
    parsePlan(
      JSON.stringify({
        weekly: ["a", 5, "", "rest"],
        dated: { "2026-10-29": "b", tomorrow: "c", "2026-10-30": 7 },
      }),
    ),
    {
      weekly: ["a", null, null, "rest", null, null, null],
      dated: { "2026-10-29": "b" },
    },
  );
  assert.deepEqual(parsePlan(JSON.stringify(plan)), plan);
});

test("an empty plan counts as no plan", () => {
  assert.equal(hasPlan(null), false);
  assert.equal(hasPlan(emptyPlan()), false);
  assert.equal(
    hasPlan({ ...emptyPlan(), dated: { "2026-10-29": REST } }),
    true,
  );
});
