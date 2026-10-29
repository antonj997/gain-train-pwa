import test from "node:test";
import assert from "node:assert/strict";
import { historyPeriod, summarize, metricChange } from "../src/data/summary";
import { weekStart } from "../src/lib/dates";
import { type Workout, newSet, validate } from "../src/data/model";

test("rolling history uses two non-overlapping 30-day windows across year boundaries", () => {
  assert.deepEqual(historyPeriod("", "2026-01-10"), {
    start: "2025-12-12",
    end: "2026-01-10",
    days: 30,
    previousStart: "2025-11-12",
    previousEnd: "2025-12-11",
    previousDays: 30,
  });
});
test("calendar comparisons handle leap years and partial current months", () => {
  const leap = historyPeriod("2024-03", "2026-09-14");
  assert.equal(leap.days, 31);
  assert.equal(leap.previousDays, 29);
  assert.equal(leap.previousEnd, "2024-02-29");
  const partial = historyPeriod("2026-09", "2026-09-14");
  assert.equal(partial.days, 14);
  assert.equal(partial.previousEnd, "2026-08-14");
});
test("weeks begin on Monday across month and year boundaries", () => {
  assert.equal(weekStart("2026-01-01"), "2025-12-29");
  assert.equal(weekStart("2026-01-04"), "2025-12-29");
  assert.equal(weekStart("2026-01-05"), "2026-01-05");
});
test("summary excludes missing durations and unchecked sets, counts zero-minute sessions", () => {
  const workout: Workout = {
    name: "Test",
    date: "2026-09-14",
    duration: 0,
    status: "completed",
    startedAt: null,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "bench",
        name: "Bench",
        sets: [
          { ...newSet(), weight: 20, reps: 5, done: true },
          { ...newSet(), weight: 20, reps: 5 },
        ],
      },
    ],
  };
  const summary = summarize(
    [workout, { ...workout, duration: null }, { ...workout, duration: 60 }],
    30,
    "2026-09-30",
  );
  assert.equal(summary.duration, 30);
  assert.equal(summary.minutes, 60);
  assert.equal(summary.sets, 3);
  assert.equal(summary.volume, 300);
  const assisted = {
    ...workout,
    exercises: workout.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((set) => ({ ...set, load: "assisted" as const })),
    })),
  };
  assert.equal(summarize([assisted], 30, "2026-09-30").volume, 0);
  assert.equal(summary.perWeek, 3);
  assert.equal(
    summarize([workout, { ...workout, date: "2026-08-03" }], 60, "2026-09-30")
      .perWeek,
    1,
  );
  assert.equal(
    summarize(
      [workout, workout, { ...workout, date: "2026-08-03" }],
      60,
      "2026-09-30",
    ).perWeek,
    1.5,
  );
  assert.equal(summarize([], 30, "2026-09-30").perWeek, null);
  assert.equal(summarize([], 30, "2026-09-30").duration, null);
  assert.equal(metricChange(null, 20), "No comparison");
  assert.equal(metricChange(1.04, 1, 1), "→ No change");
});
test("workouts per week only count finished weeks", () => {
  const on = (date: string) =>
    ({ date, duration: null, exercises: [] }) as unknown as Workout;
  // 2026-09-16 is a Wednesday; the week of Monday 14 September is unfinished.
  const sessions = ["2026-09-14", "2026-09-10", "2026-09-08", "2026-09-01"].map(
    on,
  );
  const perWeek = (workouts: Workout[], now: string) =>
    summarize(workouts, 30, now).perWeek;
  // The weeks of 7 September and 31 August are finished: 3 workouts / 2 weeks.
  assert.equal(perWeek(sessions, "2026-09-16"), 1.5);
  // The week of the 14th counts once its Sunday is over.
  assert.equal(perWeek(sessions, "2026-09-21"), 4 / 3);
  // Sunday itself is still part of the unfinished week.
  assert.equal(perWeek([on("2026-09-13")], "2026-09-13"), null);
  assert.equal(perWeek([on("2026-09-13")], "2026-09-14"), 1);
  // Nothing finished yet: a dash, not zero and not a division by zero.
  assert.equal(perWeek([on("2026-09-14")], "2026-09-16"), null);
});
test("summary counts a set and its drops as one set", () => {
  const workout: Workout = {
    name: "Test",
    date: "2026-09-14",
    duration: 30,
    status: "completed",
    startedAt: null,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "bench",
        name: "Bench",
        sets: [
          { ...newSet(), weight: 100, reps: 5, done: true },
          { ...newSet(), weight: 80, reps: 4, done: true, drop: true },
          { ...newSet(), weight: 20, reps: 8, done: true, section: "warmup" },
        ],
      },
    ],
  };
  const summary = summarize([workout], 30, "2026-09-30");
  assert.equal(summary.sets, 2);
  assert.equal(summary.workingSets, 1);
});
test("routine origin survives validation while old workouts remain valid", () => {
  const workout = {
    name: "Routine session",
    date: "2026-09-14",
    duration: null,
    status: "draft",
    startedAt: null,
    exercises: [],
  };
  assert.doesNotThrow(() => validate("workout", workout));
  const routineId = crypto.randomUUID();
  assert.equal(
    (validate("workout", { ...workout, routineId }) as Workout).routineId,
    routineId,
  );
});
test("long history ranges clamp month ends and compare equal-length periods", () => {
  const six = historyPeriod("6m", "2026-08-31");
  assert.equal(six.start, "2026-03-01");
  assert.equal(six.end, "2026-08-31");
  assert.equal(six.days, 184);
  assert.equal(six.previousEnd, "2026-02-28");
  assert.equal(six.previousDays, six.days);
  const year = historyPeriod("12m", "2024-02-29");
  assert.equal(year.start, "2023-03-01");
  assert.equal(year.days, 366);
  assert.equal(year.previousDays, 366);
});
