import test from "node:test";
import assert from "node:assert/strict";
import type { Goal, Plan, RecordDoc, WorkoutSet } from "../src/data/model";
import { loadEstimate } from "../src/data/estimate";
import { goalInsight, type GoalItem } from "../src/data/goals";
import {
  CHECKIN_DAYS,
  checkinDue,
  checkinLoad,
  checkinState,
  deloadMondays,
  isRealLift,
  liftLog,
  reachedByLift,
  readyToTest,
  statusOf,
  strength,
  strengthPace,
  strengthProjection,
  strengthSeries,
  strengthTarget,
  strengthTrend,
} from "../src/data/lift-goal";
import {
  goalFillSource,
  goalSetTargets,
  goalTargetLabel,
  goalTargetText,
} from "../src/data/goal-targets";
import { fillFrom } from "../src/lib/set-target";
import { shiftDate } from "../src/lib/dates";
import { setCurrentWeightUnit } from "../src/lib/units";

const near = (
  actual: number | null | undefined,
  expected: number,
  within = 1e-6,
) =>
  assert.ok(
    actual !== null &&
      actual !== undefined &&
      Math.abs(actual - expected) < within,
    `${actual} is not ${expected}`,
  );

const set = (
  weight: number | null,
  reps: number,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps,
  weight,
  load: "weight",
  section: "working",
  done: true,
  ...extra,
});
const bw = (added: number, reps: number, extra: Partial<WorkoutSet> = {}) =>
  set(added || null, reps, {
    load: "bodyweight",
    extraWeight: added > 0,
    ...extra,
  });
const workout = (
  date: string,
  sets: WorkoutSet[],
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
      { id: crypto.randomUUID(), exerciseId, name: "Bench Press", sets },
    ],
  },
});
const createdOn = (date: string) => new Date(date + "T12:00:00").getTime();
const bench = (change: Partial<Goal> = {}): GoalItem => ({
  id: "goal-1",
  kind: "lift",
  targetKg: 110,
  reps: 1,
  exerciseId: "builtin:bench-press",
  exerciseName: "Bench Press",
  byDate: "2027-02-01",
  createdAt: createdOn("2026-10-05"),
  ...change,
});
const point = (date: string, value: number) => ({ date, value });

// ---------------------------------------------------------------- Strength

test("strength is Epley as in estimate.ts, with a single as its own load", () => {
  assert.equal(strength(110, 1), 110);
  near(strength(90, 7), 111);
  for (const s of [set(90, 7), set(100, 2), set(60, 10)])
    near(strength(s.weight!, s.reps!), loadEstimate(s)!);
  // A bodyweight lift on the whole load, as loadEstimate counts it.
  const dip = bw(20, 5, { bodyWeightKg: 80 });
  near(strength(100, 5), loadEstimate(dip)!);
  // The target in the same measure.
  assert.equal(strengthTarget({ targetKg: 110, reps: 1 }, false, null), 110);
  near(strengthTarget({ targetKg: 100, reps: 5 }, false, null), 100 * (7 / 6));
  near(strengthTarget({ targetKg: 20, reps: 5 }, true, 80), 100 * (7 / 6));
  assert.equal(strengthTarget({ targetKg: 20, reps: 5 }, true, null), null);
  assert.equal(
    strengthTarget({ targetKg: 120, reps: 3, estimated: true }, false, null),
    120,
  );
});

test("the series is each session's best set of 1–10 reps", () => {
  const log = liftLog(
    "builtin:bench-press",
    [
      workout("2026-10-01", [set(100, 2), set(90, 7), set(90, 6)]),
      workout("2026-10-03", [set(60, 15)]), // too many reps to estimate
      workout("2026-10-05", [
        set(140, 1, { section: "warmup" }),
        set(140, 1, { done: false }),
        set(140, 1, { drop: true }),
        set(95, 1),
      ]),
      workout("2026-10-06", [set(200, 1)], "builtin:squat"),
    ],
    null,
  );
  assert.deepEqual(log.days, ["2026-10-01", "2026-10-03", "2026-10-05"]);
  const series = strengthSeries(log);
  assert.deepEqual(
    series.map((p) => [p.date, Math.round(p.value * 10) / 10, p.set.reps]),
    [
      ["2026-10-01", 111, 7],
      ["2026-10-05", 95, 1],
    ],
  );
});

