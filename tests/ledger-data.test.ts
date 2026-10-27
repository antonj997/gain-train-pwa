import test from "node:test";
import assert from "node:assert/strict";
import {
  newSet,
  labelSet,
  validate,
  validSet,
  type Exercise,
  type RecordDoc,
  type Workout,
  type WorkoutSet,
} from "../src/data/model";
import { suggestedExercises } from "../src/data/start";
import { estimate, progressFor } from "../src/data/analytics";
import { improvementRate, summarize } from "../src/data/summary";
import {
  hasLoggedExercise,
  initialSet,
  previousSetFor,
  priorWorkouts,
  setProfileOrdinal,
} from "../src/data/workouts";
import { sortWorkoutsNewest } from "../src/data/selectors";

const set = (values: Partial<WorkoutSet> = {}): WorkoutSet => ({
  ...newSet(),
  weight: 50,
  reps: 8,
  done: true,
  ...values,
});
const exercise = (
  sets: WorkoutSet[],
  exerciseId = "builtin:bench-press",
): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: "Bench Press",
  sets,
});
const record = (
  exercises: Exercise[],
  values: Partial<Workout> = {},
): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name: "Test session",
    date: "2026-10-08",
    duration: null,
    startedAt: null,
    status: "completed",
    exercises,
    ...values,
  },
});

test("optional session times survive validation while old backups remain readable", () => {
  const old = record([exercise([set()])]).payload as Workout;
  assert.doesNotThrow(() => validate("workout", old));
  const parsed = validate("workout", {
    ...old,
    createdAt: 100,
    completedAt: 200,
  }) as Workout;
  assert.equal(parsed.createdAt, 100);
  assert.equal(parsed.completedAt, 200);
});

test("same-day routine suggestions use the later completed session", () => {
  const older = record([exercise([set({ weight: 50 })])], { completedAt: 100 });
  const newer = record([exercise([set({ weight: 60 })])], { completedAt: 200 });
  const planned = exercise([set({ weight: null, reps: null, done: false })]);
  assert.equal(
    suggestedExercises([planned], [older, newer])[0].sets[0].weight,
    60,
  );
});

test("suggestions preserve planned load and section and ignore unchecked historical sets", () => {
  const prior = record([
    exercise([
      set({ weight: 20, reps: 15, section: "warmup" }),
      set({ weight: 60, reps: 6 }),
      set({ weight: 99, reps: 9, done: false }),
    ]),
  ]);
  const planned = exercise([
    set({ weight: null, reps: null, done: false }),
    set({
      weight: null,
      reps: null,
      section: "winddown",
      load: "bodyweight",
      done: false,
    }),
    set({ weight: null, reps: null, done: false }),
  ]);
  const result = suggestedExercises([planned], [prior])[0];
  assert.equal(result.sets.length, 3);
  assert.equal(result.sets[0].section, "working");
  assert.equal(result.sets[0].weight, 60);
  assert.equal(result.sets[1].load, "bodyweight");
  assert.equal(result.sets[1].section, "winddown");
  assert.equal(result.sets[1].reps, null);
  assert.equal(result.sets[2].weight, 60);
  assert.ok(result.sets.every((s) => !s.done));
});

test("a repeated exercise contributes one session point using its best working set", () => {
  const session = record([
    exercise([set({ weight: 50 })]),
    exercise([set({ weight: 60 })]),
    exercise([set({ weight: 100, section: "warmup" })]),
  ]);
  const [item] = progressFor([session]);
  assert.equal(item.points.length, 1);
  assert.equal(item.points[0].set.weight, 60);
  assert.equal(item.points[0].workoutId, session.id);
});

test("same-day progress points follow session time, independent of record iteration order", () => {
  const older = record([exercise([set({ weight: 50 })])], { completedAt: 100 });
  const newer = record([exercise([set({ weight: 60 })])], { completedAt: 200 });
  assert.equal(progressFor([newer, older])[0].points.at(-1)!.set.weight, 60);
});

