import test from "node:test";
import assert from "node:assert/strict";
import { MUSCLES, isMuscle, type Muscle } from "../src/data/muscles.ts";
import { ICON_ZONES } from "../src/lib/muscle-figure.ts";
import { FIGURES } from "../src/components/muscles/detailed-geometry.ts";
import {
  ICON_BODY,
  ICON_HEART,
  ICON_ZONE_SHAPES,
} from "../src/components/muscles/icon-geometry.ts";

const LISTS = ["front", "frontArm", "back", "backArm"] as const;
const path = /^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/;

for (const [figure, geometry] of Object.entries(FIGURES)) {
  test(`every shape of the ${figure} map takes the colour of real muscles`, () => {
    for (const list of LISTS) {
      const ids = new Set<string>();
      for (const [id, muscles, d] of geometry[list]) {
        assert.ok(!ids.has(id), `${figure} ${list}: ${id} is listed once`);
        ids.add(id);
        assert.ok(muscles.length > 0, `${figure} ${list}: ${id} has muscles`);
        for (const muscle of muscles)
          assert.ok(isMuscle(muscle), `${figure} ${list}: ${id} → ${muscle}`);
        assert.match(d, path, `${figure} ${list}: ${id} is a path`);
      }
    }
  });

  test(`every muscle shows on the ${figure} map`, () => {
    const shown = new Set<Muscle>();
    for (const list of LISTS)
      for (const [, muscles] of geometry[list])
        for (const muscle of muscles) shown.add(muscle);
    for (const muscle of MUSCLES)
      assert.ok(shown.has(muscle), `${muscle} is on the ${figure} map`);
  });

  test(`the ${figure} figure's outlines are paths`, () => {
    for (const key of [
      "torsoFront",
      "torsoBack",
      "arm",
      "hand",
      "head",
    ] as const) {
      const value = geometry[key];
      const paths =
        typeof value === "string"
          ? [value]
          : [value.neck, ...(value.hair ? [value.hair] : [])];
      for (const d of paths) assert.match(d, path, `${figure} ${key}`);
    }
  });
}

test("the woman has a bob and the man does not", () => {
  assert.ok(FIGURES.f.head.hair);
  assert.equal(FIGURES.m.head.hair, undefined);
});

test("the small icon's two views together show every muscle", () => {
  const shown = new Set<Muscle>();
  for (const view of ["front", "back"] as const)
    for (const [zone, d] of ICON_ZONE_SHAPES[view]) {
      assert.match(d, path, `${view} ${zone}`);
      for (const muscle of ICON_ZONES[zone]) shown.add(muscle);
    }
  assert.deepEqual([...shown].sort(), [...MUSCLES].sort());
});

test("the small icon shows the chest and core from the front, the back and glutes from behind", () => {
  const zones = (view: "front" | "back") =>
    new Set(ICON_ZONE_SHAPES[view].map(([zone]) => zone));
  const front = zones("front");
  const back = zones("back");
  for (const zone of ["chest", "core"] as const) {
    assert.ok(front.has(zone), zone);
    assert.ok(!back.has(zone), zone);
  }
  for (const zone of ["traps", "midBack", "lowerBack", "glutes"] as const) {
    assert.ok(back.has(zone), zone);
    assert.ok(!front.has(zone), zone);
  }
  for (const zone of [
    "shoulders",
    "upperArm",
    "forearms",
    "thighs",
    "calves",
  ] as const) {
    assert.ok(front.has(zone) && back.has(zone), zone);
  }
});

test("the small icon stays on its 24 × 24 grid", () => {
  const numbers = [
    ...ICON_BODY,
    ICON_HEART,
    ...ICON_ZONE_SHAPES.front.map(([, d]) => d),
    ...ICON_ZONE_SHAPES.back.map(([, d]) => d),
  ].flatMap((d) => d.match(/-?\d+(\.\d+)?/g)!.map(Number));
  for (const n of numbers) assert.ok(n >= 0 && n <= 24, String(n));
});

test("the cardio heart is about 6 units wide, centred on the chest", () => {
  const xs = ICON_HEART.match(/-?\d+(\.\d+)?/g)!
    .map(Number)
    .filter((_, i) => i % 2 === 0);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  assert.ok(right - left >= 5.5 && right - left <= 6.5, `${right - left}`);
  assert.equal((left + right) / 2, 12);
});