test("a bodyweight lift counts the bodyweight, the set's or the profile's", () => {
  const records = [
    workout("2026-10-01", [bw(10, 5, { bodyWeightKg: 78 })], "builtin:pull-up"),
    workout("2026-10-08", [bw(0, 8)], "builtin:pull-up"),
    workout(
      "2026-10-09",
      [set(50, 8, { load: "assisted" })],
      "builtin:pull-up",
    ),
  ];
  const log = liftLog("builtin:pull-up", records, 80);
  assert.equal(log.body, true);
  assert.equal(log.bodyWeightKg, 78);
  const series = strengthSeries(log);
  near(series[0].value, 88 * (1 + 5 / 30));
  near(series[1].value, 80 * (1 + 8 / 30));
  near(series[2].value, 30 * (1 + 8 / 30));
  // Without any bodyweight there is nothing to measure.
  const none = liftLog(
    "builtin:pull-up",
    [workout("2026-10-08", [bw(0, 8)], "builtin:pull-up")],
    null,
  );
  assert.deepEqual(strengthSeries(none), []);
});

// ---------------------------------------------------------------- Smoothing

const TODAY = "2026-11-16";

test("the windows are the last four weeks and the four before", () => {
  const points = [
    point(shiftDate(TODAY, -56), 500), // outside both
    point(shiftDate(TODAY, -55), 100),
    point(shiftDate(TODAY, -40), 100),
    point(shiftDate(TODAY, -28), 100), // the older window's newest day
    point(shiftDate(TODAY, -27), 110), // the recent window's oldest day
    point(shiftDate(TODAY, -10), 110),
    point(TODAY, 110),
  ];
  const trend = strengthTrend(points, TODAY);
  assert.deepEqual(
    [
      trend.recent?.mean,
      trend.recent?.sessions,
      trend.previous?.mean,
      trend.previous?.sessions,
    ],
    [110, 3, 100, 3],
  );
  near(trend.recent!.at, -37 / 3);
  near(trend.previous!.at, -41);
  near(trend.change, 0.1);
  assert.equal(trend.status, "up");
  near(trend.perDay, 10 / (41 - 37 / 3));
});

test("the status bands: beyond 2.5 % is up or down, the edges are steady", () => {
  assert.equal(statusOf(0.025), "flat");
  assert.equal(statusOf(0.0251), "up");
  assert.equal(statusOf(-0.025), "flat");
  assert.equal(statusOf(-0.0251), "down");
  assert.equal(statusOf(0), "flat");
  const windows = (before: number, after: number) =>
    strengthTrend(
      [
        ...[-50, -45, -40].map((d) => point(shiftDate(TODAY, d), before)),
        ...[-20, -10, 0].map((d) => point(shiftDate(TODAY, d), after)),
      ],
      TODAY,
    ).status;
  assert.equal(windows(100, 102.5), "flat");
  assert.equal(windows(100, 102.6), "up");
  assert.equal(windows(100, 97.5), "flat");
  assert.equal(windows(100, 97.4), "down");
});

test("fewer than three sessions in a window is too little data", () => {
  const recentTwo = [
    ...[-50, -45, -40].map((d) => point(shiftDate(TODAY, d), 100)),
    ...[-10, 0].map((d) => point(shiftDate(TODAY, d), 120)),
  ];
  const t1 = strengthTrend(recentTwo, TODAY);
  assert.equal(t1.status, "insufficient");
  assert.equal(t1.perDay, null);
  assert.equal(strengthPace(t1, 110, "2027-01-01", TODAY), null);
  assert.equal(strengthProjection(t1, 130, TODAY), null);
  const previousTwo = [
    ...[-50, -40].map((d) => point(shiftDate(TODAY, d), 100)),
    ...[-20, -10, 0].map((d) => point(shiftDate(TODAY, d), 120)),
  ];
  assert.equal(strengthTrend(previousTwo, TODAY).status, "insufficient");
  assert.equal(strengthTrend([], TODAY).status, "insufficient");
});

