import test from "node:test";
import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadComponent, loadModule } from "./helpers/render";

const MuscleMap = await loadComponent("@/components/muscles/MuscleMap.tsx");
const MuscleIcon = await loadComponent("@/components/muscles/MuscleIcon.tsx");
const EquipmentIcon = await loadComponent(
  "@/components/muscles/EquipmentIcon.tsx",
);
const { EQUIPMENT_ICONS } = await loadModule<{
  EQUIPMENT_ICONS: readonly string[];
}>("@/components/muscles/equipment-shapes.ts");

const count = (html: string, text: string) => html.split(text).length - 1;
const ids = (html: string) =>
  [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
const refs = (html: string) =>
  [...html.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
const svgs = (html: string) => html.split("</svg>").filter(Boolean);

const bench = {
  fills: {
    chest: "var(--gt-map-main)",
    upperChest: "var(--gt-map-help)",
    triceps: "var(--gt-map-help)",
  },
  rank: { chest: 1, upperChest: 0.5, triceps: 0.5 },
};

test("the muscle map draws both sides as one labelled image", () => {
  const html = renderToStaticMarkup(
    createElement(MuscleMap, { ...bench, figure: "m", title: "Bench press" }),
  );
  assert.equal(count(html, "<svg"), 1);
  assert.match(html, /viewBox="13 0 214 218"/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Bench press"/);
  assert.doesNotMatch(html, /aria-hidden/);
  assert.match(html, /translate\(10 0\)/);
  assert.match(html, /translate\(130 0\)/);
  // Each half is drawn and mirrored.
  assert.equal(count(html, 'transform="translate(100 0) scale(-1 1)"'), 2);
  assert.match(html, /fill="var\(--gt-map-main\)"/);
  assert.match(html, /fill="var\(--gt-map-help\)"/);
  assert.match(html, /fill="var\(--gt-map-off\)"/);
  assert.match(html, /fill="var\(--gt-map-fig\)"/);
  // The rounding filter and three clip paths, all referenced.
  assert.equal(count(html, "<filter"), 1);
  assert.equal(count(html, "<clipPath"), 3);
  for (const ref of refs(html)) assert.ok(ids(html).includes(ref), ref);
});

test("a muscle map with no title is decorative", () => {
  const html = renderToStaticMarkup(
    createElement(MuscleMap, { fills: {}, figure: "f" }),
  );
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /role="img"/);
  assert.match(html, /data-figure="f"/);
  // Nothing trained: no shape takes a fill of its own.
  assert.doesNotMatch(html, /--gt-map-main|--gt-map-help/);
});

test("a shape shared by two muscles takes the higher-ranked one's colour", () => {
  const html = renderToStaticMarkup(
    createElement(MuscleMap, {
      fills: { chest: "red", upperChest: "pink" },
      rank: { chest: 0.5, upperChest: 1 },
      figure: "m",
    }),
  );
  assert.match(html, /fill="pink"/);
});

test("two muscle maps on one page get their own filter and clip ids", () => {
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(MuscleMap, { ...bench, figure: "m" }),
      createElement(MuscleMap, { ...bench, figure: "f" }),
    ),
  );
  const all = ids(html);
  assert.equal(all.length, 8);
  assert.equal(new Set(all).size, all.length);
  for (const id of all) assert.match(id, /^[A-Za-z][\w-]*$/, id);
  // Each map refers only to its own ids.
  const [first, second] = svgs(html);
  for (const ref of refs(first)) assert.ok(ids(first).includes(ref), ref);
  for (const ref of refs(second)) assert.ok(ids(second).includes(ref), ref);
});

test("the muscle icon draws the side of the main muscles in tone colours", () => {
  const curl = renderToStaticMarkup(
    createElement(MuscleIcon, {
      muscles: { biceps: 1, forearms: 0.5 },
      size: 34,
    }),
  );
  assert.match(curl, /viewBox="0 0 24 24"/);
  assert.match(curl, /width="34"/);
  assert.match(curl, /aria-hidden="true"/);
  assert.match(curl, /data-view="front"/);
  assert.match(curl, /data-zone="chest"/);
  // Both arms: the upper arm main, the forearm helping.
  assert.equal(count(curl, 'fill="var(--mi-main'), 2);
  assert.equal(count(curl, 'fill="var(--mi-help'), 2);
  assert.match(curl, /<g fill="var\(--mi-body/);
  assert.match(curl, /fill="var\(--mi-off/);

  const pushdown = renderToStaticMarkup(
    createElement(MuscleIcon, { muscles: { triceps: 1 } }),
  );
  assert.match(pushdown, /data-view="back"/);
  assert.match(pushdown, /width="22"/);
  assert.match(pushdown, /data-zone="midBack"/);
  assert.doesNotMatch(pushdown, /data-zone="chest"/);
});

test("the cardio icon is the untrained front figure with a heart", () => {
  const html = renderToStaticMarkup(
    createElement(MuscleIcon, {
      muscles: { quads: 1, lats: 0.5 },
      cardio: true,
      size: 22,
    }),
  );
  assert.match(html, /data-view="cardio"/);
  assert.match(html, /data-zone="chest"/);
  assert.doesNotMatch(html, /mi-help/);
  // Only the heart is in the main colour.
  assert.equal(count(html, 'fill="var(--mi-main'), 1);
});

test("every equipment glyph renders in the current colour", () => {
  assert.equal(EQUIPMENT_ICONS.length, 7);
  for (const kind of EQUIPMENT_ICONS) {
    const html = renderToStaticMarkup(
      createElement(EquipmentIcon, { kind, size: 22 }),
    );
    assert.match(html, /stroke="currentColor"/, kind);
    assert.match(html, /viewBox="0 0 24 24"/, kind);
    assert.match(html, new RegExp(`data-equipment="${kind}"`), kind);
    assert.ok(count(html, "<path") + count(html, "<circle") >= 2, kind);
  }
});
