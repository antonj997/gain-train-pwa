import test from "node:test";
import assert from "node:assert/strict";
import type { Plan } from "../src/data/model";
import { REST } from "../src/data/plans";
import { moveDay } from "../src/data/plan-moves";
import { matchWeek, type DoneWorkout } from "../src/data/week-match";

const PUSH = "6f1d2c3e-0000-4000-8000-000000000001";
const LEGS = "6f1d2c3e-0000-4000-8000-000000000002";
const row = (...cells: (string | null)[]) =>
  Array.from({ length: 7 }, (_, i) => cells[i] ?? null);
// Monday Tryckpass, Thursday Benpass, Saturday Tryckpass.
const plan = (change: Partial<Plan> = {}): Plan & { id: string } => ({
  id: "6f1d2c3e-0000-4000-8000-000000000009",
  name: "Styrkeblock",
  startDate: "2026-10-26",
  endDate: "2026-12-20",
  cycleWeeks: 1,
  template: [row(PUSH, REST, null, LEGS, null, PUSH, null)],
  overrides: {},
  goalIds: [],
  ...change,
});
const resolve = (cell: string | null) =>
  cell && cell !== REST && !cell.includes(":") ? cell : null;
const WEEK = "2026-11-16"; // Monday
const done = (
  id: string,
  date: string,
  routineId: string | null = null,
): DoneWorkout => ({ id, date, routineId });
const day = (m: ReturnType<typeof matchWeek>, date: string) =>
  m.days.find((d) => d.date === date)!;

test("the week has seven days, Monday first", () => {
  const m = matchWeek(plan(), [], WEEK, "2026-11-19", resolve);
  assert.deepEqual(
    m.days.map((d) => d.date),
    [16, 17, 18, 19, 20, 21, 22].map((d) => `2026-11-${d}`),
  );
  assert.equal(m.planned, 3);
  assert.equal(m.matched, 0);
  assert.equal(m.extras, 0);
  assert.equal(m.fulfilled, false);
});

test("Monday's Tryckpass done on Tuesday: Monday is not missed, Tuesday is done and moved from Monday", () => {
  const m = matchWeek(
    plan(),
    [done("w1", "2026-11-17", PUSH)],
    WEEK,
    "2026-11-19",
    resolve,
  );
  const monday = day(m, "2026-11-16");
  assert.notEqual(monday.state, "missed");
  assert.equal(monday.state, "rest");
  assert.equal(monday.movedTo, "2026-11-17");
  const tuesday = day(m, "2026-11-17");
  assert.equal(tuesday.state, "done");
  assert.deepEqual(tuesday.workoutIds, ["w1"]);
  assert.equal(tuesday.movedFrom, "2026-11-16");
  assert.equal(day(m, "2026-11-19").state, "plannedToday");
  assert.equal(day(m, "2026-11-21").state, "planned");
  assert.equal(m.matched, 1);
  assert.equal(m.extras, 0);
});

test("same date wins over routine match", () => {
  // A Tryckpass done on Thursday, Benpass's day, fills Thursday, not Saturday.
  const m = matchWeek(
    plan(),
    [done("w1", "2026-11-16", PUSH), done("w2", "2026-11-19", PUSH)],
    WEEK,
    "2026-11-20",
    resolve,
  );
  const thursday = day(m, "2026-11-19");
  assert.equal(thursday.state, "done");
  assert.equal(thursday.movedFrom, undefined);
  assert.equal(day(m, "2026-11-21").state, "planned");
  assert.equal(m.matched, 2);
});

test("a routine match takes the nearest planned day of that routine", () => {
  // Monday's push was done; a second push on Wednesday is Saturday's, early.
  const m = matchWeek(
    plan(),
    [done("w1", "2026-11-16", PUSH), done("w2", "2026-11-18", PUSH)],
    WEEK,
    "2026-11-18",
    resolve,
  );
  assert.equal(day(m, "2026-11-18").movedFrom, "2026-11-21");
  assert.equal(day(m, "2026-11-21").movedTo, "2026-11-18");
  assert.equal(day(m, "2026-11-21").state, "rest");
  assert.equal(m.matched, 2);
});

