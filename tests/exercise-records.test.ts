import test from "node:test";
import assert from "node:assert/strict";
import type { RecordDoc, Workout, WorkoutSet } from "../src/data/model";
import {
  exerciseRecords,
  exerciseSessions,
  liveWorkoutPrs,
  prEvents,
  workoutPrs,
} from "../src/data/exercise-records";

const ID = "builtin:bench-press";
const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 5,
  weight: 100,
  load: "weight",
  section: "working",
  done: true,
  ...overrides,
});
const workout = (
  sets: WorkoutSet[],
  date: string,
  {
    exerciseId = ID,
    status = "completed",
    name = "Push",
    extra = [],
  }: {
    exerciseId?: string;
    status?: Workout["status"];
    name?: string;
    extra?: Workout["exercises"];
  } = {},
): RecordDoc => ({
  id: crypto.randomUUID(),
  kind: "workout",
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
  payload: {
    name,
    date,
    duration: null,
    startedAt: null,
    status,
    exercises: [
      { id: crypto.randomUUID(), exerciseId, name: "Bench", sets },
      ...extra,
    ],
  } satisfies Workout,
});

test("sessions: newest first, checked valid sets only, one per workout", () => {
  const older = workout([set({ weight: 80 })], "2026-10-01");
  const skipped = workout([set({ done: false })], "2026-10-02");
  const draft = workout([set()], "2026-10-03", { status: "draft" });
  const other = workout([set()], "2026-10-04", { exerciseId: "builtin:squat" });
  const twice = workout(
    [set({ section: "warmup", weight: 40 }), set({ weight: 90 })],
    "2026-10-05",
    {
      name: "Upper",
      extra: [
        {
          id: crypto.randomUUID(),
          exerciseId: ID,
          name: "Bench",
          sets: [set({ weight: 70, reps: 10 }), set({ reps: null })],
        },
      ],
    },
  );
  const sessions = exerciseSessions([older, skipped, draft, other, twice], ID);
  assert.deepEqual(
    sessions.map((s) => [s.date, s.workoutName, s.sets.map((x) => x.weight)]),
    [
      ["2026-10-05", "Upper", [40, 90, 70]],
      ["2026-10-01", "Push", [80]],
    ],
  );
});

test("records ignore warm-ups and pick each best", () => {
  const a = workout(
    [
      set({ section: "warmup", weight: 140, reps: 3 }),
      set({ weight: 100, reps: 5 }),
      set({ weight: 80, reps: 12 }),
    ],
    "2026-10-01",
  );
  const b = workout(
    [set({ weight: 105, reps: 2 }), set({ weight: 90, reps: 8 })],
    "2026-10-08",
  );
  const r = exerciseRecords([a, b], ID);
  // 100 × 5 → 116.7; 90 × 8 → 114; 105 × 2 → 112; 80 × 12 has no estimate.
  assert.equal(r.bestE1rm?.set.weight, 100);
  assert.equal(r.bestE1rm?.workoutId, a.id);
  assert.equal(Math.round(r.bestE1rm!.value * 10) / 10, 116.7);
  assert.equal(r.heaviest?.set.weight, 105);
  assert.equal(r.heaviest?.workoutId, b.id);
  assert.equal(r.mostReps?.set.reps, 12);
  // 80 × 12 = 960 beats 100 × 5 = 500.
  assert.equal(r.bestSetVolume?.value, 960);
  // Session volumes: a 500 + 960 = 1460 (warm-up left out); b 210 + 720 = 930.
  assert.deepEqual(
    [r.bestSessionVolume?.value, r.bestSessionVolume?.workoutId],
    [1460, a.id],
  );
  assert.deepEqual(
    r.repsAtWeight.map((x) => [x.weight, x.reps]),
    [
      [105, 2],
      [100, 5],
      [90, 8],
      [80, 12],
    ],
  );
});

test("drops count for heaviest weight and session volume only", () => {
  const w = workout(
    [set({ weight: 100, reps: 5 }), set({ weight: 120, reps: 20, drop: true })],
    "2026-10-01",
  );
  const r = exerciseRecords([w], ID);
  assert.equal(r.bestE1rm?.set.weight, 100);
  assert.equal(r.heaviest?.set.weight, 120);
  assert.equal(r.mostReps?.set.reps, 5);
  assert.equal(r.bestSetVolume?.value, 500);
  assert.equal(r.bestSessionVolume?.value, 500 + 2400);
  assert.deepEqual(
    r.repsAtWeight.map((x) => x.weight),
    [100],
  );
});

