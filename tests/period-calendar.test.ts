import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Plan } from "../src/data/model";
import { periodColumns, periodLabels } from "../src/lib/period-calendar";
import { setCurrentLanguage } from "../src/i18n";
import { loadComponent } from "./helpers/render";

const row = (...cells: (string | null)[]) =>
  Array.from({ length: 7 }, (_, i) => cells[i] ?? null);
const R = "6f1d2c3e-0000-4000-8000-000000000001";
/** Vinterblock: 21 Dec – 14 Feb, 8 weeks, 7 + 1 (deload in the last week). */
const winter: Plan = {
  name: "Vinterblock",
  startDate: "2026-12-21",
  endDate: "2027-02-14",
  cycleWeeks: 8,
  template: Array.from({ length: 8 }, () => row(R, null, null, R, null, R)),
  weekKinds: [...Array(7).fill("normal"), "deload"],
  overrides: {},
  goalIds: [],
};

test("21 Dec – 14 Feb gives 8 columns starting on Monday 21 Dec", () => {
  const columns = periodColumns("2026-12-21", "2027-02-14");
  assert.equal(columns.length, 8);
  assert.equal(columns[0].weekStart, "2026-12-21");
  assert.deepEqual(columns[0].days.slice(0, 2), ["2026-12-21", "2026-12-22"]);
  assert.equal(columns[7].days[6], "2027-02-14");
  // A period that starts midweek still starts its column on the Monday.
  assert.equal(
    periodColumns("2026-12-23", "2026-12-30")[0].weekStart,
    "2026-12-21",
  );
  assert.equal(periodColumns("2026-12-23", "2026-12-30").length, 2);
});

test('the labels put "v. 1" on the first column and "deload" on the 8th for 7 + 1', () => {
  setCurrentLanguage("sv");
  try {
    // Before the start: no "nu".
    assert.deepEqual(periodLabels(winter, "2026-11-19"), [
      { column: 0, text: "v. 1" },
      { column: 7, text: "deload" },
    ]);
  } finally {
    setCurrentLanguage("en");
  }
});

test('"nu" sits on the column that holds today', () => {
  setCurrentLanguage("sv");
  try {
    assert.deepEqual(periodLabels(winter, "2027-01-14"), [
      { column: 0, text: "v. 1" },
      { column: 3, text: "nu" },
      { column: 7, text: "deload" },
    ]);
    // Too close to another label: "nu" wins, the neighbour gives way.
    assert.deepEqual(periodLabels(winter, "2026-12-29"), [
      { column: 1, text: "nu" },
      { column: 7, text: "deload" },
    ]);
  } finally {
    setCurrentLanguage("en");
  }
});

test("the period calendar draws one 12 px square per day with the given states", async () => {
  const PlanPeriodCalendar = await loadComponent(
    "@/components/plan/PlanPeriodCalendar.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(PlanPeriodCalendar, {
      start: winter.startDate,
      end: winter.endDate,
      label: "Vinterblock",
      cell: (date: string) => ({
        planned: date === "2027-02-08",
        deload: date >= "2027-02-08",
        today: date === "2026-12-24",
      }),
      labels: [{ column: 0, text: "v. 1" }],
      legend: ["planned", "deload"],
      rowGap: 2,
    }),
  );
  assert.equal(html.match(/data-date="/g)?.length, 56);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Vinterblock"/);
  assert.match(html, /class="heatmap period-calendar is-tight"/);
  assert.match(html, /is-planned[^"]*is-deload"[^>]*data-date="2027-02-08"/);
  assert.match(html, /[^"]*is-deload-week"[^>]*data-date="2027-02-09"/);
  assert.match(html, /is-today-dot[^"]*"[^>]*data-date="2026-12-24"/);
  assert.match(html, /--hm-cols:8/);
  assert.match(html, />v\. 1</);
});
