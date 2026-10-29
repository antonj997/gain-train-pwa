import test from "node:test";
import assert from "node:assert/strict";
import {
  labelSet,
  newSet,
  repeatExercises,
  validate,
  validSet,
  type Exercise,
  type RecordDoc,
  type Workout,
  type WorkoutSet,
} from "../src/data/model.ts";
import {
  comparableSets,
  estimate,
  progressFor,
} from "../src/data/analytics.ts";
import { suggestedExercises } from "../src/data/start.ts";
import {
  previousSetFor,
  setProfileMatches,
  setProfileOrdinal,
} from "../src/data/workouts.ts";
import { getSetIssues, finishWorkout } from "../src/lib/workout-editor.ts";
import { parseWorkoutDraft } from "../src/lib/drafts.ts";
import { toggleSetCompletion } from "../src/lib/set-editing.ts";
import { summarize, improvementRate } from "../src/data/summary.ts";

const setLoad = () => import("../src/lib/set-load.ts");

const set = (values: Partial<WorkoutSet> = {}): WorkoutSet => ({
  ...newSet(),
  load: "bodyweight",
  reps: 8,
  ...values,
});
const exercise = (sets: WorkoutSet[]): Exercise => ({
  id: crypto.randomUUID(),
  exerciseId: "builtin:pull-up",
  name: "Pull Up",
  sets,
});
const workout = (sets: WorkoutSet[]): Workout => ({
  name: "Bodyweight session",
  date: "2026-10-25",
  duration: 20,
  startedAt: null,
  status: "draft",
  exercises: [exercise(sets)],
});
const record = (sets: WorkoutSet[], date = "2026-10-25"): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  payload: { ...workout(sets), status: "completed", date },
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
});

test("extra bodyweight kilograms and profile snapshots survive backup and draft parsing", () => {
  const source = workout([
    set({ extraWeight: true, weight: 12.5, bodyWeightKg: 78, done: true }),
    set({ weight: null, done: true }),
  ]);
  const restored = validate(
    "workout",
    JSON.parse(JSON.stringify(source)),
  ) as Workout;
  assert.equal(restored.exercises[0].sets[0].extraWeight, true);
  assert.equal(restored.exercises[0].sets[0].weight, 12.5);
  assert.equal(restored.exercises[0].sets[0].bodyWeightKg, 78);
  assert.equal(restored.exercises[0].sets[1].extraWeight, undefined);
  assert.equal(validSet(restored.exercises[0].sets[1]), true);
  assert.equal(
    parseWorkoutDraft(source)?.exercises[0].sets[0].extraWeight,
    true,
  );
  const routine = validate("routine", {
    name: "Pull day",
    exercises: source.exercises,
  });
  assert.equal(
    (routine as { exercises: Exercise[] }).exercises[0].sets[0].extraWeight,
    true,
  );
});

test("extra bodyweight completion requires finite positive added kg including timed sets", () => {
  for (const weight of [null, 0, -1, NaN, Infinity, 10000.1]) {
    const candidate = set({ extraWeight: true, weight });
    assert.equal(validSet(candidate), false, `added kg ${weight}`);
    assert.match(
      getSetIssues(candidate).weight ?? "",
      /add|extra|greater than 0/i,
    );
    assert.throws(
      () => finishWorkout(workout([{ ...candidate, done: true }])),
      /checked|completed/i,
    );
  }
  for (const weight of [0.25, 10000]) {
    assert.equal(validSet(set({ extraWeight: true, weight })), true);
    assert.equal(
      validSet(set({ extraWeight: true, weight, measure: "seconds" })),
      true,
    );
  }
  assert.equal(validSet(set({ reps: 8, extraWeight: false })), true);
});

test("record validation allows an unfinished added-load field but rejects invalid populated kilograms", () => {
  assert.doesNotThrow(() =>
    validate("workout", workout([set({ extraWeight: true, weight: null })])),
  );
  for (const weight of [0, -1, NaN, Infinity, 10000.1])
    assert.throws(
      () => validate("workout", workout([set({ extraWeight: true, weight })])),
      /added|extra/i,
    );
  assert.throws(
    () =>
      validate(
        "workout",
        workout([set({ extraWeight: true, load: "weight", weight: 10 })]),
      ),
    /bodyweight|extra/i,
  );
});

test("new and repeated sets preserve added kg while clearing completion snapshots", () => {
  const prior = set({
    extraWeight: true,
    weight: 12.5,
    done: true,
    bodyWeightKg: 78,
    measure: "seconds",
  });
  const source = exercise([prior]);
  for (const fresh of [newSet(prior), repeatExercises([source])[0].sets[0]]) {
    assert.equal(fresh.extraWeight, true);
    assert.equal(fresh.weight, 12.5);
    assert.equal(fresh.reps, 8);
    assert.equal(fresh.measure, "seconds");
    assert.equal(fresh.done, false);
    assert.equal(fresh.bodyWeightKg, undefined);
    assert.notEqual(fresh.id, prior.id);
  }
  assert.equal(prior.bodyWeightKg, 78);
});

