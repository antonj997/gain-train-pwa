import test from "node:test";
import assert from "node:assert/strict";
import { planSchema, routineSchema, type Routine } from "../src/data/model.ts";
import { programById } from "../src/data/programs.ts";
import {
  isProgramAdded,
  programPlanDraft,
  programRoutines,
  routinesToRemove,
} from "../src/lib/program-actions.ts";

const ou = programById("ou")!;
const hk = programById("hk")!;

/** Routines as records with ids, the way the store hands them over. */
const stored = (routines: Routine[], prefix = "r") =>
  routines.map((payload, i) => ({ id: `${prefix}${i}`, payload }));

test("adding a programme gives its routines in a folder named after it", () => {
  const routines = programRoutines(ou);
  assert.equal(routines.length, 4);
  assert.deepEqual(
    routines.map((r) => [r.name, r.folder]),
    [
      ["Överkropp A", "Över/under 4 dagar"],
      ["Underkropp A", "Över/under 4 dagar"],
      ["Överkropp B", "Över/under 4 dagar"],
      ["Underkropp B", "Över/under 4 dagar"],
    ],
  );
  const bench = routines[0].exercises[0];
  assert.equal(bench.exerciseId, "builtin:bench-press");
  // The stored name is the catalogue's (English) one.
  assert.equal(bench.name, "Bench Press");
  assert.deepEqual(bench.repRange, { min: 5, max: 8 });
  assert.equal(bench.sets.length, 5);
  for (const set of bench.sets) {
    assert.equal(set.section, "working");
    assert.equal(set.weight, null);
    assert.equal(set.reps, null);
    assert.equal(set.done, false);
  }
  // Chins are a bodyweight lift.
  const chins = routines[2].exercises[2];
  assert.equal(chins.exerciseId, "builtin:pull-up");
  assert.equal(chins.sets[0].load, "bodyweight");
  // Every routine is a valid record.
  for (const r of routines) routineSchema.parse(r);
  // New ids throughout.
  const ids = routines.flatMap((r) =>
    r.exercises.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)]),
  );
  assert.equal(new Set(ids).size, ids.length);
});

test("a programme counts as added while each of its routines is in its folder", () => {
  assert.equal(isProgramAdded(ou, []), false);
  const added = stored(programRoutines(ou));
  assert.equal(isProgramAdded(ou, added), true);
  assert.equal(isProgramAdded(hk, added), false);
  // A routine moved out of the folder no longer counts.
  const moved = added.map((r, i) =>
    i === 1 ? { ...r, payload: { ...r.payload, folder: "Annat" } } : r,
  );
  assert.equal(isProgramAdded(ou, moved), false);
  // Deleted records do not count.
  assert.equal(
    isProgramAdded(
      ou,
      added.map((r) => ({ ...r, deleted: true })),
    ),
    false,
  );
});

test("removing a programme leaves a routine edited since it was added (Review Focus 5)", () => {
  const added = stored(programRoutines(ou));
  const index = added.findIndex((r) => r.payload.name === "Underkropp B");
  const edited = added.map((r, i) =>
    i === index
      ? {
          ...r,
          payload: {
            ...r.payload,
            exercises: r.payload.exercises.slice(1),
          },
        }
      : r,
  );
  const other = { id: "mine", payload: { name: "Ben", exercises: [] } };
  const ids = routinesToRemove(ou, [...edited, other]);
  assert.equal(ids.length, 3);
  assert.ok(!ids.includes(added[index].id));
  assert.ok(!ids.includes("mine"));
  // A typed target or rep range counts as a change too.
  const target = added.map((r, i) =>
    i === 0
      ? {
          ...r,
          payload: {
            ...r.payload,
            exercises: r.payload.exercises.map((e, j) =>
              j === 0
                ? {
                    ...e,
                    sets: e.sets.map((s) => ({
                      ...s,
                      weight: 80,
                      target: true,
                    })),
                  }
                : e,
            ),
          },
        }
      : r,
  );
  assert.equal(routinesToRemove(ou, target).length, 3);
  // Untouched copies all go, new ids and all.
  assert.equal(routinesToRemove(ou, added).length, 4);
  // Also after a round trip through the record schema (a save and a sync).
  const parsed = added.map((r) => ({
    ...r,
    payload: routineSchema.parse(JSON.parse(JSON.stringify(r.payload))),
  }));
  assert.equal(routinesToRemove(ou, parsed).length, 4);
  // `added` narrows the choice to the routines this tap added.
  assert.deepEqual(
    routinesToRemove(ou, added, new Map([[added[0].id, "Överkropp A"]])),
    [added[0].id],
  );
});

test("making a plan from a programme fills its weeks with the new routines", () => {
  const ids = { "Helkropp A": "A", "Helkropp B": "B" };
  const plan = programPlanDraft(hk, ids, "2026-11-19");
  assert.equal(plan.name, "Helkropp A/B");
  assert.equal(plan.cycleWeeks, 2);
  assert.deepEqual(plan.template[0], ["A", null, "B", null, "A", null, null]);
  assert.deepEqual(plan.template[1], ["B", null, "A", null, "B", null, null]);
  assert.equal(plan.startDate, "2026-11-19");
  assert.equal(plan.endDate, "2027-01-13");
  planSchema.parse(plan);
  // It follows the plan it is given (the next free period).
  const after = programPlanDraft(hk, ids, "2026-11-19", {
    startDate: "2026-12-14",
    endDate: "2027-02-07",
  });
  assert.equal(after.startDate, "2026-12-14");
  assert.equal(after.endDate, "2027-02-07");
  // A routine that is missing leaves its days empty.
  const partial = programPlanDraft(hk, { "Helkropp A": "A" }, "2026-11-19");
  assert.deepEqual(partial.template[0], [
    "A",
    null,
    null,
    null,
    "A",
    null,
    null,
  ]);
});
