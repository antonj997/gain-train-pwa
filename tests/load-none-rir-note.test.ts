import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  RecordValidationError,
  labelSet,
  newSet,
  setSchema,
  validSet,
  validate,
  type Workout,
  type WorkoutSet,
} from "../src/data/model";
import { readAccount, transact } from "../src/data/database";
import { estimate } from "../src/data/estimate";
import { summarize } from "../src/data/summary";
import { exerciseRecords } from "../src/data/exercise-records";
import { improvedSince } from "../src/data/set-improvement";
import {
  needsNewerServer,
  syncAccount,
  type Transport,
} from "../src/data/sync";
import {
  changeSetLoad,
  changeSetMeasure,
  hasWeightField,
  holdAllowsLoad,
} from "../src/lib/set-load";
import { loadKeyOf, loadMarker, withLoadKey } from "../src/lib/load-keys";
import { getSetIssues } from "../src/lib/workout-editor";
import { parseSharedSet } from "../src/lib/shared-routines";
import { rirLabel, rirOf, rirValueText, withRir } from "../src/lib/rir";
import {
  WORKOUT_NOTE_MAX,
  cleanWorkoutNote,
  withWorkoutNote,
  workoutNoteOf,
} from "../src/lib/workout-note";
import { setCurrentLanguage } from "../src/i18n";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 10,
  weight: null,
  load: "none",
  section: "working",
  done: true,
  ...overrides,
});
const workout = (sets: WorkoutSet[], extra: Partial<Workout> = {}) => ({
  name: "Mobility",
  date: "2026-11-10",
  duration: 20,
  startedAt: null,
  status: "completed" as const,
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "builtin:plank",
      name: "Plank",
      sets,
    },
  ],
  ...extra,
});

test("load none: a valid set has no weight, with reps or seconds", () => {
  assert.ok(validSet(set()));
  assert.ok(validSet(set({ measure: "seconds", reps: 60 })));
  assert.ok(!validSet(set({ weight: 10 })));
  assert.ok(!validSet(set({ reps: null })));
  const saved = validate("workout", workout([set()]));
  assert.equal(saved.exercises[0].sets[0].load, "none");
  assert.throws(
    () => validate("workout", workout([set({ weight: 5 })])),
    RecordValidationError,
  );
  // Even an unchecked one may not carry a weight.
  assert.throws(
    () =>
      validate("workout", workout([set(), set({ done: false, weight: 5 })])),
    RecordValidationError,
  );
});

test("load none: volume, estimated maxes and records skip it", () => {
  const sets = [set(), set({ reps: 20 })];
  assert.equal(estimate(set()), null);
  const totals = summarize([workout(sets) as Workout], 1, "2026-11-10");
  assert.equal(totals.volume, 0);
  assert.equal(totals.workingSets, 2);
  const records = exerciseRecords(
    [
      {
        id: crypto.randomUUID(),
        kind: "workout",
        revision: 1,
        localVersion: 1,
        dirty: false,
        deleted: false,
        payload: workout(sets),
      },
    ],
    "builtin:plank",
  );
  assert.equal(records.bestE1rm, null);
  assert.equal(records.heaviest, null);
  assert.equal(records.bestSetVolume, null);
  assert.equal(records.bestSessionVolume, null);
});

test("load none: labels, keys, issues and improvement", () => {
  setCurrentLanguage("en");
  assert.equal(labelSet(set()), "10 reps");
  assert.equal(labelSet(set({ measure: "seconds", reps: 45 })), "45 sec");
  setCurrentLanguage("sv");
  assert.equal(labelSet(set()), "10 reps");
  setCurrentLanguage("en");
  assert.equal(loadKeyOf(set()), "none");
  assert.equal(loadMarker(set(), "weight"), "noload");
  assert.equal(hasWeightField(set()), false);
  assert.deepEqual(getSetIssues(set({ done: false })), {});
  const open = set({ done: false, load: "weight", weight: 40, reps: null });
  const none = withLoadKey(open, "none");
  assert.equal(none.load, "none");
  assert.equal(none.weight, null);
  // More reps is better; there is no weight to compare.
  assert.ok(improvedSince(set({ reps: 10 }), set({ reps: 12 })));
  assert.ok(!improvedSince(set({ reps: 12 }), set({ reps: 12 })));
});

test("a new set copies the load none but not the reps in reserve", () => {
  const next = newSet(set({ rir: 2 }));
  assert.equal(next.load, "none");
  assert.equal(next.weight, null);
  assert.equal("rir" in next, false);
});