test("timed sets preserve seconds in repeats and label their actual measure", () => {
  const timed = set({
    load: "bodyweight",
    weight: null,
    reps: 60,
    measure: "seconds",
  });
  assert.equal(labelSet(timed), "60 sec");
  assert.equal(newSet(timed).measure, "seconds");
  const parsed = validate("routine", {
    name: "Core",
    exercises: [exercise([timed], "builtin:plank")],
  });
  assert.equal(
    (parsed as { exercises: Exercise[] }).exercises[0].sets[0].measure,
    "seconds",
  );
});

test("seconds never become lifted kilograms or an estimated one-rep maximum", () => {
  const weightedTime = set({ weight: 50, reps: 8, measure: "seconds" });
  assert.equal(estimate(weightedTime), null);
  assert.equal(
    summarize([record([exercise([weightedTime])]).payload as Workout], 30)
      .volume,
    0,
  );
});

test("improvement does not compare repetitions against timed holds", () => {
  const reps = record(
    [
      exercise(
        [set({ load: "bodyweight", weight: null, reps: 5 })],
        "builtin:plank",
      ),
    ],
    { date: "2026-09-01" },
  );
  const seconds = record(
    [
      exercise(
        [
          set({
            load: "bodyweight",
            weight: null,
            reps: 60,
            measure: "seconds",
          }),
        ],
        "builtin:plank",
      ),
    ],
    { date: "2026-10-01" },
  );
  assert.equal(
    improvementRate([reps, seconds], "2026-10-01", "2026-10-08"),
    null,
  );
});

test("invalid duration and set inputs produce field-specific validation errors", () => {
  const session = record([exercise([set()])]).payload;
  assert.throws(
    () => validate("workout", { ...session, duration: -1 }),
    /duration.*0.*1440/i,
  );
  assert.throws(
    () =>
      validate("workout", {
        ...session,
        exercises: [exercise([set({ reps: 1.5 })])],
      }),
    /reps.*whole/i,
  );
  assert.throws(
    () =>
      validate("workout", {
        ...session,
        exercises: [exercise([set({ weight: -1 })])],
      }),
    /weight.*0/i,
  );
});

test("changing a routine's set plan keeps historical values aligned within matching sections", () => {
  const prior = record([
    exercise([
      set({ weight: 20, section: "warmup" }),
      set({ weight: 50 }),
      set({ weight: 60 }),
      set({ weight: 70 }),
    ]),
  ]);
  const planned = exercise([set(), set(), set()]);
  assert.deepEqual(
    suggestedExercises([planned], [prior])[0].sets.map((s) => s.weight),
    [50, 60, 70],
  );
});

test("checked invalid draft sets are rejected before they enter the server queue", () => {
  const session = record([exercise([set({ reps: null })])], {
    status: "draft",
  }).payload;
  assert.throws(
    () => validate("workout", session),
    /checked.*reps|reps.*checked/i,
  );
});

test("workout ordering uses calendar date then completion, start, creation and deterministic identity", () => {
  const yesterday = record([], { date: "2026-10-07", completedAt: 99999 });
  const completed = record([], { completedAt: 500, startedAt: 900 });
  const started = record([], { startedAt: 400, createdAt: 999 });
  const created = record([], { createdAt: 300 });
  const oldA = { ...record([]), id: "00000000-0000-4000-8000-000000000001" };
  const oldB = { ...record([]), id: "00000000-0000-4000-8000-000000000002" };
  assert.deepEqual(
    [oldA, yesterday, created, completed, oldB, started]
      .sort(sortWorkoutsNewest)
      .map((r) => r.id),
    [completed.id, started.id, created.id, oldB.id, oldA.id, yesterday.id],
  );
});

