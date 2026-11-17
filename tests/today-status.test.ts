import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryShare,
  matchesPlanned,
  todayStatus,
  type DoneWorkout,
  type UpcomingDay,
} from "../src/data/today-status.ts";
import type { PlannedDay } from "../src/data/plans.ts";
import type { CategoriesOf } from "../src/data/muscle-sets.ts";
import type { WorkoutSet } from "../src/data/model.ts";
import { categoriesLookup } from "../src/data/muscle-sets.ts";

const TODAY = "2026-11-16"; // a Monday

const CATEGORY: Record<string, string> = {
  bench: "Chest",
  ohp: "Shoulders",
  dips: "Arms",
  curl: "Arms",
  row: "Back",
  pullup: "Back",
  squat: "Legs",
  mystery: "Other",
};
const categoriesOf: CategoriesOf = (id) =>
  CATEGORY[id] ? { category: CATEGORY[id] } : {};

let n = 0;
const set = (done = true): WorkoutSet => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  reps: 5,
  weight: 60,
  load: "weight",
  section: "working",
  done,
});
const ex = (exerciseId: string, sets: number, undone = 0) => ({
  id: crypto.randomUUID(),
  exerciseId,
  name: exerciseId,
  sets: [
    ...Array.from({ length: sets }, () => set()),
    ...Array.from({ length: undone }, () => set(false)),
  ],
});
const workout = (
  id: string,
  {
    date = TODAY,
    routineId,
    exercises = [ex("bench", 3)],
    completedAt = 1,
  }: Partial<DoneWorkout["payload"]> & { routineId?: string } = {},
): DoneWorkout => ({
  id,
  payload: { date, routineId, exercises, completedAt, startedAt: 0 },
});
const day = (
  kind: PlannedDay["kind"],
  extra: Partial<PlannedDay> = {},
): PlannedDay => ({
  kind,
  title: kind,
  routineIds: [],
  categories: [],
  ...extra,
});
const routineDay = (id: string) =>
  day("routine", { title: id, routineIds: [id] });
const PUSH = day("type", {
  title: "Push",
  categories: ["Chest", "Shoulders", "Arms"],
});
const PULL = day("type", { title: "Pull", categories: ["Back", "Arms"] });
const PLAN = { id: "plan" };

const status = (
  completed: DoneWorkout[],
  planned: PlannedDay | null,
  upcoming: UpcomingDay[] = [],
  plan: { id: string } | null = PLAN,
) =>
  todayStatus({
    today: TODAY,
    completed,
    plan,
    planned,
    upcoming,
    categoriesOf,
  });

// ---------------------------------------------------------------- not done

test("nothing finished today keeps the card open, with or without a plan", () => {
  const yesterday = workout("y", { date: "2026-11-15" });
  assert.deepEqual(status([yesterday], routineDay("push")), { kind: "open" });
  assert.deepEqual(status([], null, [], null), { kind: "open" });
});

// ---------------------------------------------------------------- no plan

test("done today without a running plan", () => {
  const s = status([workout("a")], null, [], null);
  assert.equal(s.kind, "done");
  assert.deepEqual(s.kind === "done" && s.workouts.map((w) => w.id), ["a"]);
});

test("two workouts today come newest first", () => {
  const s = status(
    [
      workout("morning", { completedAt: 100 }),
      workout("old", { date: "2026-11-14", completedAt: 999 }),
      workout("evening", { completedAt: 500 }),
    ],
    null,
    [],
    null,
  );
  assert.equal(s.kind, "done");
  assert.deepEqual(s.kind === "done" && s.workouts.map((w) => w.id), [
    "evening",
    "morning",
  ]);
});

// ---------------------------------------------------------------- plan, match

test("the planned routine done today matches", () => {
  const s = status([workout("a", { routineId: "push" })], routineDay("push"));
  assert.deepEqual(s.kind === "planDone" && [s.fit, s.countAs, s.moveDate], [
    "match",
    null,
    null,
  ]);
});

test("any of two workouts today can match the plan", () => {
  const s = status(
    [
      workout("cardio", { completedAt: 900, exercises: [ex("mystery", 1)] }),
      workout("push", { routineId: "push", completedAt: 100 }),
    ],
    routineDay("push"),
  );
  assert.equal(s.kind === "planDone" && s.fit, "match");
  assert.deepEqual(s.kind === "planDone" && s.workouts.map((w) => w.id), [
    "cardio",
    "push",
  ]);
});

test("a day type matches a workout mostly in its categories", () => {
  const push = workout("a", { exercises: [ex("bench", 3), ex("ohp", 2)] });
  assert.equal(
    status([push], PUSH).kind === "planDone" && status([push], PUSH).fit,
    "match",
  );
});

test("a group matches one of its routines, or else its categories", () => {
  const group = day("group", {
    title: "Upper",
    routineIds: ["push", "pull"],
    categories: ["Chest", "Back"],
  });
  assert.ok(
    matchesPlanned(
      workout("a", { routineId: "pull", exercises: [ex("squat", 3)] }).payload,
      group,
      categoriesOf,
    ),
  );
  assert.ok(
    matchesPlanned(
      workout("b", { exercises: [ex("row", 3)] }).payload,
      group,
      categoriesOf,
    ),
  );
  assert.ok(
    !matchesPlanned(
      workout("c", { exercises: [ex("squat", 3)] }).payload,
      group,
      categoriesOf,
    ),
  );
  // A group without categories matches its routines only.
  const bare = day("group", { routineIds: ["push"] });
  assert.ok(
    !matchesPlanned(
      workout("d", { exercises: [ex("bench", 3)] }).payload,
      bare,
      categoriesOf,
    ),
  );
});

