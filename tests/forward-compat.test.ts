import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION,
  isFromNewerApp,
  keepUnknownFields,
  validate,
  type Workout,
} from "../src/data/model";
import { parseWorkoutDraft } from "../src/lib/drafts";
import { local, session, writeStored } from "../src/lib/storage";

const workout = () => ({
  name: "Push",
  date: "2026-10-26",
  duration: null,
  startedAt: null,
  status: "draft" as const,
  rpeScale: "1-10",
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "builtin:bench-press",
      name: "Bench Press",
      note: "Pause reps",
      sets: [
        {
          id: crypto.randomUUID(),
          reps: 5,
          weight: 80,
          load: "weight" as const,
          section: "working" as const,
          done: true,
          rpe: 8,
        },
      ],
    },
  ],
});

test("validation keeps fields written by a newer app version", () => {
  const saved = validate("workout", workout()) as Workout & {
    rpeScale?: string;
  };
  const exercise = saved.exercises[0] as typeof saved.exercises[0] & {
    note?: string;
  };
  assert.equal(saved.rpeScale, "1-10");
  assert.equal(exercise.note, "Pause reps");
  assert.equal((exercise.sets[0] as { rpe?: number }).rpe, 8);
});

test("validation never keeps editor-only input text on saved sets", () => {
  const input = workout();
  Object.assign(input.exercises[0].sets[0], { inputText: {} });
  const saved = validate("workout", input) as Workout;
  assert.equal("inputText" in saved.exercises[0].sets[0], false);
});

test("recovered drafts keep unknown fields", () => {
  const draft = parseWorkoutDraft(workout()) as Workout & { rpeScale?: string };
  assert.equal(draft.rpeScale, "1-10");
});

test("keepUnknownFields prefers parsed values and follows arrays by position", () => {
  assert.deepEqual(
    keepUnknownFields(
      { a: " x ", extra: 1, list: [{ b: 1, keep: true }] },
      { a: "x", list: [{ b: 2 }] },
    ),
    { extra: 1, a: "x", list: [{ keep: true, b: 2 }] },
  );
});

test("records from a newer schema version are recognised", () => {
  assert.equal(isFromNewerApp({ ...workout() }), false);
  assert.equal(
    isFromNewerApp({ ...workout(), schemaVersion: SCHEMA_VERSION }),
    false,
  );
  assert.equal(
    isFromNewerApp({ ...workout(), schemaVersion: SCHEMA_VERSION + 1 }),
    true,
  );
  assert.equal(isFromNewerApp(null), false);
});

test("guarded storage survives browsers that block storage access", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  try {
    assert.equal(local.getItem("gt-account"), null);
    assert.doesNotThrow(() => local.removeItem("gt-account"));
    assert.throws(() => local.setItem("gt-account", "x"));
    assert.equal(writeStored("gt-account", "x"), false);
    assert.equal(session.getItem("anything"), null);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
