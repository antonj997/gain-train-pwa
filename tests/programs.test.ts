import test from "node:test";
import assert from "node:assert/strict";
import { catalogueById } from "../src/data/catalogue.ts";
import { musclesLookup } from "../src/data/exercise-muscles.ts";
import {
  PROGRAMS,
  PROGRAM_JUDGED,
  programById,
  programRange,
  programWeeklySets,
} from "../src/data/programs.ts";
import { exerciseDisplayName } from "../src/lib/exercise-name.ts";

const musclesOf = musclesLookup({});

test("every programme exercise is in the catalogue", () => {
  for (const p of PROGRAMS)
    for (const r of p.routines)
      for (const e of r.exercises)
        assert.ok(catalogueById.has(e.exerciseId), `${p.id}: ${e.exerciseId}`);
});

test("five programmes and thirteen routines, named as the spec names them", () => {
  assert.deepEqual(
    PROGRAMS.map((p) => p.id),
    ["hk", "ou", "tdb", "gs", "hm"],
  );
  assert.deepEqual(
    PROGRAMS.map((p) => p.title),
    [
      "Helkropp A/B",
      "Över/under 4 dagar",
      "Tryck/drag/ben",
      "Grundstyrka 3 dagar",
      "Hemma med hantlar",
    ],
  );
  assert.deepEqual(
    PROGRAMS.flatMap((p) => p.routines.map((r) => r.name)),
    [
      "Helkropp A",
      "Helkropp B",
      "Överkropp A",
      "Underkropp A",
      "Överkropp B",
      "Underkropp B",
      "Tryck",
      "Drag",
      "Ben",
      "Styrka A",
      "Styrka B",
      "Hemma A",
      "Hemma B",
    ],
  );
});

test("the routines hold the spec's exercises, sets and rep ranges", () => {
  const ou = programById("ou")!;
  const lowerB = ou.routines.find((r) => r.name === "Underkropp B")!;
  assert.deepEqual(
    lowerB.exercises.map(
      (e) =>
        `${exerciseDisplayName(e.exerciseId, "", "sv")} ${e.sets} × ${e.repRange.min}–${e.repRange.max}`,
    ),
    [
      "Marklyft 3 × 3–5",
      "Benpress 3 × 10–15",
      "Höftlyft 3 × 8–12",
      "Liggande lårcurl 3 × 10–15",
      "Stående vadpress 4 × 10–15",
      "Hängande benlyft 3 × 8–15",
    ],
  );
  const hm = programById("hm")!;
  assert.equal(hm.routines[1].exercises[1].exerciseId, "builtin:push-up");
  assert.deepEqual(hm.routines[1].exercises[1].repRange, { min: 8, max: 20 });
});

test("weekly hard sets per main muscle are computed from the mapping", () => {
  assert.equal(PROGRAM_JUDGED.length, 12);
  const ou = programById("ou")!;
  assert.deepEqual(programRange(ou, musclesOf), [6.5, 17.5]);
  const sets = programWeeklySets(ou, musclesOf);
  assert.equal(sets.rearDelts, 6.5);
  assert.equal(sets.glutes, 17.5);
  assert.equal(
    programById("tdb")!.week.every((w) => w.perWeek === 2),
    true,
  );
  assert.equal(
    programById("hk")!.week.every((w) => w.perWeek === 1.5),
    true,
  );
});

test("every schedule row has seven days; the A/B programmes repeat over two weeks", () => {
  for (const p of PROGRAMS) {
    for (const row of p.schedule) assert.equal(row.length, 7, p.id);
    for (const cell of p.schedule.flat())
      if (cell !== null)
        assert.ok(
          p.routines.some((r) => r.name === cell),
          `${p.id}: ${cell}`,
        );
  }
  const hk = programById("hk")!;
  assert.equal(hk.schedule.length, 2);
  assert.deepEqual(hk.schedule[0], [
    "Helkropp A",
    null,
    "Helkropp B",
    null,
    "Helkropp A",
    null,
    null,
  ]);
  assert.deepEqual(hk.schedule[1], [
    "Helkropp B",
    null,
    "Helkropp A",
    null,
    "Helkropp B",
    null,
    null,
  ]);
  assert.deepEqual(programById("ou")!.schedule, [
    [
      "Överkropp A",
      "Underkropp A",
      null,
      "Överkropp B",
      "Underkropp B",
      null,
      null,
    ],
  ]);
  assert.deepEqual(programById("tdb")!.schedule, [
    ["Tryck", "Drag", "Ben", "Tryck", "Drag", "Ben", null],
  ]);
});
