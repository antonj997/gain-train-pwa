import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RecordDoc } from "../src/data/model.ts";
import { MUSCLES_BY_NAME } from "../src/data/exercise-muscles.ts";
import { categoryTone, exerciseIcon } from "../src/lib/exercise-icon.ts";
import * as useData from "../src/contexts/useData.ts";
import { loadComponent } from "./helpers/render";
import { EQUIPMENT_SHAPES } from "../src/components/muscles/equipment-shapes.ts";

const own = (id: string, payload: Record<string, unknown>): RecordDoc =>
  ({
    id,
    kind: "exercise",
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted: false,
    payload: { name: id, note: "", favourite: false, ...payload },
  }) as RecordDoc;

const records: Record<string, RecordDoc> = {
  plain: own("plain", { category: "Chest" }),
  kettle: own("kettle", { category: "Legs", icon: "kettlebell" }),
  newer: own("newer", { category: "Legs", icon: "sled" }),
  body: own("body", {
    category: "Back",
    icon: "body",
    muscles: { lats: 1, biceps: 0.5 },
  }),
  derived: own("derived", { category: "Arms", icon: "body" }),
  run: own("run", { category: "Cardio", icon: "body" }),
};

test("built-in exercises show their muscles, cardio the heart figure", () => {
  assert.deepEqual(exerciseIcon({}, "builtin:squat"), {
    kind: "muscles",
    muscles: MUSCLES_BY_NAME.Squat,
    cardio: false,
  });
  assert.deepEqual(exerciseIcon({}, "builtin:rowing-machine"), {
    kind: "muscles",
    muscles: {},
    cardio: true,
  });
  assert.equal(exerciseIcon({}, "builtin:treadmill").kind, "muscles");
});

