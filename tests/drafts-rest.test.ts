import test from "node:test";
import assert from "node:assert/strict";
import {
  draftKey,
  readDraft,
  writeDraft,
  parseRoutineDraft,
  parseWorkoutRecovery,
  readRestEnd,
  extendRestEnd,
} from "../src/lib/drafts.ts";
import { normalizeTrainingPreferences } from "../src/lib/preferences.ts";
import { newSet } from "../src/data/model.ts";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
test("unfinished routine names and plans survive a reload without crossing accounts", () => {
  const store = storage();
  const key = draftKey("phone", "routine");
  const draft = { id: crypto.randomUUID(), data: { name: "", exercises: [] } };
  assert.equal(writeDraft(store, key, draft), true);
  assert.deepEqual(readDraft(store, key, parseRoutineDraft), draft);
  assert.equal(
    readDraft(store, draftKey("account-a", "routine"), parseRoutineDraft),
    null,
  );
});
test("malformed recovery data is ignored and blocked storage is recoverable", () => {
  const store = storage();
  store.setItem("draft", "{broken");
  assert.equal(readDraft(store, "draft", parseRoutineDraft), null);
  store.setItem("draft", JSON.stringify({ id: "invalid", data: {} }));
  assert.equal(readDraft(store, "draft", parseRoutineDraft), null);
  assert.equal(
    writeDraft(
      {
        ...store,
        setItem: () => {
          throw Error("Full");
        },
      },
      "draft",
      {},
    ),
    false,
  );
});
test("routine drafts retain temporary invalid values so reload does not lose the plan", () => {
  const store = storage();
  const key = draftKey("phone", "routine");
  const draft = {
    id: crypto.randomUUID(),
    data: {
      name: "Upper",
      exercises: [
        {
          id: crypto.randomUUID(),
          exerciseId: "builtin:bench-press",
          name: "Bench Press",
          sets: [newSet({ weight: -5, reps: 0 })],
        },
      ],
    },
  };
  writeDraft(store, key, draft);
  assert.deepEqual(readDraft(store, key, parseRoutineDraft), draft);
});
test("rest countdown survives reload using its end time and expires when time passes", () => {
  const store = storage();
  store.setItem("timer", "61000");
  assert.equal(readRestEnd(store, "timer", 21000), 61000);
  assert.equal(extendRestEnd(61000, 21000, 30), 91000);
  assert.equal(readRestEnd(store, "timer", 62000), null);
  assert.equal(store.getItem("timer"), null);
  assert.equal(extendRestEnd(1000, 21000, 30), 51000);
});
test("rest and haptics stay off for absent or malformed preferences", () => {
  assert.deepEqual(normalizeTrainingPreferences(null, null), {
    restSeconds: 0,
    haptics: false,
    weeklyGoal: null,
  });
  assert.deepEqual(normalizeTrainingPreferences("-10", "yes"), {
    restSeconds: 0,
    haptics: false,
    weeklyGoal: null,
  });
  assert.deepEqual(normalizeTrainingPreferences("90", "true"), {
    restSeconds: 90,
    haptics: true,
    weeklyGoal: null,
  });
});

test("workout recovery keeps the stored version it was based on", () => {
  const workout = {
    name: "Push",
    date: "2026-10-12",
    duration: null,
    startedAt: 1,
    status: "draft" as const,
    exercises: [],
  };
  assert.deepEqual(parseWorkoutRecovery({ workout, base: "key" }), {
    workout,
    base: "key",
  });
  // Drafts saved before the base was kept are the workout itself.
  assert.deepEqual(parseWorkoutRecovery(workout), { workout, base: null });
  // A finished workout's edit is read only as such.
  assert.equal(
    parseWorkoutRecovery({ workout, base: null }, "completed"),
    null,
  );
  assert.deepEqual(
    parseWorkoutRecovery(
      { workout: { ...workout, status: "completed" }, base: "k" },
      "completed",
    )?.base,
    "k",
  );
  assert.equal(parseWorkoutRecovery({ workout: { name: 1 } }), null);
});