test("holds may carry a weight or no load, never assistance", () => {
  const hold = (overrides: Partial<WorkoutSet>) =>
    set({ measure: "seconds", reps: 60, ...overrides });
  assert.ok(validSet(hold({ load: "weight", weight: 24 })));
  assert.ok(
    validSet(hold({ load: "bodyweight", extraWeight: true, weight: 10 })),
  );
  assert.ok(validSet(hold({ load: "bodyweight" })));
  assert.ok(validSet(hold({})));
  assert.ok(!validSet(hold({ load: "assisted", weight: 10 })));
  assert.ok(!holdAllowsLoad("assisted"));
  validate("workout", workout([hold({ load: "weight", weight: 24 })]));
  assert.throws(
    () =>
      validate("workout", workout([hold({ load: "assisted", weight: 10 })])),
    RecordValidationError,
  );
  setCurrentLanguage("en");
  assert.equal(
    labelSet(hold({ load: "weight", weight: 24 })),
    "24 kg · 60 sec",
  );
  setCurrentLanguage("sv");
  assert.equal(
    labelSet(hold({ load: "weight", weight: 24 })),
    "24 kg · 60 sek",
  );
  setCurrentLanguage("en");
  // A weighted hold is not volume or an estimate.
  assert.equal(estimate(hold({ load: "weight", weight: 24 })), null);
  assert.equal(
    summarize(
      [workout([hold({ load: "weight", weight: 24 })]) as Workout],
      1,
      "2026-11-10",
    ).volume,
    0,
  );
  // More weight for as long is better.
  assert.ok(
    improvedSince(
      hold({ load: "weight", weight: 16 }),
      hold({ load: "weight", weight: 20 }),
    ),
  );
});

test("changing load keeps a hold unless it becomes assisted", () => {
  const hold = set({
    done: false,
    load: "bodyweight",
    measure: "seconds",
    reps: 60,
  });
  const weighted = changeSetLoad(hold, "weight");
  assert.equal(weighted.measure, "seconds");
  assert.equal(weighted.reps, 60);
  assert.equal(weighted.weight, null);
  const none = changeSetLoad(hold, "none");
  assert.equal(none.measure, "seconds");
  const assisted = changeSetLoad(hold, "assisted");
  assert.equal(assisted.measure, "reps");
  assert.equal(assisted.reps, null);
  // Switching the count to Hold: weighted and assisted sets become bodyweight,
  // a set with no load stays without one.
  const toHold = changeSetMeasure(
    set({ done: false, load: "weight", weight: 40 }),
    "seconds",
  );
  assert.equal(toHold.load, "bodyweight");
  assert.equal(toHold.weight, null);
  assert.equal(changeSetMeasure(set({ done: false }), "seconds").load, "none");
});

test("shared routines keep weighted holds and loads none; assisted holds become reps", () => {
  const weighted = parseSharedSet(
    { load: "weight", measure: "seconds", section: "working" },
    crypto.randomUUID(),
  )!;
  assert.equal(weighted.measure, "seconds");
  const none = parseSharedSet(
    { load: "none", measure: "seconds", weight: 5, rir: 2 },
    crypto.randomUUID(),
  )!;
  assert.equal(none.load, "none");
  assert.equal(none.weight, null);
  assert.equal("rir" in none, false);
  const assisted = parseSharedSet(
    { load: "assisted", measure: "seconds" },
    crypto.randomUUID(),
  )!;
  assert.equal(assisted.measure, "reps");
});

test("RIR: optional, a whole number 0 to 3, kept through validation", () => {
  assert.ok(validSet(set({ rir: 0 })));
  assert.ok(validSet(set({ rir: 3 })));
  assert.ok(validSet(set({ rir: null })));
  assert.ok(!setSchema.safeParse(set({ rir: 4 })).success);
  assert.ok(!setSchema.safeParse(set({ rir: 1.5 })).success);
  assert.ok(!setSchema.safeParse(set({ rir: -1 })).success);
  const saved = validate("workout", workout([set({ rir: 2 })]));
  assert.equal(saved.exercises[0].sets[0].rir, 2);
  // Old sets without one stay valid.
  const old = validate("workout", workout([set()]));
  assert.equal("rir" in old.exercises[0].sets[0], false);
  assert.throws(
    () => validate("workout", workout([set({ rir: 7 })])),
    RecordValidationError,
  );
});