test("new built-in bodyweight and timed movements can be completed without a kilogram entry", () => {
  const pushup = { ...initialSet("builtin:push-up"), reps: 12 };
  const plank = { ...initialSet("builtin:plank"), reps: 60 };
  assert.equal(pushup.load, "bodyweight");
  assert.equal(validSet(pushup), true);
  assert.equal(plank.measure, "seconds");
  assert.equal(validSet(plank), true);
  assert.equal(initialSet("builtin:bench-press").load, "weight");
  assert.equal(initialSet(crypto.randomUUID()).load, "weight");
});

test("blank exercise removal stays immediate while entered or completed rows are recognized", () => {
  assert.equal(
    hasLoggedExercise(exercise([initialSet("builtin:plank")])),
    false,
  );
  assert.equal(
    hasLoggedExercise(exercise([{ ...newSet(), weight: -1 }])),
    true,
  );
  assert.equal(hasLoggedExercise(exercise([{ ...newSet(), reps: 0 }])), true);
  assert.equal(hasLoggedExercise(exercise([set()])), true);
});

test("previous set matching never substitutes unchecked, warm-up, assisted or timed results", () => {
  const working = set({ weight: 50 });
  const prior = [
    set({ weight: 20, section: "warmup" }),
    working,
    set({ weight: 90, done: false }),
  ];
  assert.equal(previousSetFor(prior, newSet(), 0)?.weight, 50);
  assert.equal(
    previousSetFor(prior, { ...newSet(), load: "assisted" }, 1),
    undefined,
  );
  assert.equal(
    previousSetFor(
      [set({ load: "bodyweight", measure: "seconds" })],
      { ...newSet(), load: "bodyweight" },
      0,
    ),
    undefined,
  );
  assert.equal(
    previousSetFor([set({ measure: "reps" })], newSet(), 0)?.weight,
    50,
  );
});
test("previous set hints follow matching-profile ordinal when warm-up plans differ", () => {
  const prior = [
    set({ weight: 20, section: "warmup" }),
    set({ weight: 50 }),
    set({ weight: 60 }),
    set({ weight: 70 }),
  ];
  assert.deepEqual(
    [0, 1, 2].map((index) => previousSetFor(prior, newSet(), index)?.weight),
    [50, 60, 70],
  );
});
test("previous hints and routine suggestions agree for a mixed set plan", () => {
  const prior = [
    set({ weight: 20, section: "warmup" }),
    set({ weight: 50 }),
    set({ weight: 60 }),
    set({ weight: 70 }),
  ];
  const plan = [newSet({ section: "warmup" }), newSet(), newSet(), newSet()];
  const hinted = plan.map(
    (current, index) =>
      previousSetFor(prior, current, setProfileOrdinal(plan, index))?.weight,
  );
  assert.deepEqual(hinted, [20, 50, 60, 70]);
  assert.deepEqual(
    suggestedExercises(
      [exercise(plan)],
      [record([exercise(prior)])],
    )[0].sets.map((s) => s.weight),
    hinted,
  );
});
test("editing an earlier same-day session excludes later sessions from previous hints", () => {
  const older = record([exercise([set({ weight: 40 })])], { completedAt: 100 });
  const current = record([exercise([set({ weight: 50 })])], {
    completedAt: 200,
  });
  const later = record([exercise([set({ weight: 60 })])], { completedAt: 300 });
  assert.deepEqual(
    priorWorkouts([later, current, older], current, "2026-10-08").map(
      (r) => r.id,
    ),
    [older.id],
  );
  const draft = {
    ...current,
    payload: { ...current.payload, status: "draft" } as Workout,
  };
  assert.deepEqual(
    priorWorkouts([later, current, older], draft, "2026-10-08").map(
      (r) => r.id,
    ),
    [later.id, older.id],
  );
});
test("calendar validation stays on the logged date even in UTC+14", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati";
  try {
    assert.doesNotThrow(() =>
      validate(
        "workout",
        record([], { status: "draft", date: "2026-10-08" }).payload,
      ),
    );
    assert.throws(
      () =>
        validate(
          "workout",
          record([], { status: "draft", date: "2026-02-30" }).payload,
        ),
      /valid workout date/i,
    );
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
