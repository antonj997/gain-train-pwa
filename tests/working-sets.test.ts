import test from "node:test";
import assert from "node:assert/strict";
import { workingSetChange, workingSetCount } from "../src/data/workouts";
import type { WorkoutSet } from "../src/data/model";

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: crypto.randomUUID(),
  reps: 8,
  weight: 60,
  load: "weight",
  section: "working",
  done: true,
  ...over,
});
const session = (sets: WorkoutSet[]) => ({ date: "2026-11-01", sets });

test("working sets leave out warm-ups, cool-downs and drops", () => {
  assert.equal(
    workingSetCount([
      set({ section: "warmup" }),
      set(),
      set({ drop: true }),
      set({ done: false }),
      set({ section: "winddown" }),
    ]),
    2,
  );
});

test("the note shows when this card's working sets differ from last time", () => {
  const last = session([
    set({ section: "warmup" }),
    set(),
    set(),
    set(),
    set(),
  ]);
  const now = [set({ section: "warmup", done: false }), set(), set(), set()];
  assert.deepEqual(workingSetChange(now, last), { now: 3, last: 4 });
  // Adding the fourth set makes them equal again.
  assert.equal(workingSetChange([...now, set({ done: false })], last), null);
  // A drop is part of its set, not another one.
  assert.equal(workingSetChange([...now, set({ drop: true })], last)?.now, 3);
  assert.deepEqual(workingSetChange([...now, set(), set()], last), {
    now: 5,
    last: 4,
  });
});

test("nothing shows without a last session to compare with", () => {
  assert.equal(workingSetChange([set()], undefined), null);
  // Last time had only warm-ups, or sets that were never checked.
  assert.equal(
    workingSetChange([set()], session([set({ section: "warmup" })])),
    null,
  );
  assert.deepEqual(
    workingSetChange([set(), set()], session([set(), set({ done: false })])),
    { now: 2, last: 1 },
  );
});
