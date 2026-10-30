import test from "node:test";
import assert from "node:assert/strict";
import type { Goal, RecordDoc, WorkoutSet } from "../src/data/model";
import { goalInsight, goalSeries } from "../src/data/goals";
import {
  deadline,
  goalPace,
  projectedDate,
  trendPerDay,
  type GoalPoint,
} from "../src/lib/goal-pace";
import { shiftDate } from "../src/lib/dates";
import { weeklyGoalStats } from "../src/lib/week-summary";

const near = (actual: number | null, expected: number, within = 1e-6) =>
  assert.ok(
    actual !== null && Math.abs(actual - expected) < within,
    `${actual} is not ${expected}`,
  );

// Monday 26 October 2026 starts the current week; today is Thursday the 29th.
const NOW = "2026-10-29";
const monday = "2026-10-26";
const week = (weeksAgo: number, day = 0) =>
  shiftDate(monday, -7 * weeksAgo + day);

test("weekly stats: this week, days left and the 12-week series", () => {
  const dates = [week(0), week(0, 2), week(1), week(1, 1), week(1, 3)];
  const s = weeklyGoalStats(dates, 3, NOW);
  assert.equal(s.done, 2);
  assert.equal(s.daysLeft, 4); // Thursday to Sunday
  assert.equal(weeklyGoalStats(dates, 3, "2026-11-01").daysLeft, 1);
  assert.equal(weeklyGoalStats(dates, 3, monday).daysLeft, 7);
  assert.equal(s.series.length, 12);
  assert.equal(s.series[11].start, monday);
  assert.equal(s.series[11].current, true);
  assert.deepEqual(
    s.series.slice(-2).map((w) => [w.workouts, w.met, w.tracked]),
    [
      [3, true, true],
      [2, false, true],
    ],
  );
  // Weeks before the first workout are not tracked.
  assert.equal(s.series[9].tracked, false);
});

test("weekly hit rate counts finished weeks from the first workout only", () => {
  // Trained for 6 finished weeks: met, missed, met, met, missed, met (oldest first).
  const counts = [3, 1, 4, 3, 0, 3];
  const dates = counts.flatMap((n, i) =>
    Array.from({ length: n }, (_, d) => week(6 - i, d)),
  );
  // An empty week with no workouts still counts once training has started.
  dates.push(week(6, 6));
  const s = weeklyGoalStats(dates, 3, NOW);
  assert.deepEqual(s.last4, { met: 3, of: 4 });
  assert.deepEqual(s.last12, { met: 4, of: 6 });
  assert.equal(s.streak, 1);
  assert.equal(s.best, 2);
  // The running week is never counted, met or not.
  const withThisWeek = [...dates, week(0), week(0, 1), week(0, 2)];
  const t = weeklyGoalStats(withThisWeek, 3, NOW);
  assert.deepEqual(t.last4, { met: 3, of: 4 });
  assert.equal(t.streak, 2);
  assert.equal(t.best, 2);
});

test("weekly stats with no workouts, or only this week's", () => {
  const empty = weeklyGoalStats([], 3, NOW);
  assert.deepEqual(
    [empty.done, empty.last4, empty.last12, empty.streak, empty.best],
    [0, { met: 0, of: 0 }, { met: 0, of: 0 }, 0, 0],
  );
  assert.ok(empty.series.every((w) => !w.tracked && w.workouts === 0));
  const fresh = weeklyGoalStats([week(0)], 1, NOW);
  assert.deepEqual(fresh.last4, { met: 0, of: 0 });
  assert.equal(fresh.streak, 1);
  assert.equal(fresh.best, 1);
  // Future dates are ignored.
  assert.equal(weeklyGoalStats([week(-1)], 1, NOW).done, 0);
});

test("best streak finds the longest run, even an old one", () => {
  const dates = [10, 9, 8, 7, 5, 2].map((n) => week(n));
  const s = weeklyGoalStats(dates, 1, NOW, 12);
  assert.equal(s.best, 4);
  assert.equal(s.streak, 0);
  assert.deepEqual(s.last12, { met: 6, of: 10 });
});

test("deadline: days left, due today, overdue", () => {
  assert.deepEqual(deadline(12), { kind: "left", days: 12 });
  assert.deepEqual(deadline(0), { kind: "today" });
  assert.deepEqual(deadline(-3), { kind: "overdue", days: 3 });
});

const line = (perDay: number, from: string, days: number[], start = 100) =>
  days.map((d) => ({ date: shiftDate(from, d), value: start + perDay * d }));

test("the trend is a least-squares fit over the last six weeks", () => {
  const points = line(0.1, "2026-09-20", [0, 7, 14, 21, 28, 35]);
  near(trendPerDay(points, "2026-10-29"), 0.1);
  // Readings older than six weeks are left out.
  const old: GoalPoint[] = [{ date: "2026-06-01", value: 500 }, ...points];
  near(trendPerDay(old, "2026-10-29"), 0.1);
  // Noise around a falling line.
  const noisy = [
    { date: "2026-10-01", value: 90.4 },
    { date: "2026-10-08", value: 89.4 },
    { date: "2026-10-15", value: 89.1 },
    { date: "2026-10-22", value: 87.9 },
  ];
  const slope = trendPerDay(noisy, "2026-10-29")!;
  assert.ok(slope < -0.1 && slope > -0.15, String(slope));
});