test("pace projects the smoothed trend to the date; the date is only for a rising trend", () => {
  // 100 four weeks before, 104 now: +4 over 28 days.
  const pts = [
    ...[-49, -42, -35].map((d) => point(shiftDate(TODAY, d), 100)),
    ...[-21, -14, -7].map((d) => point(shiftDate(TODAY, d), 104)),
  ];
  const trend = strengthTrend(pts, TODAY);
  assert.equal(trend.status, "up");
  near(trend.perDay, 4 / 28);
  // From the recent mean's day (14 days ago) to 4 weeks from now: +6.
  assert.equal(strengthPace(trend, 110, shiftDate(TODAY, 28), TODAY), "on");
  assert.equal(strengthPace(trend, 111, shiftDate(TODAY, 28), TODAY), "off");
  assert.equal(strengthPace(trend, 110, TODAY, TODAY), null);
  assert.equal(strengthProjection(trend, 110, TODAY), shiftDate(TODAY, 28));
  // Steady or falling: no date.
  const flat = strengthTrend(
    pts.map((p) => ({ ...p, value: 100 })),
    TODAY,
  );
  assert.equal(flat.status, "flat");
  assert.equal(strengthProjection(flat, 110, TODAY), null);
  assert.equal(strengthPace(flat, 110, "2027-06-01", TODAY), "off");
});

// ---------------------------------------------------------------- Reached and ready

test("a goal is met only by the real lift; for bodyweight the added weight", () => {
  const goal = { targetKg: 110, reps: 1 };
  const lift = (s: WorkoutSet) => ({ date: TODAY, set: s, load: s.weight });
  assert.equal(isRealLift(goal, lift(set(110, 1)), false, 110), true);
  assert.equal(isRealLift(goal, lift(set(112.5, 2)), false, 110), true);
  assert.equal(isRealLift(goal, lift(set(107.5, 3)), false, 110), false);
  assert.equal(isRealLift(goal, lift(set(90, 7)), false, 110), false);
  const dips = { targetKg: 20, reps: 5 };
  const body = (s: WorkoutSet) => ({ date: TODAY, set: s, load: 100 });
  assert.equal(
    isRealLift(dips, body(bw(20, 5, { bodyWeightKg: 80 })), true, 116),
    true,
  );
  assert.equal(
    isRealLift(dips, body(bw(17.5, 8, { bodyWeightKg: 90 })), true, 116),
    false,
  );
  assert.equal(
    isRealLift(dips, body(bw(0, 20, { bodyWeightKg: 80 })), true, 116),
    false,
  );
  // Reached on the first real lift from the goal's day.
  const log = {
    body: false,
    sets: [
      { date: "2026-09-01", set: set(110, 1), load: 110 },
      { date: "2026-10-20", set: set(105, 3), load: 105 },
      { date: "2026-11-02", set: set(110, 1), load: 110 },
    ],
  };
  assert.equal(reachedByLift(goal, log, 110, "2026-10-05"), "2026-11-02");
  assert.equal(
    reachedByLift(
      goal,
      { ...log, sets: log.sets.slice(0, 2) },
      110,
      "2026-10-05",
    ),
    "2026-10-05",
  );
  assert.equal(
    reachedByLift(goal, { ...log, sets: [log.sets[1]] }, 110, "2026-10-05"),
    null,
  );
});

test("ready to test once the smoothed strength reaches the target", () => {
  const goal = { targetKg: 110, reps: 1 };
  const recent = (mean: number, sessions: number) => ({
    recent: { mean, sessions, at: -10 },
  });
  assert.deepEqual(readyToTest(goal, recent(111, 4), 110, false), {
    weight: 110,
    reps: 1,
  });
  assert.equal(readyToTest(goal, recent(110, 3), 110, false)?.weight, 110);
  assert.equal(readyToTest(goal, recent(109.9, 4), 110, false), null);
  assert.equal(readyToTest(goal, recent(115, 2), 110, false), null);
  assert.equal(readyToTest(goal, recent(115, 4), 110, true), null);
  assert.equal(
    readyToTest({ ...goal, estimated: true }, recent(130, 4), 110, false),
    null,
  );
});

// ---------------------------------------------------------------- Check-ins

