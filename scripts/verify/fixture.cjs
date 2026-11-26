// The verify harness's seeded log: what a phone that has trained for a while
// holds. Pure data, built for the harness's fixed clock (Thursday 19
// November 2026, 10:00 in Stockholm), so every run sees the same screens.
//
// - Eight weeks of workouts, Benpass on Thursdays and Tryckpass on Mondays,
//   with weights that climb, so records fall out of them.
// - The plan "Styrkeblock", eight weeks from Monday 19 October (four weeks
//   before the clock's week): Tryckpass on Mondays and Benpass on Thursdays.
//   This week's Monday was moved to Tuesday 17 November, where it was done.
// - A running Benpass draft today, two sets checked.
// - One custom cable exercise, "Knästående pallofpress" (Core), in Tryckpass.
//
// A phase that needs more adds scripts/verify/fixture-<phase>.cjs exporting
// (fixture) => fixture; the harness applies it after this one.

/** The harness's fixed clock. */
const NOW = new Date("2026-11-19T10:00:00+01:00");
/** The account a phone without sign-in logs under (src/lib/auth-account.ts). */
const ACCOUNT = "phone";

/** A stable UUID per number, so ids never change between runs. */
const uuid = (n) =>
  "00000000-0000-4000-8000-" + n.toString(16).padStart(12, "0");

const ids = {
  plan: uuid(1),
  benpass: uuid(2),
  tryckpass: uuid(3),
  pallof: uuid(4),
  draft: uuid(5),
};
let next = 1000;
const id = () => uuid(next++);

