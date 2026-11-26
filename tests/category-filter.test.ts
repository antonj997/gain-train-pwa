import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogue } from "../src/data/catalogue";
import { CATEGORY_CHIPS, matchesChip } from "../src/lib/category-filter";
import { discoverPath, newPlanPath, plansTabPath } from "../src/lib/routes";
import { loadComponent } from "./helpers/render";

const byName = (name: string) => {
  const entry = catalogue.find((e) => e.name === name);
  assert.ok(entry, name);
  return { ...entry, custom: false };
};

test("the chip row's order, with Sport to come before Mine (P6)", () => {
  assert.deepEqual(
    [...CATEGORY_CHIPS],
    [
      "all",
      "Legs",
      "Glutes",
      "Chest",
      "Back",
      "Shoulders",
      "Arms",
      "Core",
      "mine",
    ],
  );
});

test("matchesChip: a category matches the main one and the others it trains", () => {
  const squat = byName("Squat");
  assert.equal(matchesChip(squat, "Legs"), true);
  assert.equal(matchesChip(squat, "Chest"), false);
  assert.equal(matchesChip(squat, "all"), true);
  // A row whose other categories include Legs.
  const row = {
    category: "Back",
    categories: ["Legs", "Glutes"],
    custom: false,
  };
  assert.equal(matchesChip(row, "Legs"), true);
  assert.equal(matchesChip(row, "Glutes"), true);
  assert.equal(matchesChip(row, "Arms"), false);
});

test("matchesChip: Mine matches your own exercises only", () => {
  assert.equal(matchesChip(byName("Squat"), "mine"), false);
  assert.equal(matchesChip({ category: "Core", custom: true }, "mine"), true);
  assert.equal(matchesChip({ category: "Core" }, "mine"), false);
});

test("CategoryChips: one scrolling row of 44px filter chips, pressed on the chosen one", async () => {
  const CategoryChips = await loadComponent(
    "../src/components/ui/CategoryChips.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(CategoryChips, { value: "Legs", onChange() {} }),
  );
  assert.match(html, /class="facet-chips category-chips"/);
  assert.equal(html.split('class="filter-chip"').length - 1, 9);
  assert.match(html, /aria-pressed="true"[^>]*>Legs</);
  assert.match(html, />All</);
  assert.match(html, />Core</);
  assert.match(html, />Mine</);
  assert.equal(html.split('aria-pressed="true"').length - 1, 1);
  const css = readFileSync(
    new URL("../src/styles/components.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.filter-chip\s*\{[^}]*min-height:\s*44px/);
});

test("v6 routes", () => {
  assert.equal(discoverPath(), "/library?view=discover");
  assert.equal(plansTabPath(), "/library?tab=plans");
  assert.equal(newPlanPath(), "/library?tab=plans&new=plan");
  assert.equal(newPlanPath("hk"), "/library?tab=plans&new=plan&program=hk");
});

test("i18n has one anchor per phase, in order, at the end of both catalogues", () => {
  const anchors = [
    "// ---- v6 P1 Passet ----",
    "// ---- v6 P2 Kalender ----",
    "// ---- v6 P3 Muskler ----",
    "// ---- v6 P4 Bibliotek ----",
    "// ---- v6 P5 Inställningar ----",
    "// ---- v6 P6 Sport ----",
  ];
  for (const file of ["en", "sv"]) {
    const source = readFileSync(
      new URL(`../src/i18n/${file}.ts`, import.meta.url),
      "utf8",
    );
    let at = 0;
    for (const anchor of anchors) {
      const found = source.indexOf(anchor + "\n", at);
      assert.ok(found > at, `${file}: ${anchor} in order`);
      assert.equal(
        source.split(anchor).length - 1,
        1,
        `${file}: ${anchor} once`,
      );
      at = found;
    }
    // Until a phase adds keys, each anchor is followed by a blank line and the
    // last one by the catalogue's end (Prettier drops a blank line there).
    const tail = source.slice(at + anchors[5].length).trim();
    assert.match(
      tail,
      /^\}( satisfies Messages)?;$/,
      `${file}: the anchors end the catalogue`,
    );
  }
});
