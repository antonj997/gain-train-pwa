import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ElementType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { setCurrentLanguage as setEsmLanguage } from "../src/i18n/index.ts";
import { musclesLookup } from "../src/data/exercise-muscles.ts";
import { PROGRAMS, programById } from "../src/data/programs.ts";
import { programSub } from "../src/lib/program-view.ts";
import { loadComponent, loadModule } from "./helpers/render";

const musclesOf = musclesLookup({});
const ProgramList = await loadComponent("@/components/library/ProgramList.tsx");
const { ProgramSheetBody } = await loadModule<{
  ProgramSheetBody: ElementType;
}>("@/components/library/ProgramSheet.tsx");

const list = (chip: string, added: string[] = []) =>
  renderToStaticMarkup(
    createElement(ProgramList, {
      programs: PROGRAMS,
      chip,
      onChip: () => {},
      isAdded: (p: { id: string }) => added.includes(p.id),
      busy: false,
      onToggle: () => {},
      onOpen: () => {},
    }),
  );

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

// The loaded components reach the i18n module through require, a copy of
// its own; both copies switch language.
const cjs = createRequire(import.meta.url)("../src/i18n/index.ts") as {
  setCurrentLanguage: typeof setEsmLanguage;
};
const setCurrentLanguage = (language: "en" | "sv") => {
  setEsmLanguage(language);
  cjs.setCurrentLanguage(language);
};

/** Runs a check in Swedish. */
const inSwedish = (check: () => void) => {
  setCurrentLanguage("sv");
  try {
    check();
  } finally {
    setCurrentLanguage("en");
  }
};

test("Upptäck lists five programmes, each with a +", () =>
  inSwedish(() => {
    const html = list("all");
    assert.equal(html.split('class="row program-row"').length - 1, 5);
    assert.match(text(html), /Över\/under 4 dagar Van · 4 dagar · 4 rutiner/);
    assert.match(
      html,
      /aria-pressed="false" aria-label="Lägg till Över\/under 4 dagar i Mina rutiner"/,
    );
    assert.match(text(html), /Färdiga program från Gain Train/);
    // The chips, Alla first.
    assert.match(
      text(html),
      /Alla Helkropp Över\/under Tryck\/drag\/ben Styrka Hemma/,
    );
    // Added reads ✓ and is pressed.
    assert.match(
      list("all", ["ou"]),
      /aria-pressed="true" aria-label="Lägg till Över\/under 4 dagar i Mina rutiner"/,
    );
  }));

test("the chip Styrka leaves one programme", () =>
  inSwedish(() => {
    const html = list("strength");
    assert.equal(html.split('class="row program-row"').length - 1, 1);
    assert.match(text(html), /Grundstyrka 3 dagar/);
  }));

test("the programme sheet: the range, twelve muscles lowest first, the routines", () =>
  inSwedish(() => {
    const ou = programById("ou")!;
    const html = renderToStaticMarkup(
      createElement(ProgramSheetBody, { program: ou, musclesOf }),
    );
    assert.match(text(html), /6,5–17,5 · riktmärke 10–20/);
    const values = [...html.matchAll(/<dd>([^<]+)<\/dd>/g)].map((m) =>
      Number(m[1].replace(",", ".")),
    );
    assert.equal(values.length, 12);
    assert.deepEqual(
      values,
      [...values].sort((a, b) => a - b),
    );
    assert.equal(values[0], 6.5);
    assert.equal(values.at(-1), 17.5);
    assert.match(text(html), /Underkropp B .*Marklyft 3 × 3–5/);
    assert.equal(programSub(ou), "Van · 4 dagar: mån, tis, tor, fre · ~60 min");
  }));
