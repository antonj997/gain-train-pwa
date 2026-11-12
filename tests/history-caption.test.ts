import test from "node:test";
import assert from "node:assert/strict";
import {
  historyCaption,
  periodRangeLabel,
  volumeTile,
} from "../src/lib/history-caption";

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

test("a period's dates are short: one month once, two months each", () => {
  assert.equal(periodRangeLabel("2026-11-02", "2026-11-09"), "2–9 Nov");
  assert.equal(periodRangeLabel("2026-10-30", "2026-11-05"), "30 Oct–5 Nov");
});

test("the volume tile stays short: kg, then tonnes, whole from 100 t", () => {
  assert.deepEqual(volumeTile(850.4, "kg"), { value: "850", unit: "kg" });
  assert.deepEqual(volumeTile(18_640, "kg"), { value: "18.6", unit: "t" });
  assert.deepEqual(volumeTile(99_960, "kg"), { value: "100", unit: "t" });
  assert.deepEqual(volumeTile(186_400, "kg"), { value: "186", unit: "t" });
  assert.deepEqual(volumeTile(1_234_000, "kg"), { value: "1234", unit: "t" });
  assert.deepEqual(volumeTile(18_640, "lb"), { value: "41.1", unit: "k lb" });
  assert.deepEqual(volumeTile(0, "kg"), { value: "0", unit: "kg" });
  assert.deepEqual(volumeTile(999.6, "kg"), { value: "1.0", unit: "t" });
});