test("the check-in load is 85 % of the target on the lift's step", () => {
  assert.equal(
    checkinLoad({ targetKg: 110 }, { body: false, bodyWeightKg: null }),
    92.5,
  );
  assert.equal(
    checkinLoad({ targetKg: 100 }, { body: false, bodyWeightKg: null }),
    85,
  );
  // Dumbbells step 2 kg.
  assert.equal(
    checkinLoad(
      { targetKg: 40 },
      { body: false, bodyWeightKg: null, equipment: "dumbbell" },
    ),
    34,
  );
  // Pounds: a 5 lb step (205 lb).
  near(
    checkinLoad(
      { targetKg: 110 },
      { body: false, bodyWeightKg: null, unit: "lb" },
    ),
    205 * 0.45359237,
    0.001,
  );
  // Bodyweight: 85 % of the whole load, as added weight.
  assert.equal(
    checkinLoad(
      { targetKg: 20 },
      { body: true, bodyWeightKg: 80, equipment: "bodyweight" },
    ),
    5,
  );
  assert.equal(
    checkinLoad({ targetKg: 5 }, { body: true, bodyWeightKg: 80 }),
    0,
  );
  assert.equal(
    checkinLoad({ targetKg: 20 }, { body: true, bodyWeightKg: null }),
    null,
  );
});

test("a check-in falls due after four weeks or six sessions, whichever is first", () => {
  // Made Monday 5 October: four weeks on is Monday 2 November.
  assert.deepEqual(checkinDue("2026-10-05", []), {
    date: "2026-11-02",
    week: "2026-11-02",
  });
  assert.equal(shiftDate("2026-10-05", CHECKIN_DAYS), "2026-11-02");
  // Three sessions a week: the sixth is Friday 16 October.
  const days = [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-09",
    "2026-10-12",
    "2026-10-14",
    "2026-10-16",
    "2026-10-19",
  ];
  assert.deepEqual(checkinDue("2026-10-05", days), {
    date: "2026-10-16",
    week: "2026-10-12",
  });
  // Once a week: the four weeks come first.
  const weekly = [
    "2026-10-07",
    "2026-10-14",
    "2026-10-21",
    "2026-10-28",
    "2026-11-04",
    "2026-11-11",
  ];
  assert.equal(checkinDue("2026-10-05", weekly).date, "2026-11-02");
});

test("a plan's deload week within the four weeks puts the check-in in the week before", () => {
  const plan = {
    startDate: "2026-10-05",
    endDate: "2026-12-27",
    cycleWeeks: 4,
    weekKinds: ["normal", "normal", "normal", "deload"],
  } as Pick<Plan, "startDate" | "endDate" | "cycleWeeks" | "weekKinds">;
  const mondays = deloadMondays([plan]);
  assert.deepEqual(mondays, ["2026-10-26", "2026-11-23", "2026-12-21"]);
  assert.deepEqual(deloadMondays([{ ...plan, paused: true }]), []);
  // From 5 October the deload of 26 October is within four weeks: 19 October.
  assert.deepEqual(checkinDue("2026-10-05", [], mondays), {
    date: "2026-10-19",
    week: "2026-10-19",
  });
  // Even before six sessions would make it due.
  const days = [
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ];
  assert.equal(checkinDue("2026-10-05", days, mondays).week, "2026-10-19");
  // From 22 October the week before 23 November is past four weeks: none.
  assert.equal(checkinDue("2026-10-22", [], mondays).week, "2026-11-16");
  // A deload whose week before is not after the anchor is passed over.
  assert.equal(checkinDue("2026-10-20", [], mondays).week, "2026-11-16");
});

test("check-ins: due this week, done by a set at the load, skipped or missed", () => {
  const goal = bench({ createdAt: createdOn("2026-10-12") }); // due week of 9 November
  const log = (sets: { date: string; set: WorkoutSet }[]) => ({
    body: false,
    days: [...new Set(sets.map((s) => s.date))],
    sets: sets.map((s) => ({ ...s, load: s.set.weight })),
  });
  const base = { load: 92.5, created: "2026-10-12" };
  // Before the week: nothing due, the next one named.
  const early = checkinState({
    goal,
    log: log([]),
    today: "2026-11-05",
    ...base,
  });
  assert.deepEqual([early.due, early.next], [null, "2026-11-09"]);
  // In the week: due Monday to Sunday.
  const due = checkinState({
    goal,
    log: log([]),
    today: "2026-11-11",
    ...base,
  });
  assert.deepEqual(due.due, { week: "2026-11-09", end: "2026-11-15" });
  // A lighter set does not do it; one at the load or heavier does.
  const light = log([{ date: "2026-11-10", set: set(90, 7) }]);
  assert.ok(
    checkinState({ goal, log: light, today: "2026-11-11", ...base }).due,
  );
  const done = checkinState({
    goal,
    log: log([
      { date: "2026-11-10", set: set(92.5, 5) },
      { date: "2026-11-10", set: set(92.5, 6) },
    ]),
    today: "2026-11-11",
    ...base,
  });
  assert.equal(done.due, null);
  assert.equal(done.last?.date, "2026-11-10");
  near(done.last?.value, 92.5 * 1.2);
  // The next one is four weeks after it: the week of 7 December.
  assert.equal(done.next, "2026-12-07");
  // Skipped: not due this week, and the next comes an interval after.
  const skipped = checkinState({
    goal: { checkinSkips: ["2026-11-09"] },
    log: log([]),
    today: "2026-11-11",
    ...base,
  });
  assert.equal(skipped.due, null);
  assert.equal(skipped.next, "2026-12-07");
  // A week that passed without one: the next an interval after it.
  const missed = checkinState({
    goal,
    log: log([]),
    today: "2026-11-20",
    ...base,
  });
  assert.equal(missed.due, null);
  assert.equal(missed.next, "2026-12-07");
  assert.equal(missed.last, null);
});

