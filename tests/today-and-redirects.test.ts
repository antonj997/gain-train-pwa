import test from "node:test";
import assert from "node:assert/strict";
import {
  lastDoneByRoutine,
  leastRecent,
  todayPick,
} from "../src/data/today.ts";
import type { PlannedDay } from "../src/data/plans.ts";
import { legacyRedirect } from "../src/lib/legacy-routes.ts";

const done = (entries: Record<string, string>) =>
  new Map(Object.entries(entries));
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

test("the suggestion is the routine done least recently", () => {
  assert.deepEqual(
    leastRecent(
      ["a", "b", "c"],
      done({ a: "2026-11-05", b: "2026-11-02", c: "2026-11-06" }),
    ),
    { routineId: "b", reason: "rotation" },
  );
  // Ties keep the saved order.
  assert.deepEqual(
    leastRecent(["a", "b"], done({ a: "2026-11-02", b: "2026-11-02" })),
    { routineId: "a", reason: "rotation" },
  );
});

test("routines never done are left out, unless nothing has been done yet", () => {
  assert.deepEqual(leastRecent(["new", "a"], done({ a: "2026-11-05" })), {
    routineId: "a",
    reason: "rotation",
  });
  assert.deepEqual(leastRecent(["x", "y"], done({})), {
    routineId: "x",
    reason: "first",
  });
  assert.equal(leastRecent([], done({ a: "2026-11-05" })), null);
});

test("a planned routine, day type or group comes first", () => {
  const routine = day("routine", { routineIds: ["r"] });
  assert.deepEqual(todayPick(routine, ["a", "r"], done({ a: "2026-01-01" })), {
    kind: "planned",
    day: routine,
    routineId: "r",
  });
  const type = day("type", { categories: ["Legs"] });
  assert.deepEqual(todayPick(type, ["a"], done({})), {
    kind: "planned",
    day: type,
    routineId: null,
  });
  // A group starts its least recently done routine.
  const group = day("group", { routineIds: ["g1", "g2"] });
  assert.deepEqual(
    todayPick(group, ["a"], done({ g1: "2026-11-05", g2: "2026-11-01" })),
    { kind: "planned", day: group, routineId: "g2" },
  );
  // A group whose routines are gone starts with its categories' suggestions.
  const empty = day("group", { categories: ["Back"] });
  assert.deepEqual(todayPick(empty, ["a"], done({})), {
    kind: "planned",
    day: empty,
    routineId: null,
  });
});

test("nothing planned or a rest day suggests a routine; without routines there is nothing", () => {
  const lastDone = done({ a: "2026-11-05", b: "2026-11-01" });
  assert.deepEqual(todayPick(null, ["a", "b"], lastDone), {
    kind: "suggested",
    routineId: "b",
    reason: "rotation",
    rest: false,
  });
  assert.deepEqual(todayPick(day("rest"), ["a", "b"], lastDone), {
    kind: "suggested",
    routineId: "b",
    reason: "rotation",
    rest: true,
  });
  assert.deepEqual(todayPick(null, [], lastDone), {
    kind: "none",
    rest: false,
  });
  assert.deepEqual(todayPick(day("rest"), [], lastDone), {
    kind: "none",
    rest: true,
  });
});

test("last done keeps each routine's newest date, in any order", () => {
  const dates = lastDoneByRoutine([
    { payload: { routineId: "a", date: "2026-11-01" } },
    { payload: { routineId: "a", date: "2026-11-05" } },
    { payload: { routineId: null, date: "2026-11-06" } },
    { payload: { date: "2026-11-06" } },
    { payload: { routineId: "b", date: "2026-10-30" } },
  ]);
  assert.deepEqual(
    [...dates],
    [
      ["a", "2026-11-05"],
      ["b", "2026-10-30"],
    ],
  );
});

test("old tab links redirect to the subscreens", () => {
  assert.equal(legacyRedirect("/progress", "?tab=goals"), "/progress/goals");
  assert.equal(legacyRedirect("/progress/", "?tab=goals"), "/progress/goals");
  assert.equal(legacyRedirect("/progress", "?tab=stats"), "/progress");
  assert.equal(legacyRedirect("/library", "?tab=plan"), "/library/plan");
  assert.equal(legacyRedirect("/library", "?view=shared"), "/library/shared");
  assert.equal(legacyRedirect("/library", "?tab=shared"), "/library/shared");
  assert.equal(
    legacyRedirect("/library", "?tab=routines&view=shared"),
    "/library/shared",
  );
  assert.equal(legacyRedirect("/library", "?tab=routines"), "/library");
  assert.equal(legacyRedirect("/routines", ""), "/library");
  assert.equal(legacyRedirect("/my-exercises", ""), "/library?tab=exercises");
});

test("redirects keep other parameters", () => {
  assert.equal(
    legacyRedirect("/library", "?tab=routines&edit=abc"),
    "/library?edit=abc",
  );
  assert.equal(
    legacyRedirect("/progress", "?tab=goals&x=1"),
    "/progress/goals?x=1",
  );
  assert.equal(legacyRedirect("/routines", "?edit=abc"), "/library?edit=abc");
});

test("current URLs are left alone", () => {
  for (const [path, search] of [
    ["/", ""],
    ["/", "?start=workout"],
    ["/history", "?workout=w1&set=s1"],
    ["/progress", ""],
    ["/progress/goals", ""],
    ["/library", ""],
    ["/library", "?tab=exercises"],
    ["/library", "?tab=exercises&edit=x"],
    ["/library", "?edit=abc"],
    ["/library", "?tab=exercises&view=shared"],
    ["/library/plan", ""],
    ["/library/shared", ""],
    ["/settings", ""],
    ["/exercise/builtin%3Asquat", "?tab=history"],
  ])
    assert.equal(legacyRedirect(path, search), null, path + search);
});