test("a workout on an unplanned day after all planned days are matched is an extra", () => {
  const m = matchWeek(
    plan(),
    [
      done("w1", "2026-11-16", PUSH),
      done("w2", "2026-11-19", LEGS),
      done("w3", "2026-11-21", PUSH),
      done("w4", "2026-11-22"),
    ],
    WEEK,
    "2026-11-23",
    resolve,
  );
  assert.equal(m.matched, 3);
  assert.equal(m.extras, 1);
  assert.equal(m.fulfilled, true);
  const sunday = day(m, "2026-11-22");
  assert.equal(sunday.state, "done");
  assert.equal(sunday.movedFrom, undefined);
});

test("two workouts on one planned date: one matches, the other is an extra", () => {
  const m = matchWeek(
    plan(),
    [done("w1", "2026-11-16", PUSH), done("w2", "2026-11-16", PUSH)],
    WEEK,
    "2026-11-20",
    resolve,
  );
  const monday = day(m, "2026-11-16");
  assert.equal(monday.state, "done");
  assert.deepEqual(monday.workoutIds, ["w1", "w2"]);
  assert.equal(m.extras, 1);
  assert.equal(m.matched, 1);
  // Thursday stays missed: the second workout never counts for it.
  assert.equal(day(m, "2026-11-19").state, "missed");
  assert.equal(m.fulfilled, false);
});

test("a workout with no routine fills the earliest open planned day before it", () => {
  // Monday missed, an empty workout on Wednesday makes up for it.
  const m = matchWeek(
    plan(),
    [done("w1", "2026-11-18")],
    WEEK,
    "2026-11-19",
    resolve,
  );
  assert.equal(day(m, "2026-11-18").movedFrom, "2026-11-16");
  assert.equal(day(m, "2026-11-16").state, "rest");
  assert.equal(m.extras, 0);
});

test("a past unmatched day is missed", () => {
  const m = matchWeek(plan(), [], WEEK, "2026-11-20", resolve);
  assert.equal(day(m, "2026-11-16").state, "missed");
  assert.equal(day(m, "2026-11-19").state, "missed");
  assert.equal(day(m, "2026-11-21").state, "planned");
  assert.equal(day(m, "2026-11-17").state, "rest");
});

test("today unmatched is plannedToday; today with nothing planned is today", () => {
  const m = matchWeek(plan(), [], WEEK, "2026-11-19", resolve);
  assert.equal(day(m, "2026-11-19").state, "plannedToday");
  assert.equal(
    matchWeek(plan(), [], WEEK, "2026-11-18", resolve).days[2].state,
    "today",
  );
});

test("a day moved in the plan (an override pair) reads as moved from its old day", () => {
  // The week strip's drag: Monday's push moved to Tuesday.
  const moved = moveDay(plan(), "2026-11-16", "2026-11-17");
  const open = matchWeek(moved, [], WEEK, "2026-11-16", resolve);
  assert.equal(day(open, "2026-11-17").state, "planned");
  assert.equal(day(open, "2026-11-17").movedFrom, "2026-11-16");
  assert.equal(day(open, "2026-11-16").movedTo, "2026-11-17");
  assert.equal(day(open, "2026-11-16").state, "today");
  const doneThere = matchWeek(
    moved,
    [done("w1", "2026-11-17", PUSH)],
    WEEK,
    "2026-11-19",
    resolve,
  );
  assert.equal(day(doneThere, "2026-11-17").state, "done");
  assert.equal(day(doneThere, "2026-11-17").movedFrom, "2026-11-16");
  // Moved back later in the week: Saturday's push to Friday.
  const back = moveDay(plan(), "2026-11-21", "2026-11-20");
  const m = matchWeek(back, [], WEEK, "2026-11-19", resolve);
  assert.equal(day(m, "2026-11-20").movedFrom, "2026-11-21");
});

test("days outside the plan's period plan nothing, and a workout there is an extra", () => {
  const m = matchWeek(
    plan({ startDate: "2026-11-19" }),
    [done("w1", "2026-11-16")],
    WEEK,
    "2026-11-17",
    resolve,
  );
  assert.equal(m.planned, 2);
  assert.equal(day(m, "2026-11-16").planned, null);
  assert.equal(m.extras, 1);
});

test("workouts after today and outside the week are ignored", () => {
  const m = matchWeek(
    plan(),
    [done("w0", "2026-11-15", PUSH), done("w9", "2026-11-23", PUSH)],
    WEEK,
    "2026-11-19",
    resolve,
  );
  assert.equal(m.matched, 0);
  assert.equal(m.extras, 0);
});
