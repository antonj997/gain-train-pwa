import test from "node:test";
import assert from "node:assert/strict";
import { planSchema, type Plan, type RecordDoc } from "../src/data/model";
import {
  REST,
  activePlans,
  defaultNewPlan,
  trimOverrides,
  withCycle,
  withOverride,
  withTemplateCell,
  findOverlap,
  groupCell,
  groupsOf,
  legacyPlanToPlan,
  plannedFor,
  resolveCell,
  threeMonthsAfter,
  typeCell,
} from "../src/data/plans";

const row = (...cells: (string | null)[]) =>
  Array.from({ length: 7 }, (_, i) => cells[i] ?? null);
const plan = (change: Partial<Plan> = {}): Plan => ({
  name: "Block",
  // 2026-11-04 is a Wednesday; the first template week is 2 to 8 November.
  startDate: "2026-11-04",
  endDate: "2026-11-30",
  cycleWeeks: 2,
  template: [row("push", null, "pull"), row("legs", REST)],
  overrides: {},
  goalIds: [],
  ...change,
});

test("plannedFor loops the template from the first week of the period", () => {
  const plans = [plan()];
  // Week 1 (2-8 Nov): Mon push, Tue nothing, Wed pull.
  assert.equal(plannedFor(plans, "2026-11-04")?.cell, "pull");
  assert.equal(plannedFor(plans, "2026-11-05")?.cell, null);
  // Week 2 (9-15 Nov): Mon legs, Tue rest.
  assert.equal(plannedFor(plans, "2026-11-09")?.cell, "legs");
  assert.equal(plannedFor(plans, "2026-11-10")?.cell, REST);
  // Week 3 loops back to the first row (16-22 Nov).
  assert.equal(plannedFor(plans, "2026-11-16")?.cell, "push");
  assert.equal(plannedFor(plans, "2026-11-18")?.cell, "pull");
  // Week 4 is the second row again.
  assert.equal(plannedFor(plans, "2026-11-24")?.cell, REST);
  assert.equal(plannedFor(plans, "2026-11-23")?.cell, "legs");
});

test("plannedFor only answers inside the period, and a day with nothing is a null cell", () => {
  const plans = [plan()];
  assert.equal(plannedFor(plans, "2026-11-03"), null);
  assert.equal(plannedFor(plans, "2026-12-01"), null);
  assert.equal(plannedFor([], "2026-11-04"), null);
  assert.equal(plannedFor(plans, "2026-11-30")?.cell, "push");
  assert.equal(plannedFor(plans, "2026-11-05")?.override, false);
});

test("a dated override wins, and null overrides to nothing", () => {
  const plans = [
    plan({ overrides: { "2026-11-04": REST, "2026-11-09": null } }),
  ];
  assert.deepEqual(
    [
      plannedFor(plans, "2026-11-04")?.cell,
      plannedFor(plans, "2026-11-04")?.override,
    ],
    [REST, true],
  );
  assert.deepEqual(
    [
      plannedFor(plans, "2026-11-09")?.cell,
      plannedFor(plans, "2026-11-09")?.override,
    ],
    [null, true],
  );
  // An override outside the period is ignored.
  const outside = [plan({ overrides: { "2026-12-24": REST } })];
  assert.equal(plannedFor(outside, "2026-12-24"), null);
});

test("a one-week cycle repeats every week, and the right plan answers", () => {
  const weekly = plan({
    cycleWeeks: 1,
    template: [row("a", "b", "c", "d", "e", "f", "g")],
  });
  assert.equal(plannedFor([weekly], "2026-11-08")?.cell, "g");
  assert.equal(plannedFor([weekly], "2026-11-23")?.cell, "a");
  const later = plan({ startDate: "2026-12-01", endDate: "2026-12-31" });
  assert.equal(plannedFor([weekly, later], "2026-12-02")?.plan, later);
});

test("findOverlap finds a shared day and ignores the plan being edited", () => {
  const a = { id: "a", startDate: "2026-11-01", endDate: "2026-11-30" };
  const b = { id: "b", startDate: "2026-12-01", endDate: "2026-12-31" };
  assert.equal(
    findOverlap([a, b], { startDate: "2026-11-30", endDate: "2026-12-05" }),
    a,
  );
  assert.equal(
    findOverlap([a, b], { startDate: "2026-12-05", endDate: "2026-12-06" }),
    b,
  );
  assert.equal(
    findOverlap([a, b], { startDate: "2027-01-01", endDate: "2027-01-31" }),
    null,
  );
  assert.equal(
    findOverlap([a, b], { startDate: "2026-10-01", endDate: "2026-10-31" }),
    null,
  );
  // Touching on the same day counts; the day before does not.
  assert.equal(
    findOverlap([b], { startDate: "2026-11-15", endDate: "2026-12-01" }),
    b,
  );
  assert.equal(
    findOverlap([b], { startDate: "2026-11-15", endDate: "2026-11-30" }),
    null,
  );
  assert.equal(
    findOverlap([a], { startDate: "2026-11-05", endDate: "2026-11-06" }, "a"),
    null,
  );
});

const record = (id: string, kind: string, payload: unknown, deleted = false) =>
  ({
    id,
    kind,
    payload,
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted,
  }) as RecordDoc;