test("bodyweight labels name only added kg for repetitions and seconds", () => {
  assert.equal(
    labelSet(set({ extraWeight: true, weight: 12.5, bodyWeightKg: 78 })),
    "BW + 12.5 kg × 8",
  );
  assert.equal(
    labelSet(
      set({ extraWeight: true, weight: 5, measure: "seconds", reps: 30 }),
    ),
    "BW + 5 kg · 30 sec",
  );
  assert.equal(labelSet(set()), "BW × 8");
  assert.equal(labelSet(set({ measure: "seconds", reps: 30 })), "30 sec");
});

test("bodyweight comparisons separate plain, extra, weighted and assisted profiles", () => {
  const extra = set({ extraWeight: true, weight: 10 });
  assert.equal(comparableSets(extra, set()), false);
  assert.equal(comparableSets(set(), extra), false);
  assert.equal(
    comparableSets(extra, set({ extraWeight: true, weight: 15 })),
    false,
  );
  assert.equal(
    comparableSets(
      extra,
      set({ extraWeight: true, weight: 10, reps: 12, bodyWeightKg: 90 }),
    ),
    true,
  );
  assert.equal(
    comparableSets(extra, set({ load: "weight", weight: 10 })),
    false,
  );
  assert.equal(
    comparableSets(extra, set({ load: "assisted", weight: 10 })),
    false,
  );
  assert.equal(comparableSets(extra, { ...extra, measure: "seconds" }), false);
  assert.equal(estimate(extra), null);
  assert.equal(estimate({ ...extra, measure: "seconds" }), null);
});

test("previous results match added-load mode and kilograms independently from plain bodyweight", () => {
  const plain = set({ done: true, reps: 20 });
  const ten = set({ done: true, extraWeight: true, weight: 10, reps: 8 });
  const fifteen = set({ done: true, extraWeight: true, weight: 15, reps: 6 });
  const target = set({ extraWeight: true, weight: 10 });
  assert.equal(setProfileMatches(plain, target), false);
  assert.equal(setProfileMatches(ten, target), true);
  assert.equal(setProfileMatches(fifteen, target), false);
  assert.equal(previousSetFor([plain, fifteen, ten], target, 0), ten);
  assert.equal(previousSetFor([plain, fifteen], target, 0), undefined);
  assert.equal(previousSetFor([ten, plain], set(), 0), plain);
  assert.deepEqual(
    [ten, plain, fifteen, ten].map((_, index, sets) =>
      setProfileOrdinal(sets, index),
    ),
    [0, 0, 0, 1],
  );
});

test("routine suggestions preserve bodyweight mode and never borrow reps from a different added load", () => {
  const planned = exercise([
    set({ reps: null }),
    set({ extraWeight: true, weight: 10, reps: null }),
    set({ extraWeight: true, weight: 15, reps: 4 }),
    set({ extraWeight: true, weight: null, reps: null }),
  ]);
  const history = record([
    set({
      done: true,
      extraWeight: true,
      weight: 10,
      reps: 8,
      bodyWeightKg: 78,
    }),
    set({ done: true, reps: 20 }),
    set({ done: true, extraWeight: true, weight: 20, reps: 6 }),
  ]);
  const suggested = suggestedExercises([planned], [history])[0].sets;
  assert.deepEqual(
    suggested.map((s) => [s.extraWeight, s.weight, s.reps]),
    [
      [undefined, null, 20],
      [true, 10, 8],
      [true, 15, 4],
      [true, null, null],
    ],
  );
  assert.ok(suggested.every((s) => !s.done && s.bodyWeightKg === undefined));
});

test("progress selects extra-bodyweight performance at the latest added kg without estimating total load", () => {
  const session = record([
    set({ done: true, reps: 30 }),
    set({ done: true, extraWeight: true, weight: 5, reps: 15 }),
    set({ done: true, extraWeight: true, weight: 10, reps: 9 }),
    set({ done: true, extraWeight: true, weight: 10, reps: 7 }),
  ]);
  const [progress] = progressFor([session]);
  assert.equal(progress.points[0].set.weight, 10);
  assert.equal(progress.points[0].set.reps, 9);
  assert.equal(progress.points[0].e1rm, null);
  assert.equal(
    summarize([session.payload as Workout], 30, "2026-12-31").volume,
    0,
  );
  assert.equal(
    improvementRate(
      progressFor([
        record([set({ done: true, reps: 30 })], "2026-10-01"),
        record(
          [set({ done: true, extraWeight: true, weight: 10, reps: 8 })],
          "2026-10-20",
        ),
      ]),
      "2026-10-15",
      "2026-10-25",
    ),
    null,
  );
});