test("check-ins follow one another from the log", () => {
  // Bench twice a week from the goal's Monday: due after the sixth session.
  const dates = [
    "2026-10-06",
    "2026-10-09",
    "2026-10-13",
    "2026-10-16",
    "2026-10-20",
    "2026-10-23",
    "2026-10-27",
    "2026-10-30",
    "2026-11-03",
    "2026-11-06",
    "2026-11-10",
    "2026-11-13",
  ];
  const sets = dates.map((date) => ({
    date,
    // The check-in weight only on 23 October.
    set: date === "2026-10-23" ? set(92.5, 6) : set(85, 6),
  }));
  const state = checkinState({
    goal: {},
    log: {
      body: false,
      days: dates,
      sets: sets.map((s) => ({ ...s, load: s.set.weight })),
    },
    load: 92.5,
    created: "2026-10-05",
    today: "2026-11-16",
  });
  // Done the week of 19 October; then six sessions to 13 November: missed;
  // then due again from the sixth session after 13 November.
  assert.equal(state.last?.date, "2026-10-23");
  assert.equal(state.due, null);
  assert.equal(state.next, "2026-12-07");
});

// ---------------------------------------------------------------- The owner's case

// Bench 100 × 2 before the goal (5 October), then 90 × 7 and 90 × 6 twice a
// week for the last four weeks. Today is Monday 16 November.
const ownerRecords = () => [
  ...[
    "2026-09-22",
    "2026-09-25",
    "2026-09-29",
    "2026-10-02",
    "2026-10-06",
    "2026-10-09",
    "2026-10-13",
    "2026-10-16",
  ].map((date) => workout(date, [set(100, 2), set(100, 2)])),
  ...[
    "2026-10-20",
    "2026-10-23",
    "2026-10-27",
    "2026-10-30",
    "2026-11-03",
    "2026-11-06",
    "2026-11-10",
    "2026-11-13",
  ].map((date) => workout(date, [set(90, 7), set(90, 6), set(90, 6)])),
];

test("the owner's case: stronger, not behind, and ready to test 110 × 1", () => {
  const i = goalInsight(bench(), ownerRecords(), { bodyWeightKg: null }, TODAY);
  near(i.progress.current, 111);
  assert.deepEqual(
    [i.progress.source?.set.weight, i.progress.source?.set.reps],
    [90, 7],
  );
  assert.equal(i.progress.target, 110);
  near(i.progress.start, 100 * (1 + 2 / 30));
  assert.equal(i.progress.met, false);
  assert.equal(i.progress.fraction, 0.99);
  const s = i.strength!;
  // 111 against 106.7: about 4 % up.
  assert.equal(s.trend.status, "up");
  assert.deepEqual(s.ready, { weight: 110, reps: 1 });
  // Ready to test: no pace, no date, and the test stands in for a check-in.
  assert.equal(s.pace, null);
  assert.equal(i.projected, null);
  assert.equal(s.checkin?.due, null);
  // The real lift reaches it.
  const done = goalInsight(
    bench(),
    [...ownerRecords(), workout("2026-11-16", [set(110, 1)])],
    { bodyWeightKg: null },
    TODAY,
  );
  assert.equal(done.progress.met, true);
  assert.equal(done.progress.reachedOn, TODAY);
  assert.equal(done.strength?.ready, null);
  assert.equal(done.strength?.checkin, null);
});

