import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogue } from "../src/data/catalogue.ts";
import {
  MOVEMENT_BY_NAME,
  categoryTone,
  movementIcon,
} from "../src/lib/movement-icon.ts";
import {
  MOVEMENTS,
  MOVEMENT_SHAPES,
} from "../src/components/icons/exercise/paths.ts";

test("every catalogue exercise has an explicit movement", () => {
  const missing = catalogue.filter((e) => !MOVEMENT_BY_NAME[e.name]);
  assert.deepEqual(
    missing.map((e) => e.name),
    [],
  );
  for (const e of catalogue)
    assert.ok(MOVEMENTS.includes(movementIcon({ id: e.id })), e.name);
});

test("the name map lists only catalogue exercises", () => {
  const names = new Set(catalogue.map((e) => e.name));
  assert.deepEqual(
    Object.keys(MOVEMENT_BY_NAME).filter((name) => !names.has(name)),
    [],
  );
});

test("known exercises show their movement", () => {
  const cases: [string, string][] = [
    ["builtin:bench-press", "benchPress"],
    ["builtin:incline-dumbbell-press", "inclinePress"],
    ["builtin:cable-crossover", "chestFly"],
    ["builtin:push-up", "pushUp"],
    ["builtin:overhead-press", "overheadPress"],
    ["builtin:lateral-raise", "lateralRaise"],
    ["builtin:chin-up", "pullUp"],
    ["builtin:lat-pulldown", "latPulldown"],
    ["builtin:seated-cable-row", "row"],
    ["builtin:face-pull", "facePull"],
    ["builtin:romanian-deadlift", "hinge"],
    ["builtin:squat", "squat"],
    ["builtin:bulgarian-split-squat", "lunge"],
    ["builtin:leg-extension", "legExtension"],
    ["builtin:lying-leg-curl", "legCurl"],
    ["builtin:hip-thrust", "hipThrust"],
    ["builtin:hammer-curl", "curl"],
    ["builtin:rope-pushdown", "tricepsExtension"],
    ["builtin:plank", "plank"],
    ["builtin:farmer-carry", "carry"],
    ["builtin:treadmill", "run"],
    ["builtin:exercise-bike", "bike"],
    ["builtin:rowing-machine", "rower"],
    ["builtin:stair-climber", "stairs"],
    ["builtin:turkish-get-up", "dumbbell"],
  ];
  for (const [id, movement] of cases)
    assert.equal(movementIcon({ id }), movement, id);
});

test("custom exercises always get the dumbbell", () => {
  assert.equal(
    movementIcon({
      id: "7a1d2c3e-0000-4000-8000-0000000000c1",
      category: "Legs",
    }),
    "dumbbell",
  );
  assert.equal(
    movementIcon({ id: "shared:abc", category: "Cardio" }),
    "dumbbell",
  );
});

test("an unknown built-in falls back by equipment, then category", () => {
  assert.equal(
    movementIcon({ id: "builtin:new-thing", equipment: "cardio machine" }),
    "run",
  );
  assert.equal(
    movementIcon({ id: "builtin:new-thing", category: "Back" }),
    "row",
  );
  assert.equal(
    movementIcon({ id: "builtin:new-thing", category: "Other" }),
    "dumbbell",
  );
  assert.equal(movementIcon({ id: "builtin:new-thing" }), "dumbbell");
});

test("every icon is drawn and keeps to the 24px grid", () => {
  for (const [name, shapes] of Object.entries(MOVEMENT_SHAPES)) {
    assert.ok(shapes.length > 0, name);
    for (const shape of shapes) {
      const numbers =
        typeof shape === "string"
          ? (shape.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
          : [
              shape.cx - shape.r,
              shape.cy - shape.r,
              shape.cx + shape.r,
              shape.cy + shape.r,
            ];
      for (const n of numbers) assert.ok(n >= 0 && n <= 24, `${name}: ${n}`);
    }
  }
});

test("category tones", () => {
  assert.equal(categoryTone("Full body"), "full-body");
  assert.equal(categoryTone("Chest"), "chest");
  assert.equal(categoryTone("Other"), "other");
  assert.equal(categoryTone("Mobility"), "other");
  assert.equal(categoryTone(undefined), "other");
});

// The glyph must read on its circle: at least 3:1 in both themes.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("category tints keep the glyph at 3:1 or more in both themes", () => {
  const css = readFileSync(
    new URL("../src/styles/tokens.css", import.meta.url),
    "utf8",
  );
  const block = (selector: string) =>
    css.slice(
      css.indexOf(selector + " {"),
      css.indexOf("}", css.indexOf(selector + " {")),
    );
  const tones = [
    "chest",
    "back",
    "shoulders",
    "arms",
    "legs",
    "glutes",
    "core",
    "cardio",
    "full-body",
    "other",
  ];
  for (const selector of [":root", ".dark"]) {
    const text = block(selector);
    for (const tone of tones) {
      const get = (part: string) =>
        text.match(
          new RegExp(`--gt-cat-${tone}-${part}: (#[0-9a-f]{6});`),
        )?.[1];
      const bg = get("bg");
      const fg = get("fg");
      assert.ok(bg && fg, `${selector} ${tone}`);
      assert.ok(
        contrast(fg!, bg!) >= 3,
        `${selector} ${tone}: ${contrast(fg!, bg!).toFixed(2)}`,
      );
    }
  }
});