test("a tie keeps the first time it was reached", () => {
  const first = workout([set({ weight: 100, reps: 5 })], "2026-10-01");
  const again = workout([set({ weight: 100, reps: 5 })], "2026-10-08");
  const r = exerciseRecords([again, first], ID);
  assert.equal(r.bestE1rm?.workoutId, first.id);
  assert.equal(r.bestSetVolume?.workoutId, first.id);
  assert.equal(r.mostReps?.workoutId, first.id);
  assert.equal(r.bestSessionVolume?.workoutId, first.id);
  assert.equal(r.repsAtWeight[0].workoutId, first.id);
  // Heaviest keeps its own rule: the most recent of equal sets.
  assert.equal(r.heaviest?.workoutId, again.id);
});

test("most reps: a tie goes to the heavier weight", () => {
  const w = workout(
    [set({ weight: 60, reps: 10 }), set({ weight: 70, reps: 10 })],
    "2026-10-01",
  );
  assert.equal(exerciseRecords([w], ID).mostReps?.set.weight, 70);
});

test("bodyweight, timed and cardio sets have no weight records", () => {
  const w = workout(
    [
      set({ load: "bodyweight", weight: null, reps: 12 }),
      set({ load: "bodyweight", weight: null, reps: 45, measure: "seconds" }),
      set({
        measure: "cardio",
        weight: null,
        reps: null,
        durationSec: 600,
        distanceM: 2000,
      }),
    ],
    "2026-10-01",
  );
  const r = exerciseRecords([w], ID);
  assert.equal(r.bestE1rm, null);
  assert.equal(r.heaviest, null);
  assert.equal(r.bestSetVolume, null);
  assert.equal(r.bestSessionVolume, null);
  assert.deepEqual(r.repsAtWeight, []);
  assert.equal(r.mostReps?.set.reps, 12);
});

test("no sessions, no records", () => {
  const r = exerciseRecords([], ID);
  assert.deepEqual(r, {
    bestE1rm: null,
    heaviest: null,
    mostReps: null,
    bestSetVolume: null,
    bestSessionVolume: null,
    repsAtWeight: [],
  });
});

const prsOf = (records: RecordDoc[], id: string) =>
  workoutPrs(records, id).map((pr) => [pr.exerciseId, pr.set.id, pr.kinds]);

test("PRs: heaviest weight and set volume over earlier sessions, never the first", () => {
  const first = workout([set({ weight: 100, reps: 5 })], "2026-10-01");
  const better = workout(
    [set({ weight: 102.5, reps: 5 }), set({ weight: 80, reps: 3 })],
    "2026-10-08",
  );
  const same = workout([set({ weight: 100, reps: 5 })], "2026-10-15");
  const records = [first, better, same];
  assert.deepEqual(prsOf(records, first.id), []);
  assert.deepEqual(prsOf(records, same.id), []);
  const top = (better.payload as Workout).exercises[0].sets[0].id;
  // One PR for the exercise, on the set that holds both records.
  assert.deepEqual(prsOf(records, better.id), [
    [ID, top, ["heaviest", "setVolume"]],
  ]);
  // A later, better workout does not take the PR away.
  const later = workout([set({ weight: 110, reps: 5 })], "2026-10-22");
  assert.equal(workoutPrs([...records, later], better.id).length, 1);
  assert.deepEqual(workoutPrs(records, "missing"), []);
});

test("PRs: one chip per exercise, on the heaviest set when the records differ", () => {
  const first = workout(
    [set({ weight: 100, reps: 5 }), set({ weight: 80, reps: 8 })],
    "2026-10-01",
  );
  // 105 × 2 is the heaviest; 80 × 10 = 800 beats 640 and 500 for set volume.
  const sets = [set({ weight: 105, reps: 2 }), set({ weight: 80, reps: 10 })];
  const next = workout(sets, "2026-10-08");
  assert.deepEqual(prsOf([first, next], next.id), [
    [ID, sets[0].id, ["heaviest", "setVolume"]],
  ]);
});

test("PRs: set volume alone, and equal heaviest sets carry one chip on the first", () => {
  const first = workout([set({ weight: 100, reps: 5 })], "2026-10-01");
  const volume = [set({ weight: 90, reps: 8 }), set({ weight: 90, reps: 6 })];
  const second = workout(volume, "2026-10-08");
  assert.deepEqual(prsOf([first, second], second.id), [
    [ID, volume[0].id, ["setVolume"]],
  ]);
  const heavy = [
    set({ weight: 110 }),
    set({ weight: 110 }),
    set({ weight: 110 }),
  ];
  const third = workout(heavy, "2026-10-15");
  // 110 × 5 = 550 is under 90 × 8 = 720: the heaviest weight only.
  assert.deepEqual(prsOf([first, second, third], third.id), [
    [ID, heavy[0].id, ["heaviest"]],
  ]);
});