test("RIR helpers: labels, clamping and clearing", () => {
  setCurrentLanguage("en");
  assert.equal(rirLabel(set({ rir: 2 })), "RIR 2");
  assert.equal(rirLabel(set({ rir: 3 })), "RIR 3+");
  assert.equal(rirLabel(set()), "");
  assert.equal(rirValueText(0), "0");
  assert.equal(rirOf(set({ rir: 9 } as Partial<WorkoutSet>)), null);
  assert.equal(withRir(set(), 5).rir, 3);
  assert.equal(withRir(set(), 1).rir, 1);
  assert.equal("rir" in withRir(set({ rir: 1 }), null), false);
  assert.equal("rir" in withRir(set({ rir: 1 }), 1.5), false);
});

test("workout note: optional, at most 1000 characters", () => {
  const saved = validate(
    "workout",
    workout([set()], { note: "Felt strong.\nKnee ok." }),
  );
  assert.equal(saved.note, "Felt strong.\nKnee ok.");
  assert.equal(validate("workout", workout([set()])).note, undefined);
  validate("workout", workout([set()], { note: null }));
  validate("workout", workout([set()], { note: "x".repeat(1000) }));
  assert.throws(
    () => validate("workout", workout([set()], { note: "x".repeat(1001) })),
    RecordValidationError,
  );
});

test("workout note helpers trim, clip and clear", () => {
  assert.equal(cleanWorkoutNote("  hi  "), "hi");
  assert.equal(cleanWorkoutNote("   "), undefined);
  assert.equal(cleanWorkoutNote(null), undefined);
  assert.equal(cleanWorkoutNote("y".repeat(1200))!.length, WORKOUT_NOTE_MAX);
  // An emoji at the cut is not split in two.
  const clipped = cleanWorkoutNote("a".repeat(999) + "💪💪")!;
  assert.equal(clipped, "a".repeat(999));
  const base = workout([set()], { note: "old" }) as Workout;
  assert.equal(withWorkoutNote(base, " new ").note, "new");
  assert.equal("note" in withWorkoutNote(base, ""), false);
  assert.equal(workoutNoteOf(base), "old");
  assert.equal(workoutNoteOf({ note: "  " }), null);
});

test("a refusal for load none is retried on the next sync, others wait for an edit", async () => {
  assert.ok(needsNewerServer(workout([set()])));
  assert.ok(!needsNewerServer(workout([set({ load: "weight", weight: 5 })])));
  assert.ok(!needsNewerServer(null));
  const account = "retry-" + crypto.randomUUID();
  const id = crypto.randomUUID();
  await transact(account, (s) => {
    s.records[id] = {
      id,
      kind: "workout",
      revision: 0,
      deleted: false,
      localVersion: 1,
      dirty: true,
      payload: workout([set()]),
    };
  });
  let pushes = 0;
  let accept = false;
  const transport: Transport = {
    push: async (op) => {
      pushes++;
      if (!accept) throw { code: "P0001", message: "Invalid set" };
      return {
        record: {
          id: op.id,
          kind: op.kind,
          payload: op.payload,
          revision: 1,
          deleted: false,
          change_seq: 1,
        },
      };
    },
    pull: async () => [],
  };
  await syncAccount(account, transport, () => {});
  let state = await readAccount(account);
  assert.equal(pushes, 1);
  assert.ok(state.records[id].syncError);
  assert.equal(state.records[id].retryOnSync, true);
  // The server is updated: the next sync sends it again and it goes through.
  accept = true;
  await syncAccount(account, transport, () => {});
  state = await readAccount(account);
  assert.equal(pushes, 2);
  assert.equal(state.records[id].syncError, undefined);
  assert.equal(state.records[id].dirty, false);
});

test("finishing saves the note trimmed, or drops a blank one", async () => {
  const { finishWorkout } = await import("../src/lib/workout-editor");
  const base = {
    name: "Push",
    date: "2026-11-01",
    duration: 30,
    startedAt: null,
    status: "draft" as const,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:bench-press",
        name: "Bench Press",
        sets: [
          {
            id: crypto.randomUUID(),
            reps: 5,
            weight: 80,
            load: "weight" as const,
            section: "working" as const,
            done: true,
          },
        ],
      },
    ],
  };
  assert.equal(
    finishWorkout({ ...base, note: "  Felt strong \n" }).note,
    "Felt strong",
  );
  assert.equal("note" in finishWorkout({ ...base, note: "   " }), false);
  assert.equal("note" in finishWorkout(base), false);
});