test("activePlans skips deleted plans and sorts by start", () => {
  const records = {
    x: record(
      "x",
      "plan",
      plan({ name: "Later", startDate: "2026-12-01", endDate: "2026-12-31" }),
    ),
    y: record("y", "plan", plan({ name: "Earlier" })),
    z: record("z", "plan", plan({ name: "Gone" }), true),
    w: record("w", "routine", { name: "R", exercises: [] }),
  };
  assert.deepEqual(
    activePlans(records).map((p) => p.name),
    ["Earlier", "Later"],
  );
});

const g1 = crypto.randomUUID();
const r1 = crypto.randomUUID();
const r2 = crypto.randomUUID();

test("groupsOf reads valid groups from the library record and skips broken ones", () => {
  const library = record("lib", "library", {
    hiddenExerciseIds: [],
    groups: [
      { id: g1, name: "Legday", routineIds: [r1], categories: ["Legs"] },
      { id: "not-a-uuid", name: "Bad", routineIds: [], categories: [] },
      { id: crypto.randomUUID(), name: "", routineIds: [], categories: [] },
      "nonsense",
    ],
  });
  assert.deepEqual(
    groupsOf({ lib: library }).map((g) => g.name),
    ["Legday"],
  );
  assert.deepEqual(
    groupsOf({ lib: record("lib", "library", { hiddenExerciseIds: [] }) }),
    [],
  );
  assert.deepEqual(
    groupsOf({ lib: { ...library, deleted: true } as RecordDoc }),
    [],
  );
  assert.deepEqual(groupsOf([]), []);
});

test("resolveCell turns a cell into what Train shows and ignores deleted targets", () => {
  const routines = [{ id: r1, payload: { name: "Squat day" } }];
  const groups = [
    {
      id: g1,
      name: "Legday",
      routineIds: [r1, r2],
      categories: ["Legs", "Glutes"],
    },
  ];
  const names = { routines, groups };
  assert.equal(resolveCell(null, names), null);
  assert.equal(resolveCell(REST, names)?.kind, "rest");
  assert.deepEqual(resolveCell(r1, names), {
    kind: "routine",
    title: "Squat day",
    routineIds: [r1],
    categories: [],
  });
  assert.equal(resolveCell(r2, names), null);
  // A group lists only the routines that still exist.
  assert.deepEqual(resolveCell(groupCell(g1), names), {
    kind: "group",
    title: "Legday",
    routineIds: [r1],
    categories: ["Legs", "Glutes"],
  });
  assert.equal(resolveCell(groupCell(crypto.randomUUID()), names), null);
  assert.deepEqual(resolveCell(typeCell("push"), names)?.categories, [
    "Chest",
    "Shoulders",
    "Arms",
  ]);
  assert.equal(resolveCell(typeCell("nope"), names), null);
});

test("the old local plan becomes a one-week synced plan for three months", () => {
  assert.equal(threeMonthsAfter("2026-10-29"), "2027-01-29");
  assert.equal(threeMonthsAfter("2026-11-30"), "2027-02-28");
  assert.equal(legacyPlanToPlan(null, "2026-10-29"), null);
  assert.equal(legacyPlanToPlan("not json", "2026-10-29"), null);
  assert.equal(
    legacyPlanToPlan('{"weekly":[],"dated":{}}', "2026-10-29"),
    null,
  );

  const imported = legacyPlanToPlan(
    JSON.stringify({
      weekly: ["push", null, "pull", REST, 5, "", null],
      dated: {
        "2026-10-30": "legs",
        "2026-10-01": "old",
        "2027-06-01": "far",
        tomorrow: "x",
        "2026-11-02": 7,
      },
    }),
    "2026-10-29",
  );
  assert.ok(imported);
  assert.equal(imported.startDate, "2026-10-29");
  assert.equal(imported.endDate, "2027-01-29");
  assert.equal(imported.cycleWeeks, 1);
  assert.deepEqual(imported.template, [row("push", null, "pull", REST)]);
  assert.deepEqual(imported.overrides, { "2026-10-30": "legs" });
  assert.equal(planSchema.safeParse(imported).success, true);
  // Same answers as the old plan gave: Monday 2 Nov is the "push" weekday.
  assert.equal(plannedFor([imported], "2026-11-02")?.cell, "push");
  assert.equal(plannedFor([imported], "2026-10-30")?.cell, "legs");
  assert.equal(plannedFor([imported], "2026-10-29")?.cell, REST);
});

test("plan editing helpers: new period, cycle, cells, overrides", () => {
  const fresh = defaultNewPlan([{ endDate: "2026-11-10" }], "2026-10-29");
  assert.equal(fresh.startDate, "2026-11-11");
  assert.equal(fresh.endDate, "2027-01-05");
  assert.equal(defaultNewPlan([], "2026-10-29").startDate, "2026-10-29");

  const two = withTemplateCell(withCycle(fresh, 2), 1, 6, REST);
  assert.equal(two.template.length, 2);
  assert.equal(two.template[1][6], REST);
  assert.equal(withCycle(two, 1).template.length, 1);
  assert.equal(withCycle(withCycle(two, 1), 2).template[1][6], null);

  const changed = withOverride(two, "2026-11-12", null);
  assert.deepEqual(changed.overrides, { "2026-11-12": null });
  assert.deepEqual(
    withOverride(changed, "2026-11-12", undefined).overrides,
    {},
  );
  assert.deepEqual(
    trimOverrides({
      ...changed,
      overrides: { "2026-11-12": REST, "2028-01-01": REST },
    }),
    { "2026-11-12": REST },
  );
});
