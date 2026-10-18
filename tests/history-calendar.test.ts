import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarCells,
  moveCalendarMonth,
  workoutDates,
} from "../src/lib/history-calendar";
import { type RecordDoc, type Workout } from "../src/data/model";

test("month calendar starts on Monday and includes every leap-day exactly once", () => {
  const cells = calendarCells("2024-02");
  assert.equal(cells[0].date, "2024-01-29");
  assert.equal(cells.at(-1)?.date, "2024-03-03");
  assert.equal(cells.filter((day) => day.inMonth).length, 29);
  assert.equal(cells.filter((day) => day.date === "2024-02-29").length, 1);
  assert.equal(cells.length % 7, 0);
});

test("six-week months and year navigation keep their calendar dates", () => {
  const cells = calendarCells("2026-03");
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date, "2026-02-23");
  assert.equal(cells.at(-1)?.date, "2026-04-05");
  assert.equal(moveCalendarMonth("2026-01", -1), "2025-12");
  assert.equal(moveCalendarMonth("2026-12", 1), "2027-01");
  assert.throws(() => calendarCells("2026-13"), /month/i);
});

test("calendar dates remain stable across UTC offsets", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Pacific/Kiritimati";
    const ahead = calendarCells("2026-10");
    process.env.TZ = "America/Los_Angeles";
    assert.deepEqual(calendarCells("2026-10"), ahead);
    assert.equal(ahead.find((day) => day.date === "2026-10-18")?.day, 18);
  } finally {
    process.env.TZ = original;
  }
});

test("calendar marks multiple completed sessions on their logged day, excluding drafts and removals", () => {
  const record = (
    date: string,
    status: Workout["status"] = "completed",
    deleted = false,
  ): RecordDoc => ({
    id: crypto.randomUUID(),
    kind: "workout",
    revision: 1,
    localVersion: 1,
    dirty: false,
    deleted,
    payload: {
      name: "Test",
      date,
      status,
      duration: null,
      startedAt: null,
      exercises: [],
    },
  });
  const dates = workoutDates([
    record("2026-10-18"),
    record("2026-10-18"),
    record("2026-10-17"),
    record("2026-10-16", "draft"),
    record("2026-10-15", "completed", true),
    {
      ...record("2026-10-18"),
      kind: "routine",
      payload: { name: "Routine", exercises: [] },
    },
  ]);
  assert.equal(dates.get("2026-10-18"), 2);
  assert.equal(dates.get("2026-10-17"), 1);
  assert.equal(dates.size, 2);
});
