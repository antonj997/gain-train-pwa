import test from "node:test";
import assert from "node:assert/strict";
import { historyCaption } from "../src/lib/history-caption";

const base = {
  mode: "month" as const,
  selectedDate: null,
  from: null,
  to: null,
  activeBound: "from" as const,
};
const counts = new Map([
  ["2026-10-05", 2],
  ["2026-10-07", 1],
  ["2026-10-20", 1],
]);

test("the caption names the chosen day with its workout count", () => {
  const caption = historyCaption(
    { ...base, selectedDate: "2026-10-05" },
    counts,
    "2026-10-28",
  );
  assert.match(caption, /2 workouts$/);
  assert.match(caption, /5/);
});

test("the caption falls back to the latest workout, then a hint", () => {
  assert.match(historyCaption(base, counts, "2026-10-28"), /^Last workout /);
  assert.equal(
    historyCaption(base, new Map(), "2026-10-28"),
    "Tap a day to see its workouts",
  );
});

test("a range caption totals the workouts between both ends", () => {
  const range = { ...base, mode: "range" as const };
  assert.equal(
    historyCaption(range, counts, "2026-10-28"),
    "Choose a start date",
  );
  assert.match(
    historyCaption(
      { ...range, from: "2026-10-05", activeBound: "to" },
      counts,
      "2026-10-28",
    ),
    /choose the end date$/,
  );
  assert.match(
    historyCaption(
      { ...range, from: "2026-10-05", to: "2026-10-10" },
      counts,
      "2026-10-28",
    ),
    /3 workouts$/,
  );
});