test("PRs: best e1RM, most reps and session volume alone are not PRs", () => {
  const first = workout(
    [set({ weight: 100, reps: 3 }), set({ weight: 60, reps: 10 })],
    "2026-10-01",
  );
  // 95 × 5 (e1RM 110.8) beats 100 × 3 (110), 12 reps beat 10 and the session
  // volume grows, but 95 is lighter than 100 and no set beats 60 × 10 = 600.
  const next = workout(
    [
      set({ weight: 95, reps: 5 }),
      set({ weight: 50, reps: 12 }),
      set({ weight: 50, reps: 12 }),
    ],
    "2026-10-08",
  );
  assert.deepEqual(prsOf([first, next], next.id), []);
  const r = exerciseRecords([first, next], ID);
  assert.equal(r.bestE1rm?.workoutId, next.id);
  assert.equal(r.mostReps?.workoutId, next.id);
  assert.equal(r.bestSessionVolume?.workoutId, next.id);
});

test("PRs: warm-ups never count, a heavier drop sets the heaviest weight only", () => {
  const first = workout([set({ weight: 100, reps: 5 })], "2026-10-01");
  const warm = workout(
    [set({ weight: 140, reps: 5, section: "warmup" }), set({ weight: 90 })],
    "2026-10-08",
  );
  assert.deepEqual(prsOf([first, warm], warm.id), []);
  const drop = [
    set({ weight: 90, reps: 5 }),
    set({ weight: 120, reps: 20, drop: true }),
  ];
  const dropped = workout(drop, "2026-10-15");
  assert.deepEqual(prsOf([first, warm, dropped], dropped.id), [
    [ID, drop[1].id, ["heaviest"]],
  ]);
});

test("PRs: no earlier set of the kind to beat is no PR; bodyweight has none", () => {
  const bw = workout(
    [set({ load: "bodyweight", weight: null, reps: 10 })],
    "2026-10-01",
  );
  const more = workout(
    [set({ load: "bodyweight", weight: null, reps: 15 })],
    "2026-10-08",
  );
  const added = workout(
    [set({ load: "bodyweight", extraWeight: true, weight: 10, reps: 8 })],
    "2026-10-15",
  );
  const heavier = workout(
    [set({ load: "bodyweight", extraWeight: true, weight: 15, reps: 6 })],
    "2026-10-22",
  );
  const records = [bw, more, added, heavier];
  assert.deepEqual(prsOf(records, more.id), []);
  assert.deepEqual(prsOf(records, added.id), []);
  // Added weight has no set volume, so only the heaviest weight counts.
  const top = (heavier.payload as Workout).exercises[0].sets[0].id;
  assert.deepEqual(prsOf(records, heavier.id), [[ID, top, ["heaviest"]]]);
});

test("PR events: oldest first, per exercise, named as the exercise is now", () => {
  const squat = "builtin:squat";
  const a = workout([set({ weight: 100 })], "2026-10-01", {
    extra: [
      {
        id: crypto.randomUUID(),
        exerciseId: squat,
        name: "Squat",
        sets: [set({ weight: 120 })],
      },
    ],
  });
  const b = workout([set({ weight: 105 })], "2026-10-08", {
    extra: [
      {
        id: crypto.randomUUID(),
        exerciseId: squat,
        name: "Back Squat",
        sets: [set({ weight: 130 })],
      },
    ],
  });
  const c = workout([set({ weight: 110 })], "2026-10-15");
  assert.deepEqual(
    prEvents([c, a, b]).map((e) => [e.exerciseId, e.workoutId, e.name]),
    [
      [ID, b.id, "Bench"],
      [squat, b.id, "Back Squat"],
      [ID, c.id, "Bench"],
    ],
  );
});

test("live PRs: a draft's checked sets count as if finished now; unchecked never do", () => {
  const before = workout([set({ weight: 100, reps: 5 })], "2026-10-01");
  const heavy = set({ weight: 110, reps: 3 });
  const open = set({ weight: 150, reps: 5, done: false });
  const draft = workout([set({ weight: 90 }), heavy, open], "2026-10-08", {
    status: "draft",
  });
  const marks = liveWorkoutPrs([before, draft], draft as never);
  assert.deepEqual([...marks.keys()], [heavy.id]);
  assert.deepEqual(marks.get(heavy.id), ["heaviest"]);
  // The first session of an exercise has nothing to beat.
  assert.equal(liveWorkoutPrs([draft], draft as never).size, 0);
});

test("live PRs: an edited finished workout is judged as edited, not as saved", () => {
  const before = workout([set({ weight: 100, reps: 5 })], "2026-10-01");
  const saved = workout([set({ weight: 100, reps: 5 })], "2026-10-08");
  assert.equal(liveWorkoutPrs([before, saved], saved as never).size, 0);
  const edited = structuredClone(saved) as Extract<
    RecordDoc,
    { kind: "workout" }
  >;
  edited.payload.exercises[0].sets[0].weight = 105;
  const marks = liveWorkoutPrs([before, saved], edited);
  assert.deepEqual(marks.get(edited.payload.exercises[0].sets[0].id), [
    "heaviest",
    "setVolume",
  ]);
});