test("completion snapshots bodyweight independently of added kilograms", () => {
  const completed = toggleSetCompletion(
    set({ extraWeight: true, weight: 10 }),
    78,
  );
  assert.equal(completed.extraWeight, true);
  assert.equal(completed.weight, 10);
  assert.equal(completed.bodyWeightKg, 78);
  assert.equal(completed.done, true);
});

test("load, measure and extra-weight group changes leave every completed set untouched", async () => {
  const { changeSetLoad, changeSetMeasure, changeExtraWeight } =
    await setLoad();
  const completed = set({
    extraWeight: true,
    weight: 10,
    bodyWeightKg: 78,
    done: true,
  });
  assert.equal(changeSetLoad(completed, "assisted"), completed);
  assert.equal(changeSetMeasure(completed, "seconds"), completed);
  assert.equal(changeExtraWeight(completed, false), completed);
});

test("load changes clear incompatible kilograms, flags and snapshots while preserving other data", async () => {
  const { changeSetLoad } = await setLoad();
  const added = set({
    extraWeight: true,
    weight: 10,
    bodyWeightKg: 78,
    section: "warmup",
  });
  assert.deepEqual(changeSetLoad(added, "weight"), {
    id: added.id,
    load: "weight",
    reps: 8,
    weight: null,
    section: "warmup",
    done: false,
  });
  const timed = { ...added, measure: "seconds" as const, reps: 30 };
  const weighted = changeSetLoad(timed, "assisted");
  assert.equal(weighted.measure, "reps");
  assert.equal(weighted.reps, null);
  assert.equal(weighted.weight, null);
  const plain = changeSetLoad(
    set({ load: "weight", weight: 30 }),
    "bodyweight",
  );
  assert.equal(plain.weight, null);
  assert.equal(plain.reps, 8);
  assert.equal(added.weight, 10);
});

test("measure changes retain compatible BW added kilograms and reset repetitions and snapshots", async () => {
  const { changeSetMeasure } = await setLoad();
  const added = set({ extraWeight: true, weight: 10, bodyWeightKg: 78 });
  const timed = changeSetMeasure(added, "seconds");
  assert.equal(timed.load, "bodyweight");
  assert.equal(timed.extraWeight, true);
  assert.equal(timed.weight, 10);
  assert.equal(timed.reps, null);
  assert.equal(timed.bodyWeightKg, undefined);
  const reps = changeSetMeasure({ ...timed, reps: 30 }, "reps");
  assert.equal(reps.reps, null);
  assert.equal(reps.weight, 10);
  assert.equal(reps.extraWeight, true);
  const fromWeighted = changeSetMeasure(
    set({ load: "weight", weight: 30 }),
    "seconds",
  );
  assert.equal(fromWeighted.load, "bodyweight");
  assert.equal(fromWeighted.weight, null);
  assert.equal(fromWeighted.extraWeight, undefined);
});

test("extra-weight toggling starts with blank added kg and disabling removes added kg", async () => {
  const { hasExtraWeight, changeExtraWeight } = await setLoad();
  const plain = set({ weight: 80, bodyWeightKg: 78 });
  const added = changeExtraWeight(plain, true);
  assert.equal(hasExtraWeight(added), true);
  assert.equal(added.weight, null);
  assert.equal(added.bodyWeightKg, undefined);
  assert.equal(added.reps, 8);
  const disabled = changeExtraWeight({ ...added, weight: 10 }, false);
  assert.equal(hasExtraWeight(disabled), false);
  assert.equal(disabled.extraWeight, undefined);
  assert.equal(disabled.weight, null);
  const weighted = set({ load: "weight", weight: 30 });
  assert.equal(changeExtraWeight(weighted, true), weighted);
  assert.equal(hasExtraWeight({ ...weighted, extraWeight: true }), false);
});

test("unchanged load, measure and extra-weight choices preserve values and identity", async () => {
  const { changeSetLoad, changeSetMeasure, changeExtraWeight } =
    await setLoad();
  const added = set({ extraWeight: true, weight: 10, bodyWeightKg: 78 });
  assert.equal(changeSetLoad(added, "bodyweight"), added);
  assert.equal(changeSetMeasure(added, "reps"), added);
  assert.equal(changeExtraWeight(added, true), added);
  const plain = set();
  assert.equal(changeExtraWeight(plain, false), plain);
});