test("a due check-in becomes the first working set's target; ready, the top set's", () => {
  setCurrentWeightUnit("kg");
  // A goal of 120 × 1 is not within reach: a check-in instead. Made Monday
  // 5 October, its sixth session is Friday 23 October: due that week.
  const goal = bench({ targetKg: 120 });
  const today = goalInsight(
    goal,
    ownerRecords().slice(0, 10),
    { bodyWeightKg: null },
    "2026-10-21",
  );
  assert.equal(today.strength?.ready, null);
  assert.equal(today.strength?.checkin?.load, 102.5);
  assert.deepEqual(today.strength?.checkin?.due, {
    week: "2026-10-19",
    end: "2026-10-25",
  });
  const sets = [
    set(60, 10, { section: "warmup", done: false }),
    set(90, 7, { done: false }),
    set(90, 6, { done: false }),
  ];
  const w = {
    date: "2026-10-21",
    exercises: [
      { id: "e", exerciseId: "builtin:bench-press", name: "Bench Press", sets },
    ],
  };
  const targets = goalSetTargets(w, [{ goal, insight: today }]);
  assert.deepEqual([...targets.keys()], [sets[1].id]);
  const target = targets.get(sets[1].id)!;
  assert.equal(goalTargetText(target), "Check-in 102.5 × max");
  assert.equal(goalTargetLabel(target), "102.5 kg × max");
  // Outside the due week, nothing.
  assert.equal(
    goalSetTargets({ ...w, date: "2026-10-26" }, [{ goal, insight: today }])
      .size,
    0,
  );
  // Ready: the top set by its usual target suggests the goal's lift.
  const ready = goalInsight(
    bench(),
    ownerRecords(),
    { bodyWeightKg: null },
    TODAY,
  );
  const heavy = new Map([
    [sets[1].id, 90],
    [sets[2].id, 92.5],
  ]);
  const test = goalSetTargets(
    { ...w, date: TODAY },
    [{ goal: bench(), insight: ready }],
    (s) => heavy.get(s.id),
  );
  assert.deepEqual([...test.keys()], [sets[2].id]);
  assert.equal(goalTargetText(test.get(sets[2].id)!), "Test 110 × 1");
  // A met goal says nothing.
  const met = goalInsight(
    bench(),
    [...ownerRecords(), workout(TODAY, [set(110, 1)])],
    { bodyWeightKg: null },
    TODAY,
  );
  assert.equal(
    goalSetTargets({ ...w, date: TODAY }, [{ goal: bench(), insight: met }])
      .size,
    0,
  );
});

test("a bodyweight goal's targets read as added weight", () => {
  setCurrentWeightUnit("kg");
  const target = {
    kind: "checkin" as const,
    goalId: "g",
    weight: 5,
    reps: null,
    body: true,
  };
  assert.equal(goalTargetText(target), "Check-in +5 × max");
  assert.equal(goalTargetLabel(target), "BW + 5 kg × max");
  assert.equal(goalTargetText({ ...target, weight: 0 }), "Check-in BW × max");
  assert.equal(goalTargetLabel({ ...target, weight: 0 }), "BW × max");
});

test("a goal target fills the weight, and the reps unless they are max", () => {
  assert.deepEqual(
    goalFillSource(
      { weight: 92.5, reps: null, body: false },
      { measure: undefined },
    ),
    { load: "weight", weight: 92.5, reps: null, measure: undefined },
  );
  assert.deepEqual(
    goalFillSource({ weight: 110, reps: 1, body: false }, {}).reps,
    1,
  );
  assert.deepEqual(goalFillSource({ weight: 5, reps: null, body: true }, {}), {
    load: "bodyweight",
    extraWeight: true,
    weight: 5,
    reps: null,
    measure: undefined,
  });
  assert.equal(
    goalFillSource({ weight: 0, reps: null, body: true }, {}).weight,
    null,
  );
  // Filled into an open set: the weight changes, the reps stay to be typed.
  const open = set(90, 7, { done: false });
  const filled = fillFrom(
    open,
    goalFillSource({ weight: 92.5, reps: null, body: false }, open),
  );
  assert.deepEqual([filled.weight, filled.reps], [92.5, 7]);
});
