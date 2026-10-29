import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarCells,
  moveCalendarMonth,
  workoutDates,
} from "../src/lib/history-calendar";
import { type RecordDoc, type Workout } from "../src/data/model";
import * as calendar from "../src/lib/history-calendar";

test("history defaults to the heatmap, filtering to the last year until a day is chosen", () => {
  const now = "2026-10-26";
  let state = calendar.createHistoryCalendar(now);
  assert.equal(state.display, "simple");
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2025-10-27",
    end: now,
  });
  state = calendar.changeHistoryCalendar(
    state,
    { type: "date", date: "2026-10-20" },
    now,
  );
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2026-10-20",
    end: "2026-10-20",
  });
  state = calendar.changeHistoryCalendar(state, { type: "reset" }, now);
  assert.equal(state.selectedDate, null);
  assert.equal(state.display, "simple");
});

test("cross-month and reverse range selection includes both dates and survives browsing", () => {
  const now = "2026-10-26";
  let state = calendar.changeHistoryCalendar(
    calendar.createHistoryCalendar(now),
    { type: "mode", mode: "range" },
    now,
  );
  state = calendar.changeHistoryCalendar(
    state,
    { type: "date", date: "2026-10-10" },
    now,
  );
  assert.equal(state.activeBound, "to");
  state = calendar.changeHistoryCalendar(
    state,
    { type: "browse", month: "2026-09" },
    now,
  );
  assert.equal(state.from, "2026-10-10");
  assert.equal(state.to, null);
  state = calendar.changeHistoryCalendar(
    state,
    { type: "date", date: "2026-09-29" },
    now,
  );
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2026-09-29",
    end: "2026-10-10",
  });
  state = calendar.changeHistoryCalendar(
    state,
    { type: "browse", month: "2025-12" },
    now,
  );
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2026-09-29",
    end: "2026-10-10",
  });
});

test("range boundaries cross years and preserve leap day, with explicit clearing and reset", () => {
  const now = "2024-03-02";
  let state = calendar.changeHistoryCalendar(
    calendar.createHistoryCalendar(now),
    { type: "mode", mode: "range" },
    now,
  );
  state = calendar.changeHistoryCalendar(
    state,
    { type: "date", date: "2023-12-31" },
    now,
  );
  state = calendar.changeHistoryCalendar(
    state,
    { type: "date", date: "2024-02-29" },
    now,
  );
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2023-12-31",
    end: "2024-02-29",
  });
  state = calendar.changeHistoryCalendar(state, { type: "clear" }, now);
  assert.equal(calendar.historyCalendarBounds(state, now), null);
  assert.equal(state.activeBound, "from");
  state = calendar.changeHistoryCalendar(state, { type: "reset" }, now);
  assert.deepEqual(state, calendar.createHistoryCalendar(now));
});

test("future dates cannot be chosen and future navigation is clamped to the current month", () => {
  const now = "2026-10-26";
  const state = {
    ...calendar.createHistoryCalendar(now),
    display: "detailed" as const,
  };
  assert.deepEqual(
    calendar.changeHistoryCalendar(
      state,
      { type: "date", date: "2026-10-27" },
      now,
    ),
    state,
  );
  assert.equal(
    calendar.changeHistoryCalendar(
      state,
      { type: "browse", month: "2027-01" },
      now,
    ).month,
    "2026-10",
  );
  assert.throws(
    () =>
      calendar.changeHistoryCalendar(
        state,
        { type: "date", date: "2026-02-29" },
        now,
      ),
    /date/i,
  );
});

test("month day filtering toggles off and browsing another month clears only the day", () => {
  const now = "2026-10-26";
  let state = calendar.changeHistoryCalendar(
    { ...calendar.createHistoryCalendar(now), display: "detailed" },
    { type: "date", date: "2026-10-12" },
    now,
  );
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2026-10-12",
    end: "2026-10-12",
  });
  state = calendar.changeHistoryCalendar(
    state,
    { type: "date", date: "2026-10-12" },
    now,
  );
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2026-10-01",
    end: "2026-10-26",
  });
  state = calendar.changeHistoryCalendar(
    state,
    { type: "date", date: "2026-10-12" },
    now,
  );
  state = calendar.changeHistoryCalendar(
    state,
    { type: "browse", month: "2026-09" },
    now,
  );
  assert.equal(state.selectedDate, null);
  assert.deepEqual(calendar.historyCalendarBounds(state, now), {
    start: "2026-09-01",
    end: "2026-09-30",
  });
});

test("switching to the simple display clears a range, and detailed keeps it", () => {
  const now = "2026-10-26";
  const ranged = {
    ...calendar.createHistoryCalendar(now),
    display: "detailed" as const,
    mode: "range" as const,
    from: "2026-09-29",
    to: "2026-10-10",
  };
  const simple = calendar.changeHistoryCalendar(
    ranged,
    { type: "display", display: "simple" },
    now,
  );
  assert.equal(simple.mode, "month");
  assert.equal(simple.from, null);
  assert.equal(simple.to, null);
  assert.equal(
    calendar.changeHistoryCalendar(simple, { type: "reset" }, now).display,
    "simple",
  );
  const detailed = calendar.changeHistoryCalendar(
    { ...ranged, display: "simple" },
    { type: "display", display: "detailed" },
    now,
  );
  assert.equal(detailed.from, "2026-09-29");
});

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