test("the trend needs three readings over two weeks", () => {
  assert.equal(trendPerDay([], NOW), null);
  assert.equal(trendPerDay(line(1, "2026-10-01", [0, 20]), NOW), null);
  assert.equal(trendPerDay(line(1, "2026-10-20", [0, 3, 6]), NOW), null);
  near(trendPerDay(line(1, "2026-10-10", [0, 7, 14]), NOW), 1);
  // A flat line is a trend of zero, not missing.
  near(trendPerDay(line(0, "2026-10-10", [0, 7, 14]), NOW), 0);
});

test("pace compares the trend with the rate needed, in both directions", () => {
  // 10 kg to go in 70 days needs 1 kg a week.
  const up = { current: 100, target: 110, daysLeft: 70 };
  assert.equal(goalPace({ ...up, perDay: 1 / 7 })?.kind, "on-track");
  assert.equal(goalPace({ ...up, perDay: 2 / 7 })?.kind, "ahead");
  const behind = goalPace({ ...up, perDay: 0.5 / 7 });
  assert.equal(behind?.kind, "behind");
  near(behind && "needed" in behind ? behind.needed : null, 1);
  near(behind && "trend" in behind ? behind.trend : null, 0.5);
  assert.equal(goalPace({ ...up, perDay: -0.1 })?.kind, "behind");
  // Losing weight: 90 to 80 in 70 days, falling 1 kg a week is on track.
  const down = { current: 90, target: 80, daysLeft: 70 };
  assert.equal(goalPace({ ...down, perDay: -1 / 7 })?.kind, "on-track");
  assert.equal(goalPace({ ...down, perDay: 1 / 7 })?.kind, "behind");
  // No trend yet, nothing left to do, or no days left.
  assert.deepEqual(goalPace({ ...up, perDay: null }), { kind: "unknown" });
  assert.equal(goalPace({ ...up, current: 110, perDay: 0.1 }), null);
  assert.equal(goalPace({ ...up, current: null, perDay: 0.1 }), null);
  assert.equal(goalPace({ ...up, daysLeft: 0, perDay: 0.1 }), null);
  assert.equal(goalPace({ ...up, daysLeft: -4, perDay: 0.1 }), null);
});

test("the projected date follows the trend to the target", () => {
  assert.equal(
    projectedDate({ current: 100, target: 110, perDay: 0.5, today: NOW }),
    shiftDate(NOW, 20),
  );
  assert.equal(
    projectedDate({ current: 90, target: 80, perDay: -0.25, today: NOW }),
    shiftDate(NOW, 40),
  );
  // Rounded up to a whole day.
  assert.equal(
    projectedDate({ current: 100, target: 101, perDay: 0.3, today: NOW }),
    shiftDate(NOW, 4),
  );
  for (const perDay of [0, -0.5, null])
    assert.equal(
      projectedDate({ current: 100, target: 110, perDay, today: NOW }),
      null,
    );
  // Too far away to be useful.
  assert.equal(
    projectedDate({ current: 100, target: 110, perDay: 0.001, today: NOW }),
    null,
  );
  assert.equal(
    projectedDate({ current: 110, target: 110, perDay: 1, today: NOW }),
    null,
  );
});

const workout = (
  date: string,
  sets: Partial<WorkoutSet>[],
  exerciseId = "builtin:bench-press",
): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name: "Push",
    date,
    duration: null,
    startedAt: null,
    status: "completed",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId,
        name: "Bench Press",
        sets: sets.map((s) => ({
          id: crypto.randomUUID(),
          reps: 1,
          weight: 100,
          load: "weight",
          section: "working",
          done: true,
          ...s,
        })),
      },
    ],
  },
});
const createdOn = (date: string) => new Date(date + "T12:00:00").getTime();
const benchGoal = (change: Partial<Goal> = {}): Goal => ({
  kind: "lift",
  targetKg: 110,
  reps: 1,
  exerciseId: "builtin:bench-press",
  exerciseName: "Bench Press",
  byDate: "2026-12-10",
  createdAt: createdOn("2026-09-20"),
  ...change,
});