// ---------------------------------------------------------------- the match rule

test("the category share counts done sets by main category only", () => {
  // 6 back sets and 2 arm sets: 2/8 in Push, 8/8 in Pull.
  const pull = workout("p", {
    exercises: [ex("row", 3), ex("pullup", 3, 2), ex("curl", 2)],
  }).payload;
  assert.equal(categoryShare(pull, PUSH.categories, categoriesOf), 0.25);
  assert.equal(categoryShare(pull, PULL.categories, categoriesOf), 1);
  assert.ok(!matchesPlanned(pull, PUSH, categoriesOf));
  assert.ok(matchesPlanned(pull, PULL, categoriesOf));
  // Exactly half is enough.
  const half = workout("h", {
    exercises: [ex("bench", 2), ex("squat", 2)],
  }).payload;
  assert.ok(matchesPlanned(half, PUSH, categoriesOf));
});

test("sets with no known category are left out; with none left it matches", () => {
  const unknown = workout("u", {
    exercises: [ex("mystery", 4), ex("custom-x", 2)],
  }).payload;
  assert.equal(categoryShare(unknown, PULL.categories, categoriesOf), 1);
  assert.ok(matchesPlanned(unknown, PULL, categoriesOf));
  // Unknown sets don't dilute the known ones.
  const mixed = workout("m", {
    exercises: [ex("mystery", 9), ex("squat", 1)],
  }).payload;
  assert.ok(!matchesPlanned(mixed, PULL, categoriesOf));
});

test("a routine day needs that routine; the same exercises in an empty workout do not count", () => {
  const empty = workout("e", { exercises: [ex("bench", 3)] }).payload;
  assert.ok(!matchesPlanned(empty, routineDay("push"), categoriesOf));
  assert.ok(
    !matchesPlanned(
      { ...empty, routineId: "pull" },
      routineDay("push"),
      categoriesOf,
    ),
  );
  assert.ok(
    !matchesPlanned({ ...empty, routineId: "push" }, day("rest"), categoriesOf),
  );
});

test("the real catalogue's categories work with the rule", () => {
  const lookup = categoriesLookup([]);
  const bench = {
    ...ex("builtin:bench-press", 3),
  };
  const w = workout("c", { exercises: [bench] }).payload;
  assert.ok(matchesPlanned(w, PUSH, lookup));
  assert.ok(!matchesPlanned(w, PULL, lookup));
});

// ---------------------------------------------------------------- plan, off plan

test("a type day against a different routine: off plan, move today, count as the matching day", () => {
  // Planned Push (a day type); did the Pull routine. Pull day is on Wednesday.
  const did = workout("a", {
    routineId: "pull",
    exercises: [ex("row", 3), ex("pullup", 3)],
  });
  const s = status([did], PUSH, [
    { date: "2026-11-18", day: routineDay("pull") },
    { date: "2026-11-20", day: routineDay("legs") },
  ]);
  assert.equal(s.kind, "planDone");
  if (s.kind !== "planDone") return;
  assert.equal(s.fit, "other");
  assert.equal(s.planned, PUSH);
  assert.equal(s.moveDate, TODAY);
  assert.deepEqual(s.countAs, { date: "2026-11-18", day: routineDay("pull") });
});

test("a routine day against a workout that matches a later type day", () => {
  const did = workout("a", { exercises: [ex("row", 3)] });
  const s = status([did], routineDay("push"), [
    { date: "2026-11-17", day: routineDay("legs") },
    { date: "2026-11-19", day: PULL },
  ]);
  assert.equal(s.kind === "planDone" && s.fit, "other");
  assert.equal(s.kind === "planDone" && s.countAs?.date, "2026-11-19");
});

test("off plan with nothing matching ahead offers only the move", () => {
  const did = workout("a", { exercises: [ex("squat", 3)] });
  const s = status([did], routineDay("push"), [
    { date: "2026-11-18", day: routineDay("pull") },
  ]);
  assert.deepEqual(s.kind === "planDone" && [s.fit, s.countAs, s.moveDate], [
    "other",
    null,
    TODAY,
  ]);
});

test("count as looks a week ahead, no further", () => {
  const did = workout("a", { routineId: "pull" });
  const far = status([did], null, [
    { date: "2026-11-24", day: routineDay("pull") },
  ]);
  assert.equal(far.kind === "planDone" && far.countAs, null);
  const near = status([did], null, [
    { date: "2026-11-23", day: routineDay("pull") },
  ]);
  assert.equal(near.kind === "planDone" && near.countAs?.date, "2026-11-23");
});

test("training on a rest day: off plan, move the next planned day, count as a matching one", () => {
  const did = workout("a", { routineId: "pull" });
  const s = status([did], day("rest"), [
    { date: "2026-11-17", day: routineDay("legs") },
    { date: "2026-11-18", day: routineDay("pull") },
  ]);
  assert.equal(s.kind, "planDone");
  if (s.kind !== "planDone") return;
  assert.equal(s.fit, "rest");
  assert.equal(s.moveDate, "2026-11-17");
  assert.equal(s.countAs?.date, "2026-11-18");
});

test("training on a day with nothing planned", () => {
  const s = status([workout("a", { exercises: [ex("squat", 2)] })], null, []);
  assert.deepEqual(s.kind === "planDone" && [s.fit, s.countAs, s.moveDate], [
    "unplanned",
    null,
    null,
  ]);
});
