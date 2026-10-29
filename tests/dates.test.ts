import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  endOfMonth,
  isIsoDay,
  shiftDate,
  weekStart,
  weekdayIndex,
} from "../src/lib/dates";

test("calendar arithmetic stays on the calendar", () => {
  assert.equal(shiftDate("2026-03-29", 1), "2026-03-30");
  assert.equal(weekdayIndex("2026-10-26"), 0);
  assert.equal(weekdayIndex("2026-11-01"), 6);
  assert.equal(weekStart("2026-11-01"), "2026-10-26");
  assert.equal(endOfMonth("2024-02"), "2024-02-29");
  assert.equal(endOfMonth("2026-12"), "2026-12-31");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
});

test("only real days are ISO days", () => {
  assert.equal(isIsoDay("2024-02-29"), true);
  assert.equal(isIsoDay("2026-02-29"), false);
  assert.equal(isIsoDay("2026-04-31"), false);
  assert.equal(isIsoDay("2026-4-01"), false);
});
