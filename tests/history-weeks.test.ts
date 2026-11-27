import test from "node:test";
import assert from "node:assert/strict";
import type { WorkoutRecord, WorkoutSet } from "../src/data/model";
import {
  historyWeeks,
  matchesQuery,
  upcomingPlanned,
} from "../src/lib/history-weeks";
import { setCurrentLanguage } from "../src/i18n";

let n = 0;
const set = (done = true): WorkoutSet => ({
  id: `s${n++}`,
  reps: 5,
  weight: 80,
  load: "weight",
  section: "working",
  done,
});
const workout = (
  name: string,
  date: string,
  exercises: [string, string][],
  sets = 3,
): WorkoutRecord => ({
  id: `w${n++}`,
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name,
    date,
    duration: 50,
    startedAt: null,
    status: "completed",
    exercises: exercises.map(([exerciseId, exName]) => ({
      id: `e${n++}`,
      exerciseId,
      name: exName,
      sets: Array.from({ length: sets }, () => set()),
    })),
  },
});

const TODAY = "2026-11-19"; // Thursday
const LEGS: [string, string][] = [["builtin:squat", "Squat"]];
const PUSH: [string, string][] = [["builtin:bench-press", "Bench Press"]];
const log = [
  workout("Tryckpass", "2026-11-17", PUSH, 4),
  workout("Benpass", "2026-11-12", LEGS),
  workout("Tryckpass", "2026-11-09", PUSH, 4),
  workout("Benpass", "2026-11-05", LEGS),
  workout("Tryckpass", "2026-11-02", PUSH, 4),
  workout("Benpass", "2026-10-29", LEGS),
  workout("Helkropp", "2026-10-14", LEGS),
];
const plan = { name: "Styrkeblock", startDate: "2026-10-26" };

test("weeks run newest first, this week first, with their summary", () => {
  setCurrentLanguage("sv");
  try {
    const weeks = historyWeeks(log, TODAY, plan, "", (id) =>
      id === log[0].id ? 1 : 0,
    );
    assert.deepEqual(
      weeks.map((w) => w.key),
      ["2026-11-16", "2026-11-09", "2026-11-02", "2026-10-26", "2026-10-12"],
    );
    assert.equal(weeks[0].label, "Den här veckan");
    assert.deepEqual(weeks[0].summary, { workouts: 1, sets: 4, records: 1 });
    assert.deepEqual(weeks[1].summary, { workouts: 2, sets: 7, records: 0 });
  } finally {
    setCurrentLanguage("en");
  }
});

test("weeks beyond the last three are marked older", () => {
  const weeks = historyWeeks(log, TODAY, plan, "");
  assert.deepEqual(
    weeks.map((w) => w.older),
    [false, false, false, true, true],
  );
});

test("a week before the plan start is marked beforePlan", () => {
  const weeks = historyWeeks(log, TODAY, plan, "");
  assert.deepEqual(
    weeks.map((w) => w.beforePlan),
    [false, false, false, false, true],
  );
  // No plan: nothing is before it.
  assert.ok(historyWeeks(log, TODAY, null, "").every((w) => !w.beforePlan));
});

test('"benpass" keeps only Benpass, and the week summary counts only the matches', () => {
  const weeks = historyWeeks(log, TODAY, plan, "benpass");
  assert.deepEqual(
    weeks.map((w) => w.key),
    ["2026-11-09", "2026-11-02", "2026-10-26"],
  );
  assert.ok(
    weeks.every((w) => w.items.every((r) => r.payload.name === "Benpass")),
  );
  assert.deepEqual(weeks[0].summary, { workouts: 1, sets: 3, records: 0 });
  // While searching nothing is folded away.
  assert.ok(weeks.every((w) => !w.older));
});

test("Planerat starts with today's planned workout, and leaves it out once done", () => {
  const at = (date: string) =>
    date === "2026-11-19"
      ? { title: "Benpass", week: 5 }
      : date === "2026-11-23"
        ? { title: "Tryckpass", week: 6 }
        : null;
  assert.deepEqual(
    upcomingPlanned(at, TODAY, false).map((d) => d.date),
    ["2026-11-19", "2026-11-23"],
  );
  assert.deepEqual(
    upcomingPlanned(at, TODAY, true).map((d) => d.date),
    ["2026-11-23"],
  );
  assert.deepEqual(upcomingPlanned(at, TODAY, false, 3), [
    { date: "2026-11-19", title: "Benpass", week: 5 },
  ]);
});

test("no matches gives an empty list", () => {
  assert.deepEqual(historyWeeks(log, TODAY, plan, "marklyft"), []);
});

test("a query matches the name, an exercise's display name or the date", () => {
  setCurrentLanguage("sv");
  try {
    const legs = log[1];
    assert.ok(matchesQuery(legs, ""));
    assert.ok(matchesQuery(legs, "BENPASS"));
    // The Swedish display name and the English one.
    assert.ok(matchesQuery(legs, "knäböj"));
    assert.ok(matchesQuery(legs, "squat"));
    // The date as text.
    assert.ok(matchesQuery(legs, "12 nov"));
    assert.ok(matchesQuery(legs, "torsdag"));
    assert.ok(!matchesQuery(legs, "bänkpress"));
  } finally {
    setCurrentLanguage("en");
  }
});