/** Adds days to an ISO date ("2026-11-19"). */
function addDays(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** The epoch ms of a local Stockholm time on a date (CET in November). */
const at = (date, hour, minute = 0) =>
  new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+01:00`,
  ).getTime();

const record = (kind, recordId, payload) => ({
  id: recordId,
  kind,
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: { schemaVersion: 2, ...payload },
});

const set = (weight, reps, extra = {}) => ({
  id: id(),
  reps,
  weight,
  load: "weight",
  section: "working",
  done: true,
  ...extra,
});
const sets = (count, weight, reps, extra) =>
  Array.from({ length: count }, () => set(weight, reps, extra));

const exercise = (exerciseId, name, exerciseSets, repRange) => ({
  id: id(),
  exerciseId,
  name,
  sets: exerciseSets,
  ...(repRange ? { repRange } : {}),
});

/** Weights for week k (0 = the first of the eight). */
const benpassExercises = (k) => [
  exercise(
    "builtin:squat",
    "Squat",
    [
      set(40, 8, { section: "warmup" }),
      ...sets(3, 80 + 2.5 * k, 5),
    ],
    { min: 5, max: 7 },
  ),
  exercise("builtin:romanian-deadlift", "Romanian Deadlift", sets(3, 70 + 2.5 * k, 8), {
    min: 8,
    max: 10,
  }),
  exercise("builtin:standing-calf-raise", "Standing Calf Raise", sets(3, 60 + 5 * Math.floor(k / 2), 12), {
    min: 10,
    max: 15,
  }),
];
const tryckpassExercises = (k) => [
  exercise(
    "builtin:bench-press",
    "Bench Press",
    [set(40, 8, { section: "warmup" }), ...sets(3, 60 + 2.5 * k, 5)],
    { min: 5, max: 7 },
  ),
  exercise("builtin:overhead-press", "Overhead Press", sets(3, 35 + 2.5 * Math.floor(k / 2), 6), {
    min: 6,
    max: 8,
  }),
  exercise("builtin:tricep-pushdown", "Tricep Pushdown", sets(3, 25 + 2.5 * Math.floor(k / 2), 12), {
    min: 10,
    max: 12,
  }),
  exercise(ids.pallof, "Knästående pallofpress", sets(3, 10, 10), {
    min: 8,
    max: 12,
  }),
];

const PLAN_START = "2026-10-19";
const PLAN_WEEKS = 8;
/** The plan's week (1-based) for a date, or null outside it. */
function planWeek(date) {
  const days = Math.round(
    (new Date(date + "T12:00:00Z") - new Date(PLAN_START + "T12:00:00Z")) /
      86400000,
  );
  const week = Math.floor(days / 7) + 1;
  return days >= 0 && week <= PLAN_WEEKS ? week : null;
}
const planMark = (date) => {
  const week = planWeek(date);
  return week ? { plan: { planId: ids.plan, week, weeks: PLAN_WEEKS } } : {};
};

function completed(name, routineId, date, hour, exercises, minutes) {
  const start = at(date, hour);
  return record("workout", id(), {
    routineId,
    name,
    date,
    duration: minutes,
    startedAt: null,
    createdAt: start,
    completedAt: start + minutes * 60000,
    status: "completed",
    exercises,
    ...planMark(date),
  });
}

function build() {
  next = 1000;
  const records = [];
  const firstMonday = "2026-09-21";
  for (let k = 0; k < 8; k++) {
    const monday = addDays(firstMonday, 7 * k);
    records.push(
      completed("Tryckpass", ids.tryckpass, monday, 17, tryckpassExercises(k), 52),
      completed("Benpass", ids.benpass, addDays(monday, 3), 17, benpassExercises(k), 48),
    );
  }
  // This week: Monday's Tryckpass was moved to Tuesday and done there.
  records.push(
    completed("Tryckpass", ids.tryckpass, "2026-11-17", 18, tryckpassExercises(8), 55),
  );
  // Today: Benpass under way, the squat's warm-up and first set checked.
  const today = benpassExercises(8);
  today[0].sets.forEach((s, i) => (s.done = i < 2));
  today.slice(1).forEach((ex) => ex.sets.forEach((s) => (s.done = false)));
  records.push(
    record("workout", ids.draft, {
      routineId: ids.benpass,
      name: "Benpass",
      date: "2026-11-19",
      duration: null,
      startedAt: NOW.getTime() - 20 * 60000,
      createdAt: NOW.getTime() - 20 * 60000,
      status: "draft",
      exercises: today,
      ...planMark("2026-11-19"),
    }),
  );

  const planned = (exercises) =>
    exercises.map((ex) => ({
      ...ex,
      id: id(),
      sets: ex.sets
        .filter((s) => s.section === "working")
        .map((s) => ({ ...s, id: id(), weight: null, done: false })),
    }));
  records.push(
    record("routine", ids.benpass, {
      name: "Benpass",
      exercises: planned(benpassExercises(0)),
    }),
    record("routine", ids.tryckpass, {
      name: "Tryckpass",
      exercises: planned(tryckpassExercises(0)),
    }),
    record("exercise", ids.pallof, {
      name: "Knästående pallofpress",
      category: "Core",
      note: "",
      favourite: false,
      equipment: "cable",
      icon: "cable",
      measure: "reps",
      muscles: { abs: 1, obliques: 0.5 },
    }),
    record("plan", ids.plan, {
      name: "Styrkeblock",
      startDate: PLAN_START,
      endDate: addDays(PLAN_START, 7 * PLAN_WEEKS - 1),
      cycleWeeks: 1,
      template: [[ids.tryckpass, null, null, ids.benpass, null, null, null]],
      overrides: { "2026-11-16": null, "2026-11-17": ids.tryckpass },
      goalIds: [],
    }),
  );

  return {
    account: ACCOUNT,
    /** The LocalState stored under the account in IndexedDB gain-train-v2. */
    state: {
      records: Object.fromEntries(records.map((r) => [r.id, r])),
      outbox: [],
      cursor: 0,
    },
    /** localStorage entries; the harness adds the theme per run. */
    local: {
      // Every tip seen, so no bubble appears mid-check.
      "gt-tips-seen": JSON.stringify([
        "weekStrip",
        "swipeRoutine",
        "libraryExercise",
        "calendarDay",
        "swipeSet",
      ]),
      "gt-weekly-goal": "3",
      // Chosen, so the one-time prompt for older logs stays away.
      "gt-language": "sv",
    },
  };
}

module.exports = { NOW, ACCOUNT, ids, uuid, build };
