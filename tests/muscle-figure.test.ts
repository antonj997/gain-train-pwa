import test from "node:test";
import assert from "node:assert/strict";
import { MUSCLES, type ExerciseMuscles } from "../src/data/muscles.ts";
import {
  ICON_ZONES,
  exerciseMapFills,
  figureView,
  pickFill,
  weekMapFills,
  zoneLevel,
  type IconZone,
} from "../src/lib/muscle-figure.ts";

// Mappings as the catalogue gives them: main muscles 1, helping 0.5.
const EXERCISES: Record<string, [ExerciseMuscles, "front" | "back"]> = {
  "bench press": [
    { chest: 1, upperChest: 0.5, frontDelts: 0.5, triceps: 0.5 },
    "front",
  ],
  "lat pulldown": [{ lats: 1, upperBack: 0.5, biceps: 0.5 }, "back"],
  // Quads and glutes tie as main muscles; the glutes and lower back only
  // show from behind.
  squat: [{ quads: 1, glutes: 1, adductors: 0.5, lowerBack: 0.5 }, "back"],
  "overhead press": [
    { frontDelts: 1, sideDelts: 0.5, triceps: 0.5, traps: 0.5 },
    "front",
  ],
  curl: [{ biceps: 1, brachialis: 0.5, forearms: 0.5 }, "front"],
  "triceps pushdown": [{ triceps: 1 }, "back"],
  "calf raise": [{ calves: 1, soleus: 0.5 }, "back"],
  crunch: [{ abs: 1, obliques: 0.5 }, "front"],
  "romanian deadlift": [
    { hamstrings: 1, glutes: 1, adductors: 0.5, lowerBack: 0.5 },
    "back",
  ],
  "farmer's carry": [
    { forearms: 1, traps: 1, obliques: 0.5, abs: 0.5 },
    "back",
  ],
};

for (const [name, [muscles, view]] of Object.entries(EXERCISES))
  test(`the small icon shows ${name} from the ${view}`, () => {
    assert.equal(figureView(muscles), view);
  });

test("an exercise with no muscles is drawn from the front", () => {
  assert.equal(figureView({}), "front");
});

test("only main muscles decide the view while they lean one way", () => {
  // Main triceps (back) wins over helping chest (front only).
  assert.equal(figureView({ triceps: 1, chest: 0.5, upperChest: 0.5 }), "back");
  // Neutral main muscles: the helping lats decide.
  assert.equal(figureView({ forearms: 1, lats: 0.5 }), "back");
});

test("a zone takes the level of its most trained muscle", () => {
  const squat: ExerciseMuscles = { quads: 1, glutes: 1, adductors: 0.5 };
  assert.equal(zoneLevel(squat, "thighs"), 1);
  assert.equal(zoneLevel(squat, "glutes"), 1);
  assert.equal(zoneLevel(squat, "calves"), 0);
  assert.equal(zoneLevel({ adductors: 0.5 }, "thighs"), 0.5);
  assert.equal(zoneLevel({ abductors: 0.5, glutes: 1 }, "glutes"), 1);
  assert.equal(zoneLevel({ sideDelts: 0.5 }, "shoulders"), 0.5);
});

test("the icon zones hold every muscle exactly once", () => {
  const seen = Object.values(ICON_ZONES).flat();
  assert.deepEqual([...seen].sort(), [...MUSCLES].sort());
  assert.equal(new Set(seen).size, seen.length);
  for (const zone of Object.keys(ICON_ZONES) as IconZone[])
    assert.ok(ICON_ZONES[zone].length > 0, zone);
});

test("a shape takes the fill of its highest-ranked muscle", () => {
  const fills = { chest: "red", upperChest: "pink" };
  assert.equal(pickFill(["chest", "upperChest"], fills), "red");
  assert.equal(
    pickFill(["chest", "upperChest"], fills, { chest: 0.5, upperChest: 1 }),
    "pink",
  );
  assert.equal(
    pickFill(["chest", "upperChest"], { upperChest: "pink" }),
    "pink",
  );
  assert.equal(pickFill(["lats"], fills), undefined);
});

test("an exercise's map: main muscles red over helping ones", () => {
  assert.deepEqual(exerciseMapFills({ chest: 1, triceps: 0.5 }), {
    fills: { chest: "var(--gt-map-main)", triceps: "var(--gt-map-help)" },
    rank: { chest: 2, triceps: 1 },
  });
  assert.deepEqual(exerciseMapFills({}), { fills: {}, rank: {} });
});

test("a week's map: each muscle in its heat step, ranked by its sets", () => {
  assert.deepEqual(
    weekMapFills({ chest: 0.5, lats: 4.5, quads: 5, glutes: 12, calves: 21 }),
    {
      fills: {
        chest: "var(--gt-heat-1)",
        lats: "var(--gt-heat-1)",
        glutes: "var(--gt-heat-3)",
        quads: "var(--gt-heat-2)",
        calves: "var(--gt-heat-5)",
      },
      rank: { chest: 0.5, lats: 4.5, glutes: 12, quads: 5, calves: 21 },
    },
  );
});
