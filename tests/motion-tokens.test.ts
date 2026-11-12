import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EASE, MOTION } from "../src/lib/motion";

const tokens = readFileSync(
  new URL("../src/styles/tokens.css", import.meta.url),
  "utf8",
);
const root = tokens.slice(0, tokens.indexOf(".dark {"));
const camel = (name: string) =>
  name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const squash = (value: string) => value.replace(/\s+/g, "");

test("every --gt-dur-* token is the same number in motion.ts", () => {
  const durations = [...root.matchAll(/--gt-dur-([a-z-]+):\s*(\d+)ms;/g)];
  assert.ok(durations.length >= 15);
  for (const [, name, ms] of durations) {
    const key = name === "fade" ? "reduced" : camel(name);
    assert.equal(
      MOTION[key as keyof typeof MOTION],
      Number(ms),
      `--gt-dur-${name} vs MOTION.${key}`,
    );
  }
  assert.equal(
    MOTION.page,
    Number(/--gt-page-duration:\s*(\d+)ms/.exec(root)?.[1]),
  );
});

test("every --gt-ease-* token is the same curve in motion.ts", () => {
  const curves = [...root.matchAll(/--gt-ease-([a-z]+):\s*([^;]+);/g)];
  assert.ok(curves.length >= 5);
  for (const [, name, curve] of curves)
    assert.equal(
      squash(EASE[name as keyof typeof EASE]),
      squash(curve),
      `--gt-ease-${name}`,
    );
});

test("the sheet, banner and list rows match the v5 motion table", () => {
  assert.deepEqual(
    [MOTION.sheetIn, MOTION.sheetOut, MOTION.scrim],
    [340, 240, 200],
  );
  assert.deepEqual([MOTION.bannerIn, MOTION.bannerOut], [220, 180]);
  assert.deepEqual([MOTION.rowIn, MOTION.rowOut], [200, 240]);
  assert.equal(EASE.sheet, "cubic-bezier(0.32, 0.72, 0, 1)");
  assert.equal(EASE.collapse, "cubic-bezier(0.3, 0, 0.2, 1)");
  assert.equal(MOTION.reduced, 120);
});