test("a lift goal's insight: start, sparkline since start, pace and projection", () => {
  const records = [
    workout("2026-09-10", [{ weight: 95 }]),
    workout("2026-09-27", [{ weight: 97.5 }, { weight: 90, reps: 5 }]),
    workout("2026-10-04", [{ weight: 98 }]),
    workout("2026-10-11", [{ weight: 99 }]),
    workout("2026-10-18", [{ weight: 100 }]),
    workout("2026-10-25", [{ weight: 101 }]),
  ];
  const i = goalInsight(benchGoal(), records, { bodyWeightKg: null }, NOW);
  assert.equal(i.progress.start, 95);
  assert.equal(i.progress.current, 101);
  near(i.progress.fraction, 6 / 15);
  assert.deepEqual(
    i.sinceStart.map((p) => [p.date, p.value]),
    [
      ["2026-09-20", 95],
      ["2026-09-27", 97.5],
      ["2026-10-04", 98],
      ["2026-10-11", 99],
      ["2026-10-18", 100],
      ["2026-10-25", 101],
    ],
  );
  assert.ok(i.perDay! > 0.1 && i.perDay! < 0.2, String(i.perDay));
  assert.deepEqual(i.deadline, { kind: "left", days: 42 });
  // 9 kg in six weeks needs 1.5 kg a week; the trend is about 0.9.
  assert.equal(i.pace?.kind, "behind");
  assert.ok(i.projected && i.projected > "2026-12-10");
});

test("an estimated 1RM or multi-rep goal is paced in estimated 1RM", () => {
  const goal = benchGoal({ targetKg: 100, reps: 5 }); // e1RM target 116.7
  const records = ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"].map(
    (date, n) => workout(date, [{ weight: 90 + 2.5 * n, reps: 5 }]),
  );
  const i = goalInsight(goal, records, { bodyWeightKg: null }, NOW);
  assert.equal(i.progress.unit, "kg e1RM");
  // 2.5 kg × (1 + 5/30) a week.
  near(i.perDay! * 7, 2.5 * (1 + 5 / 30), 1e-6);
  assert.equal(
    goalSeries(goal, records, { bodyWeightKg: null }, NOW).length,
    4,
  );
  const estimated = benchGoal({ targetKg: 120, reps: 1, estimated: true });
  const e = goalInsight(estimated, records, { bodyWeightKg: null }, NOW);
  assert.equal(e.progress.unit, "kg e1RM");
  near(e.progress.target, 120);
});

test("a goal without data has no trend and says so", () => {
  const i = goalInsight(benchGoal(), [], { bodyWeightKg: null }, NOW);
  assert.equal(i.progress.current, null);
  assert.equal(i.perDay, null);
  assert.equal(i.pace, null);
  assert.equal(i.projected, null);
  assert.deepEqual(i.sinceStart, []);
  const one = goalInsight(
    benchGoal(),
    [workout("2026-10-20", [{ weight: 100 }])],
    { bodyWeightKg: null },
    NOW,
  );
  assert.deepEqual(one.pace, { kind: "unknown" });
});

const cut = (change: Partial<Goal> = {}): Goal => ({
  kind: "bodyweight",
  targetKg: 80,
  startKg: 90,
  byDate: "2026-12-31",
  createdAt: createdOn("2026-09-20"),
  ...change,
});
const bwWorkout = (date: string, kg: number) =>
  workout(
    date,
    [{ load: "bodyweight", weight: null, reps: 8, bodyWeightKg: kg }],
    "builtin:pull-up",
  );

test("a bodyweight goal reads the start, bodyweight sets and today's weight, going down", () => {
  const records = [
    bwWorkout("2026-09-01", 91), // before the goal: in the trend, not the sparkline
    bwWorkout("2026-10-01", 88.6),
    bwWorkout("2026-10-15", 87.2),
  ];
  const series = goalSeries(cut(), records, { bodyWeightKg: 86 }, NOW);
  assert.deepEqual(
    series.map((p) => [p.date, p.value]),
    [
      ["2026-09-01", 91],
      ["2026-09-20", 90],
      ["2026-10-01", 88.6],
      ["2026-10-15", 87.2],
      [NOW, 86],
    ],
  );
  const i = goalInsight(cut(), records, { bodyWeightKg: 86 }, NOW);
  assert.equal(i.sinceStart.length, 4);
  near(i.progress.fraction, 0.4);
  assert.ok(i.perDay! < 0, String(i.perDay));
  // 6 kg in 63 days needs 0.67 kg a week; the trend falls about 0.8.
  assert.equal(i.pace?.kind, "on-track");
  assert.ok(i.projected && i.projected < "2026-12-31", String(i.projected));
});

test("a bodyweight goal whose start equals the target, and an overdue one", () => {
  const same = goalInsight(cut({ startKg: 80 }), [], { bodyWeightKg: 80 }, NOW);
  assert.equal(same.progress.met, true);
  assert.equal(same.pace, null);
  const late = goalInsight(
    cut({ byDate: "2026-10-20" }),
    [],
    { bodyWeightKg: 85 },
    NOW,
  );
  assert.deepEqual(late.deadline, { kind: "overdue", days: 9 });
  assert.equal(late.pace, null);
  const today = goalInsight(
    cut({ byDate: NOW }),
    [],
    { bodyWeightKg: 85 },
    NOW,
  );
  assert.deepEqual(today.deadline, { kind: "today" });
  // Without a weight in the profile there is nothing to pace from.
  const none = goalInsight(cut(), [], { bodyWeightKg: null }, NOW);
  assert.equal(none.pace, null);
  assert.equal(none.projected, null);
});
