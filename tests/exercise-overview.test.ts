import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, WorkoutSet } from "../src/data/model";
import type { ExerciseSession } from "../src/data/exercise-records";
import {
  addedLoadLabel,
  axisLabel,
  bestPointIndex,
  chartSeries,
  defaultMetric,
  deltaText,
  exerciseOverview,
  nextTarget,
  niceTicks,
  overviewRecords,
  overviewStats,
  pointCaption,
  setDeltas,
  signedLoad,
  strengthBodyweight,
  strengthOf,
  targetText,
  trendVerdict,
} from "../src/data/exercise-overview";
import { setCurrentLanguage } from "../src/i18n";

/** The verdict keeps each set on one line with no-break spaces. */
const verdictOf = (overview: Parameters<typeof trendVerdict>[0]) =>
  trendVerdict(overview).replace(/\u00a0/g, " ");

let n = 0;
const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${++n}`,
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
const kg = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}) =>
  set({ weight, reps, ...extra });
const bw = (reps: number, extra: Partial<WorkoutSet> = {}) =>
  set({ load: "bodyweight", weight: null, reps, ...extra });
const plus = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}) =>
  set({ load: "bodyweight", extraWeight: true, weight, reps, ...extra });

/** Sessions given oldest first, returned newest first as exerciseSessions does. */
const sessions = (...list: [string, WorkoutSet[]][]): ExerciseSession[] =>
  list
    .map(([date, sets], i) => ({
      workoutId: `w${i}`,
      date,
      workoutName: "Push",
      sets,
    }))
    .reverse();

const overviewOf = (list: ExerciseSession[], body: number | null = null) => {
  const overview = exerciseOverview(list, body);
  assert.ok(overview);
  return overview;
};

const bench = sessions(
  [
    "2026-08-26",
    [kg(40, 10, { section: "warmup" }), kg(80, 5), kg(80, 5), kg(80, 4)],
  ],
  ["2026-09-02", [kg(80, 6), kg(80, 5), kg(80, 5)]],
  ["2026-11-04", [kg(85, 8), kg(85, 7), kg(85, 6)]],
  [
    "2026-11-11",
    [kg(87.5, 5), kg(87.5, 5), kg(87.5, 4), kg(60, 8, { drop: true })],
  ],
);

test("a weighted exercise opens on the top set and offers strength and volume", () => {
  const overview = overviewOf(bench);
  assert.equal(overview.kind, "weighted");
  assert.deepEqual(overview.metrics, ["top", "e1rm", "volume"]);
  assert.equal(defaultMetric(overview.kind), "top");
  assert.equal(overview.sessions.length, 4);
  // Warm-ups are left out; the drop counts towards volume, not the sets.
  assert.equal(overview.sessions[0].main.length, 3);
  assert.equal(overview.sessions[3].main.length, 3);
  assert.equal(overview.sessions[3].volume, 87.5 * 14 + 60 * 8);
});

test("the verdict says how the top set's weight moved and over how long", () => {
  assert.equal(verdictOf(overviewOf(bench)), "Up 7.5 kg in 11 weeks");
  const down = sessions(
    ["2026-11-01", [kg(90, 5)]],
    ["2026-11-11", [kg(85, 5)]],
  );
  assert.equal(verdictOf(overviewOf(down)), "Down 5 kg in 10 days");
  const reps = sessions(
    ["2026-10-21", [kg(80, 5)]],
    ["2026-11-11", [kg(80, 7)]],
  );
  assert.equal(
    verdictOf(overviewOf(reps)),
    "Same weight, up 2 reps in 3 weeks",
  );
  const fewer = sessions(
    ["2026-11-04", [kg(80, 6)]],
    ["2026-11-11", [kg(80, 5)]],
  );
  assert.equal(
    verdictOf(overviewOf(fewer)),
    "Same weight, down 1 rep in 7 days",
  );
  const same = sessions(
    ["2026-10-21", [kg(80, 5)]],
    ["2026-11-11", [kg(80, 5)]],
  );
  assert.equal(verdictOf(overviewOf(same)), "Same as 3 weeks ago");
  const sameDay = sessions(
    ["2026-11-11", [kg(80, 5)]],
    ["2026-11-11", [kg(80, 5)]],
  );
  assert.equal(verdictOf(overviewOf(sameDay)), "Same as the first session");
  const one = sessions(["2026-11-11", [kg(80, 5)]]);
  assert.equal(verdictOf(overviewOf(one)), "First session");
});

test("bodyweight verdicts name the sets when the added weight changed", () => {
  const pull = sessions(
    ["2026-09-30", [bw(8), bw(7)]],
    ["2026-11-11", [plus(10, 7), plus(10, 5)]],
  );
  assert.equal(
    verdictOf(overviewOf(pull)),
    "From BW × 8 to BW + 10 kg × 7 in 6 weeks",
  );
  const abs = sessions(
    ["2026-09-30", [bw(8), bw(8)]],
    ["2026-11-11", [bw(11), bw(10)]],
  );
  assert.equal(verdictOf(overviewOf(abs)), "Up 3 reps in 6 weeks");
  const plank = sessions(
    ["2026-11-01", [bw(45, { measure: "seconds" })]],
    ["2026-11-11", [bw(60, { measure: "seconds" })]],
  );
  assert.equal(verdictOf(overviewOf(plank)), "Up 15 s in 10 days");
});

test("the verdict reads in Swedish", () => {
  setCurrentLanguage("sv");
  try {
    assert.equal(verdictOf(overviewOf(bench)), "Upp 7,5 kg på 11 veckor");
    const pull = sessions(
      ["2026-09-30", [bw(8)]],
      ["2026-11-11", [plus(10, 7)]],
    );
    assert.equal(
      verdictOf(overviewOf(pull)),
      "Från KV × 8 till KV + 10 kg × 7 på 6 veckor",
    );
  } finally {
    setCurrentLanguage("en");
  }
});

test("kinds: added weight, plain bodyweight and holds pick their metrics", () => {
  const pull = sessions(["2026-11-04", [bw(9)]], ["2026-11-11", [plus(5, 7)]]);
  assert.equal(overviewOf(pull).kind, "bodyweight");
  // No bodyweight anywhere: no Strength chip.
  assert.deepEqual(overviewOf(pull).metrics, ["top", "total"]);
  assert.deepEqual(overviewOf(pull, 80).metrics, ["top", "e1rm", "total"]);
  const assisted = sessions([
    "2026-11-11",
    [set({ load: "assisted", weight: 20, reps: 8 })],
  ]);
  assert.equal(overviewOf(assisted).kind, "bodyweight");
  const abs = sessions(["2026-11-11", [bw(10)]]);
  assert.equal(overviewOf(abs).kind, "reps");
  assert.deepEqual(overviewOf(abs).metrics, ["best", "total"]);
  assert.equal(defaultMetric("reps"), "best");
  const plank = sessions(["2026-11-11", [bw(60, { measure: "seconds" })]]);
  assert.equal(overviewOf(plank).kind, "timed");
  assert.equal(exerciseOverview([], null), null);
});

test("each set is compared with the same set last session", () => {
  const deltas = setDeltas(
    [kg(80, 6), kg(80, 5), kg(80, 6), kg(80, 4)],
    [kg(80, 5), kg(80, 5), kg(80, 7)],
  );
  assert.deepEqual(
    deltas.map((d) => d && deltaText(d)),
    ["1 more", "same", "1 fewer", null],
  );
  // A new load: the first changed row says so and the others say nothing.
  const heavier = setDeltas(
    [kg(85, 5), kg(85, 5), kg(80, 6)],
    [kg(80, 8), kg(80, 7), kg(80, 6)],
  );
  assert.deepEqual(
    heavier.map((d) => d && deltaText(d)),
    ["new weight", null, "same"],
  );
  const lighter = setDeltas([plus(5, 8)], [plus(10, 6)]);
  assert.deepEqual(
    lighter.map((d) => d && deltaText(d)),
    ["lighter"],
  );
  // Less assistance is more load.
  const assisted = setDeltas(
    [set({ load: "assisted", weight: 10, reps: 6 })],
    [set({ load: "assisted", weight: 20, reps: 6 })],
  );
  assert.equal(assisted[0]?.kind, "heavier");
  // Drops and warm-ups are skipped; holds count seconds.
  const holds = setDeltas(
    [bw(10, { section: "warmup" }), bw(65, { measure: "seconds" })],
    [bw(60, { measure: "seconds" })],
  );
  assert.deepEqual(
    holds.map((d) => d && deltaText(d)),
    ["5 s longer"],
  );
  assert.deepEqual(setDeltas([kg(80, 5)], null), [null]);
});

test("Top set charts the top set's load with its reps; Volume and Reps add up the session", () => {
  const overview = overviewOf(bench);
  const top = chartSeries(overview.sessions, "top", "kg");
  assert.deepEqual(
    top.map((p) => [p.value, p.bar]),
    [
      [80, 5],
      [80, 6],
      [85, 8],
      [87.5, 5],
    ],
  );
  const volume = chartSeries(overview.sessions, "volume", "kg");
  assert.equal(volume[0].value, 80 * 14);
  assert.equal(volume[0].bar, null);
  const e1rm = chartSeries(overview.sessions, "e1rm", "kg");
  assert.equal(
    Number(e1rm[2].value.toFixed(2)),
    Number((85 * (1 + 8 / 30)).toFixed(2)),
  );
  // In pounds the loads are converted.
  const pounds = chartSeries(overview.sessions, "top", "lb");
  assert.equal(pounds[0].value.toFixed(1), "176.4");

  const pull = overviewOf(
    sessions(
      ["2026-11-04", [bw(9), bw(8)]],
      ["2026-11-11", [plus(10, 6), plus(10, 5), plus(5, 7, { drop: true })]],
    ),
  );
  assert.deepEqual(
    chartSeries(pull.sessions, "top", "kg").map((p) => p.value),
    [0, 10],
  );
  assert.deepEqual(
    chartSeries(pull.sessions, "total", "kg").map((p) => p.value),
    [17, 18],
  );
  const abs = overviewOf(
    sessions(["2026-11-04", [bw(9), bw(12)]], ["2026-11-11", [bw(11)]]),
  );
  assert.deepEqual(
    chartSeries(abs.sessions, "best", "kg").map((p) => p.value),
    [12, 11],
  );
  assert.equal(bestPointIndex(chartSeries(abs.sessions, "best", "kg")), 0);
});

test("a bodyweight 1RM is worked out on the whole load and shown as added weight", () => {
  const strength = strengthOf(plus(10, 7, { bodyWeightKg: 88 }));
  assert.ok(strength);
  assert.equal(strength.whole.toFixed(1), "120.9");
  assert.equal(strength.shown.toFixed(1), "32.9");
  assert.equal(addedLoadLabel(strength.shown, "kg", 0), "BW + 33 kg");
  assert.equal(addedLoadLabel(strength.shown, "kg", 1), "BW + 32.9 kg");
  // Assisted: below bodyweight. Without a bodyweight: the profile's, else none.
  const assisted = strengthOf(
    set({ load: "assisted", weight: 30, reps: 10 }),
    80,
  );
  assert.equal(
    assisted?.shown.toFixed(1),
    (50 * (1 + 10 / 30) - 80).toFixed(1),
  );
  assert.equal(addedLoadLabel(-12, "kg"), "BW − 12 kg");
  assert.equal(addedLoadLabel(0.02, "kg", 0), "BW");
  assert.equal(strengthOf(plus(10, 7)), null);
  assert.equal(strengthOf(plus(10, 12, { bodyWeightKg: 80 })), null);
  assert.equal(signedLoad(set({ load: "assisted", weight: 20 })), -20);

  const pull = overviewOf(
    sessions(
      ["2026-11-04", [bw(9, { bodyWeightKg: 88 })]],
      ["2026-11-11", [plus(10, 7, { bodyWeightKg: 88 })]],
    ),
  );
  const series = chartSeries(pull.sessions, "e1rm", "kg");
  assert.equal(series[1].value.toFixed(1), "32.9");
  assert.equal(
    pointCaption(series[1], pull.kind, "e1rm", "kg"),
    "BW + 10 kg × 7 → est. 1RM BW + 32.9 kg (whole load 120.9 kg)",
  );
  assert.equal(axisLabel(10, "bodyweight", "top", { unit: "kg" }), "+10");
  assert.equal(axisLabel(0, "bodyweight", "e1rm", { unit: "kg" }), "BW");
  assert.equal(axisLabel(-5, "bodyweight", "top", { unit: "kg" }), "−5");
  assert.equal(axisLabel(87.5, "weighted", "top", { unit: "kg" }), "87.5");
  assert.equal(
    axisLabel(2500, "weighted", "volume", { unit: "kg", thousands: true }),
    "2.5 t",
  );
  assert.equal(strengthBodyweight(pull), 88);
  const rows = overviewRecords(pull, [], "kg");
  const e1rm = rows.find((row) => row.key === "e1rm");
  assert.equal(e1rm?.value, "BW + 33 kg");
  assert.equal(e1rm?.sub, "whole load 120.9 kg");
});

test("captions name the session's sets", () => {
  const overview = overviewOf(bench);
  const top = chartSeries(overview.sessions, "top", "kg");
  assert.equal(
    pointCaption(top[3], "weighted", "top", "kg"),
    "87.5 kg × 5 · 3 sets (5, 5, 4)",
  );
  const volume = chartSeries(overview.sessions, "volume", "kg");
  assert.equal(
    pointCaption(volume[3], "weighted", "volume", "kg"),
    "session volume 1.7 t · 3 sets",
  );
  const abs = overviewOf(sessions(["2026-11-11", [bw(11), bw(10), bw(9)]]));
  const reps = chartSeries(abs.sessions, "total", "kg");
  assert.equal(
    pointCaption(reps[0], "reps", "total", "kg"),
    "11 + 10 + 9 = 30 reps",
  );
});

test("gridlines fall on round numbers", () => {
  assert.deepEqual(niceTicks(79, 88.5), [80, 85]);
  assert.deepEqual(niceTicks(99, 106), [100, 102.5, 105]);
  assert.deepEqual(niceTicks(-0.9, 10.9), [0, 5, 10]);
  assert.deepEqual(niceTicks(7.5, 12.5, true), [8, 10, 12]);
  assert.deepEqual(niceTicks(5, 5), [5]);
});

test("stats count sessions in 30 days, working sets per week over 4 weeks and all sessions", () => {
  const list = sessions(
    ["2026-09-01", [kg(80, 5), kg(80, 5)]],
    ["2026-10-15", [kg(80, 5), kg(80, 5)]],
    [
      "2026-10-20",
      [kg(40, 10, { section: "warmup" }), kg(80, 5), kg(80, 5), kg(80, 5)],
    ],
    [
      "2026-11-10",
      [kg(80, 5), kg(80, 5), kg(80, 5), kg(60, 8, { drop: true })],
    ],
  );
  const stats = overviewStats(list, "2026-11-14");
  // 15 Oct is 30 days before 14 Nov: the window is 16 Oct to 14 Nov.
  assert.equal(stats.last30, 2);
  assert.equal(stats.setsPerWeek, 6 / 4);
  assert.equal(stats.total, 4);
});

test("records: heaviest, most reps and estimated 1RM; plain bodyweight counts reps", () => {
  const rows = overviewRecords(overviewOf(bench), bench, "kg");
  assert.deepEqual(
    rows.map((row) => [row.title, row.value, row.date, !!row.pill]),
    [
      ["Heaviest lift", "87.5 kg × 5", "2026-11-11", true],
      ["Most reps", "85 kg × 8", "2026-11-04", false],
      ["Est. 1RM", "107.7 kg", "2026-11-04", false],
    ],
  );
  const abs = sessions(
    ["2026-11-04", [bw(12), bw(10), bw(8)]],
    ["2026-11-11", [bw(11), bw(10), bw(9)]],
  );
  assert.deepEqual(
    overviewRecords(overviewOf(abs), abs, "kg").map((row) => [
      row.title,
      row.value,
      row.date,
    ]),
    [
      ["Most reps in a set", "BW × 12", "2026-11-04"],
      ["Most reps in a session", "30 reps", "2026-11-04"],
    ],
  );
});

test("the next target follows the workout's rule from the latest top set", () => {
  const workout = (
    id: string,
    date: string,
    sets: WorkoutSet[],
  ): RecordDoc => ({
    id,
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
      exercises: [{ id: id + "x", exerciseId: "bench", name: "Bench", sets }],
    },
  });
  const last = [kg(87.5, 5), kg(87.5, 5), kg(87.5, 4)];
  const records = [
    workout("a", "2026-11-04", [kg(85, 8), kg(85, 7)]),
    workout("b", "2026-11-11", last),
  ];
  const next = nextTarget(records, "bench", last[0].id, "kg");
  assert.ok(next);
  assert.equal(targetText(next.target, next.last), "87.5 kg × 6");
  assert.equal(nextTarget(records, "bench", "missing", "kg"), null);
  // Plain bodyweight adds a rep.
  const abs = [bw(11), bw(10)];
  const absNext = nextTarget(
    [workout("c", "2026-11-11", abs)],
    "bench",
    abs[0].id,
    "kg",
  );
  assert.ok(absNext);
  assert.equal(targetText(absNext.target, absNext.last), "BW × 12");
});