test("own exercises show their equipment glyph, the dumbbell by default", () => {
  assert.deepEqual(exerciseIcon(records, "plain"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
  assert.deepEqual(exerciseIcon(records, "kettle"), {
    kind: "equipment",
    equipment: "kettlebell",
  });
  // A newer app's icon this version doesn't know.
  assert.deepEqual(exerciseIcon(records, "newer"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
});

test("an own exercise with the body icon shows its muscles", () => {
  assert.deepEqual(exerciseIcon(records, "body"), {
    kind: "muscles",
    muscles: { lats: 1, biceps: 0.5 },
    cardio: false,
  });
  // Nothing chosen: the muscles of its category.
  const derived = exerciseIcon(records, "derived");
  assert.equal(derived.kind, "muscles");
  assert.equal(derived.kind === "muscles" && derived.muscles.biceps, 1);
  assert.deepEqual(exerciseIcon(records, "run"), {
    kind: "muscles",
    muscles: {},
    cardio: true,
  });
});

test("shared and unknown exercises", () => {
  assert.deepEqual(exerciseIcon({}, "shared:abc", "Legs"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
  const unknown = exerciseIcon({}, "builtin:new-thing", "Legs");
  assert.equal(unknown.kind === "muscles" && unknown.muscles.quads, 1);
  assert.equal(
    exerciseIcon({}, "builtin:new-cardio", "Cardio").kind === "muscles",
    true,
  );
  assert.deepEqual(exerciseIcon({}, "builtin:new-thing", "Other"), {
    kind: "equipment",
    equipment: "dumbbell",
  });
});

test("v6: the machine glyph is the rails and the weight stack, without the lock pin", () => {
  const machine = EQUIPMENT_SHAPES.machine;
  const paths = machine.filter((s): s is string => typeof s === "string");
  // The two rails, three plates in the stack and the cable over it.
  assert.ok(paths.includes("M5 3V21") && paths.includes("M19 3V21"));
  assert.equal(paths.filter((d) => /^M8 \d+H16V\d+H8Z$/.test(d)).length, 3);
  assert.ok(paths.includes("M12 3V6"));
  // No pin: nothing crosses a plate or reaches past the rails.
  for (const d of paths) {
    const xs = [...d.matchAll(/[MLH]\s*([\d.]+)/g)].map((m) => Number(m[1]));
    for (const x of xs) assert.ok(x >= 5 && x <= 19, `${d} reaches x ${x}`);
  }
  assert.ok(!paths.some((d) => /^M8(\.5)? 1[0-9](\.5)?H1[56](\.5)?$/.test(d)));
  assert.equal(machine.length, 6);
});

test("category tones", () => {
  assert.equal(categoryTone("Full body"), "full-body");
  assert.equal(categoryTone("Chest"), "chest");
  assert.equal(categoryTone("Other"), "other");
  assert.equal(categoryTone("Mobility"), "other");
  assert.equal(categoryTone(undefined), "other");
});

const ExerciseAvatar = await loadComponent(
  "@/components/items/ExerciseAvatar.tsx",
  { "@/contexts/useData": useData },
);

const avatar = (exerciseId: string, size?: "md" | "lg") =>
  renderToStaticMarkup(
    createElement(
      useData.DataContext.Provider,
      { value: { state: { records } } as never },
      createElement(ExerciseAvatar, { exerciseId, size }),
    ),
  );

test("the avatar draws the muscle figure, the heart or the glyph", () => {
  const squat = avatar("builtin:squat");
  assert.match(squat, /class="ex-avatar"/);
  assert.match(squat, /data-tone="legs"/);
  // v6 (H4): a 44px circle with a 34px figure and 24px glyphs by default.
  assert.match(squat, /class="muscle-icon" width="34"/);
  assert.doesNotMatch(squat, /data-view="cardio"/);
  assert.match(avatar("builtin:squat", "lg"), /class="ex-avatar ex-avatar-lg"/);
  assert.match(avatar("builtin:squat", "lg"), /class="muscle-icon" width="50"/);
  assert.match(avatar("builtin:rowing-machine"), /data-view="cardio"/);
  const plain = avatar("plain");
  assert.match(plain, /data-tone="chest"/);
  assert.match(plain, /data-equipment="dumbbell"/);
  assert.match(plain, /width="24"/);
  assert.match(plain, /stroke-width="1.8"/);
  assert.match(avatar("kettle", "lg"), /data-equipment="kettlebell"/);
  assert.match(avatar("kettle", "lg"), /width="34"/);
  assert.match(avatar("body"), /data-tone="back"/);
  assert.match(avatar("body"), /class="muscle-icon"/);
});

test("the avatar circle is 44px (60px large)", () => {
  const css = readFileSync(
    new URL("../src/styles/items.css", import.meta.url),
    "utf8",
  );
  const rule = (selector: string) =>
    new RegExp(
      `(?:^|\\})\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`,
    ).exec(css.replace(/\/\*[\s\S]*?\*\//g, ""))?.[1] ?? "";
  assert.match(rule(".ex-avatar"), /width:\s*44px/);
  assert.match(rule(".ex-avatar"), /height:\s*44px/);
  assert.match(rule(".ex-avatar-lg"), /width:\s*60px/);
});

// --- H4: the dark avatar mixes. color-mix(in srgb, …) mixes the encoded
// channels, as mix() does here.
type Rgb = [number, number, number];
const hex = (value: string): Rgb =>
  [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
const mix = (a: Rgb, b: Rgb, share: number): Rgb =>
  a.map((v, i) => v * share + b[i] * (1 - share)) as Rgb;
const luminance = (c: Rgb) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("dark avatars: body/circle at least 4:1 and untrained/circle 3:1 in every tone", () => {
  const tokens = readFileSync(
    new URL("../src/styles/tokens.css", import.meta.url),
    "utf8",
  );
  const dark = tokens.slice(tokens.indexOf(".dark {"));
  const token = (name: string) => {
    const found = new RegExp(`--gt-${name}:\\s*(#[0-9a-f]{6});`, "i").exec(
      dark,
    )?.[1];
    assert.ok(found, name);
    return hex(found);
  };
  const muscles = readFileSync(
    new URL("../src/styles/muscles.css", import.meta.url),
    "utf8",
  );
  const block = /\.dark \.ex-avatar,[^{]*\{([^}]*)\}/.exec(muscles)?.[1] ?? "";
  const share = (name: string, other: string) => {
    const found = new RegExp(
      `--mi-${name}:\\s*color-mix\\(in srgb,\\s*var\\(--tone-fg\\) (\\d+)%,\\s*${other}\\)`,
    ).exec(block)?.[1];
    assert.ok(found, `--mi-${name} in the dark block`);
    return Number(found) / 100;
  };
  // Spec H4: the circle is the tone's background darkened by half; body 65 %,
  // untrained 50 %, helping 78 %, main the tone plus 15 % white.
  assert.match(
    block,
    /--mi-circle:\s*color-mix\(in srgb,\s*var\(--tone-bg\) 50%,\s*black\)/,
  );
  assert.equal(share("body", "var\\(--tone-bg\\)"), 0.65);
  assert.equal(share("off", "var\\(--tone-bg\\)"), 0.5);
  assert.equal(share("help", "var\\(--tone-bg\\)"), 0.78);
  assert.equal(share("main", "white"), 0.85);
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
  ];
  for (const tone of tones) {
    const fg = token(`cat-${tone}-fg`);
    const bg = token(`cat-${tone}-bg`);
    const circle = mix(bg, [0, 0, 0], 0.5);
    const body = contrast(mix(fg, bg, 0.65), circle);
    const off = contrast(mix(fg, bg, 0.5), circle);
    assert.ok(body >= 4, `${tone}: body/circle ${body.toFixed(2)}:1`);
    assert.ok(off >= 3, `${tone}: untrained/circle ${off.toFixed(2)}:1`);
  }
});
