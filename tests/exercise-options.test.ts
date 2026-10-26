import test from "node:test";
import assert from "node:assert/strict";
import { changeExerciseOptions } from "../src/lib/exercise-options.ts";

test("a dismissal from the previous menu cannot close the newly opened menu", () => {
  const next = { id: "squat", editing: false };
  assert.equal(
    changeExerciseOptions(next, { type: "close", id: "bench" }),
    next,
  );
  assert.equal(
    changeExerciseOptions(next, { type: "close", id: "squat" }),
    null,
  );
});

test("editing stays inside an open options menu and closing clears it", () => {
  const open = changeExerciseOptions(null, { type: "open", id: "bench" });
  const editing = changeExerciseOptions(open, { type: "edit", id: "bench" });
  assert.deepEqual(editing, { id: "bench", editing: true });
  assert.deepEqual(
    changeExerciseOptions(editing, { type: "edit", id: "bench" }),
    {
      id: "bench",
      editing: false,
    },
  );
  const closed = changeExerciseOptions(editing, { type: "close" });
  assert.equal(closed, null);
  assert.deepEqual(
    changeExerciseOptions(closed, { type: "open", id: "bench" }),
    {
      id: "bench",
      editing: false,
    },
  );
});

test("opening another exercise clears editing for the previous exercise", () => {
  const next = changeExerciseOptions(
    { id: "bench", editing: true },
    { type: "open", id: "squat" },
  );
  assert.deepEqual(next, { id: "squat", editing: false });
});

test("an edit action cannot enable editing for a closed or different menu", () => {
  assert.equal(
    changeExerciseOptions(null, { type: "edit", id: "bench" }),
    null,
  );
  const open = { id: "squat", editing: false };
  assert.equal(
    changeExerciseOptions(open, { type: "edit", id: "bench" }),
    open,
  );
});
