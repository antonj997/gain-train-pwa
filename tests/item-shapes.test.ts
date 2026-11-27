import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "./helpers/render";
import { dayCellClass } from "../src/components/items/day-cell.ts";
import { phaseSegments } from "../src/data/phase.ts";
import type { Plan } from "../src/data/model.ts";

test("a day cell's classes: trained wins over planned, today adds the ring", () => {
  assert.equal(dayCellClass({}, "week"), "day-cell is-week");
  assert.equal(
    dayCellClass({ trained: true, planned: true, today: true }, "month"),
    "day-cell is-month is-trained is-today",
  );
  assert.equal(
    dayCellClass({ planned: true }, "grid"),
    "day-cell is-grid is-planned",
  );
});

const plan: Plan = {
  name: "Strength",
  startDate: "2026-10-19",
  endDate: "2026-11-15",
  cycleWeeks: 2,
  template: [Array(7).fill(null), Array(7).fill(null)],
  overrides: {},
  goalIds: [],
  weekKinds: ["normal", "deload"],
};

test("phase segments: one per week, done before this week, deload weeks marked", () => {
  assert.deepEqual(
    phaseSegments(plan, "2026-11-04").map((s) => [s.week, s.state, s.deload]),
    [
      [1, "done", false],
      [2, "done", true],
      [3, "now", false],
      [4, "next", true],
    ],
  );
  assert.ok(phaseSegments(plan, "2026-10-01").every((s) => s.state === "next"));
  assert.ok(phaseSegments(plan, "2026-12-01").every((s) => s.state === "done"));
});

// ---- v6 H1: day states (Task 2.2)

const itemsCss = () =>
  readFileSync(new URL("../src/styles/items.css", import.meta.url), "utf8");
/** The body of the first rule whose selector list is exactly `selector`. */
const ruleBody = (css: string, selector: string) => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(
    plain,
  )?.[1];
};

test("a day cell's v6 states: missed, planned today, moved and the today dot", () => {
  assert.equal(
    dayCellClass({ missed: true }, "week"),
    "day-cell is-week is-missed",
  );
  assert.equal(
    dayCellClass({ planned: true, today: true, plannedToday: true }, "week"),
    "day-cell is-week is-planned is-today is-planned-today",
  );
  assert.equal(
    dayCellClass({ trained: true, moved: "left" }, "week"),
    "day-cell is-week is-trained has-moved-left",
  );
  assert.equal(
    dayCellClass({ planned: true, moved: "right" }, "week"),
    "day-cell is-week is-planned has-moved-right",
  );
  // The grid shows today as a dot, not a ring.
  assert.equal(
    dayCellClass({ today: true, todayDot: true }, "grid"),
    "day-cell is-grid is-today-dot",
  );
  assert.equal(
    dayCellClass({ trained: true, today: true, todayDot: true }, "grid"),
    "day-cell is-grid is-trained is-today-dot",
  );
  // Trained wins over missed.
  assert.equal(
    dayCellClass({ trained: true, missed: true }, "grid"),
    "day-cell is-grid is-trained",
  );
});

test("a planned day is a neutral ring; missed is dashed; today in the grid is a centred 4 px dot", () => {
  const css = itemsCss();
  const planned = ruleBody(css, ".day-cell.is-planned");
  assert.ok(planned);
  assert.match(planned, /--gt-line-control/);
  assert.doesNotMatch(planned, /--gt-done/);
  assert.doesNotMatch(
    ruleBody(css, ".day-cell.is-grid.is-planned") ?? "",
    /--gt-done/,
  );
  const missed = ruleBody(css, ".day-cell.is-missed") ?? "";
  assert.match(missed, /1\.5px dashed var\(--gt-line-control\)/);
  const dot = ruleBody(css, ".day-cell.is-today-dot::after");
  assert.ok(dot, "the dot rule");
  assert.match(dot, /width:\s*4px/);
  assert.match(dot, /height:\s*4px/);
  assert.match(dot, /var\(--gt-accent\)/);
  assert.match(
    ruleBody(css, ".day-cell.is-trained.is-today-dot::after") ?? "",
    /var\(--gt-ink\)/,
  );
  // Planned today: one accent ring and a dot under the number.
  assert.match(
    ruleBody(css, ".day-cell.is-planned-today::after") ?? "",
    /width:\s*4px/,
  );
  // The week strip's days are 44 px.
  assert.match(ruleBody(css, ".day-cell.is-week") ?? "", /height:\s*44px/);
});

test("the moved badge is a 20 px ink circle with an arrow in a 3 px line, on the side it came from", async () => {
  const { MovedBadge } = await loadModule<{
    MovedBadge: (props: { side: "left" | "right" }) => unknown;
  }>("@/components/items/DayCell.tsx");
  const left = renderToStaticMarkup(
    createElement(MovedBadge as never, { side: "left" }),
  );
  const right = renderToStaticMarkup(
    createElement(MovedBadge as never, { side: "right" }),
  );
  assert.match(left, /class="moved-badge is-left"/);
  assert.match(right, /class="moved-badge is-right"/);
  assert.match(left, /stroke-width="3"/);
  assert.match(left, /aria-hidden="true"/);
  // From the left it points right; from the right it is mirrored.
  assert.doesNotMatch(left, /scale\(-1/);
  assert.match(right, /scale\(-1/);
  const css = itemsCss();
  const badge = ruleBody(css, ".moved-badge");
  assert.ok(badge);
  assert.match(badge, /width:\s*20px/);
  assert.match(badge, /height:\s*20px/);
  assert.match(badge, /background-color:\s*var\(--gt-ink\)/);
  assert.match(ruleBody(css, ".moved-badge.is-left") ?? "", /left:/);
  assert.match(ruleBody(css, ".moved-badge.is-right") ?? "", /right:/);
});

test("the date tile's weekday is 12/700 and its number 17/700 (H1)", () => {
  const css = itemsCss();
  const band = ruleBody(css, ".date-tile-band") ?? "";
  assert.match(band, /font-size:\s*(12px|var\(--gt-fs-1\))/);
  assert.match(band, /font-weight:\s*700/);
  const day = ruleBody(css, ".date-tile-day") ?? "";
  assert.match(day, /font-size:\s*(17px|var\(--gt-fs-4\))/);
  assert.match(day, /font-weight:\s*700/);
  assert.match(
    ruleBody(css, ".date-tile.is-planned .date-tile-band") ?? "",
    /--gt-line-control/,
  );
});
