import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { readAccount, transact } from "../src/data/database";
import * as model from "../src/data/model";
import * as workoutStart from "../src/data/workout-start";
import { type RecordDoc, type Workout, newSet } from "../src/data/model";

// Run the real provider with a small hook host; keep its validation and IndexedDB
// writes real. Auth, browser events and delayed cloud calls are outside this test.
async function provider(account: string) {
  const state: unknown[] = [],
    refs: { current: unknown }[] = [];
  let stateIndex = 0,
    refIndex = 0;
  const hooks = {
    createContext: () => ({ Provider: "provider" }),
    useState: (initial: unknown) => {
      const index = stateIndex++;
      if (!(index in state))
        state[index] = typeof initial === "function" ? initial() : initial;
      return [
        state[index],
        (value: unknown) => {
          state[index] =
            typeof value === "function" ? value(state[index]) : value;
        },
      ];
    },
    useRef: (initial: unknown) =>
      refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    useCallback: (callback: unknown) => callback,
    useEffect: () => {},
  };
  const source = await readFile(
    new URL("../src/contexts/DataContext.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exported: {
    DataProvider?: (props: { children: null }) => { props: { value: Data } };
  } = {};
  const require = createRequire(import.meta.url);
  runInNewContext(compiled.outputText, {
    exports: exported,
    require: (id: string) => {
      if (id === "react") return hooks;
      if (id === "./AuthContext")
        return { useAuth: () => ({ account, user: null, ready: true }) };
      if (id === "@/data/database") return { readAccount, transact };
      if (id === "@/data/model") return model;
      if (id === "@/data/workout-start") return workoutStart;
      if (id === "@/data/sync")
        return {
          syncAccount: () => {
            throw Error("Cloud sync is outside this test");
          },
        };
      if (id === "@/integrations/supabase/client") return { supabase: null };
      return require(id);
    },
    navigator: { onLine: true },
    Error,
    BroadcastChannel,
    setTimeout: () => 0,
  });
  function render() {
    stateIndex = 0;
    refIndex = 0;
    return exported.DataProvider!({ children: null }).props.value;
  }
  return render;
}
type Data = {
  error: string;
  startWorkout: (
    id: string,
    payload: Workout,
    replace?: Pick<
      workoutStart.StartedWorkout,
      "id" | "localVersion" | "revision"
    >[],
  ) => Promise<void>;
  save: (
    id: string,
    kind: "workout",
    payload: Workout,
    deleted?: boolean,
  ) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  restoreWorkout: (id: string) => Promise<void>;
  importRecords: (records: RecordDoc[]) => Promise<void>;
};
const workout = (): Workout => ({
  name: "Saved draft",
  date: "2026-10-08",
  duration: null,
  startedAt: null,
  status: "draft",
  exercises: [],
});
const document = (id: string, payload: Workout): RecordDoc => ({
  id,
  kind: "workout",
  payload,
  revision: 5,
  localVersion: 4,
  dirty: false,
  deleted: false,
});

test("starting another workout requires confirmation and leaves the existing workout untouched", async () => {
  const account = crypto.randomUUID(),
    existingId = crypto.randomUUID(),
    nextId = crypto.randomUUID();
  const render = await provider(account);
  const existing = document(existingId, { ...workout(), startedAt: 100 });
  await transact(account, (s) => {
    s.records[existingId] = existing;
  });
  await assert.rejects(
    render().startWorkout(nextId, { ...workout(), startedAt: 200 }),
    (error: Error) => error.name === "WorkoutInProgressError",
  );
  const state = await readAccount(account);
  assert.deepEqual(state.records[existingId], existing);
  assert.equal(state.records[nextId], undefined);
});

test("confirmed replacement removes started drafts together and preserves past entries and completed workouts", async () => {
  const account = crypto.randomUUID(),
    nextId = crypto.randomUUID();
  const render = await provider(account);
  const started = [1, 2].map((time) =>
    document(crypto.randomUUID(), { ...workout(), startedAt: time }),
  );
  const past = document(crypto.randomUUID(), workout());
  const completed = document(crypto.randomUUID(), {
    ...workout(),
    status: "completed",
    startedAt: 50,
  });
  await transact(account, (s) => {
    for (const record of [...started, past, completed])
      s.records[record.id] = record;
  });
  await render().startWorkout(
    nextId,
    { ...workout(), startedAt: 200 },
    started,
  );
  const state = await readAccount(account);
  for (const record of started) {
    assert.equal(state.records[record.id].deleted, true);
    assert.equal(state.records[record.id].dirty, true);
    assert.equal(
      state.records[record.id].localVersion,
      record.localVersion + 1,
    );
  }
  assert.deepEqual(state.records[past.id], past);
  assert.deepEqual(state.records[completed.id], completed);
  assert.equal((state.records[nextId].payload as Workout).startedAt, 200);
});

test("a changed workout requires a fresh confirmation instead of silently discarding new work", async () => {
  const account = crypto.randomUUID(),
    existingId = crypto.randomUUID(),
    nextId = crypto.randomUUID();
  const render = await provider(account);
  const existing = document(existingId, { ...workout(), startedAt: 100 });
  await transact(account, (s) => {
    s.records[existingId] = { ...existing, localVersion: 5 };
  });
  await assert.rejects(
    render().startWorkout(nextId, { ...workout(), startedAt: 200 }, [existing]),
    (error: Error) => error.name === "WorkoutInProgressError",
  );
  assert.equal((await readAccount(account)).records[existingId].deleted, false);
});

test("invalid replacement cannot delete the current workout", async () => {
  const account = crypto.randomUUID(),
    existingId = crypto.randomUUID(),
    nextId = crypto.randomUUID();
  const render = await provider(account);
  const existing = document(existingId, { ...workout(), startedAt: 100 });
  await transact(account, (s) => {
    s.records[existingId] = existing;
  });
  await assert.rejects(
    render().startWorkout(nextId, { ...workout(), name: "", startedAt: 200 }, [
      existing,
    ]),
    /name/i,
  );
  assert.deepEqual((await readAccount(account)).records[existingId], existing);
});

test("simultaneous starts from two tabs persist only one running workout", async () => {
  const account = crypto.randomUUID(),
    first = await provider(account),
    second = await provider(account);
  const results = await Promise.allSettled([
    first().startWorkout(crypto.randomUUID(), { ...workout(), startedAt: 100 }),
    second().startWorkout(crypto.randomUUID(), {
      ...workout(),
      startedAt: 200,
    }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(
    rejected?.status === "rejected" && rejected.reason.name,
    "WorkoutInProgressError",
  );
  assert.equal(
    Object.values((await readAccount(account)).records).filter(
      (record) =>
        !record.deleted && (record.payload as Workout).startedAt !== null,
    ).length,
    1,
  );
});

test("logging a past workout does not interrupt the running workout", async () => {
  const account = crypto.randomUUID(),
    existingId = crypto.randomUUID(),
    pastId = crypto.randomUUID();
  const render = await provider(account);
  const existing = document(existingId, { ...workout(), startedAt: 100 });
  await transact(account, (s) => {
    s.records[existingId] = existing;
  });
  await render().startWorkout(pastId, workout());
  const state = await readAccount(account);
  assert.deepEqual(state.records[existingId], existing);
  assert.equal((state.records[pastId].payload as Workout).startedAt, null);
});

test("an aborted storage write rolls back replacement and creation together", async () => {
  const account = crypto.randomUUID(),
    existingId = crypto.randomUUID(),
    nextId = crypto.randomUUID();
  const existing = document(existingId, { ...workout(), startedAt: 100 });
  await transact(account, (s) => {
    s.records[existingId] = existing;
  });
  await assert.rejects(
    transact(account, (s) => {
      workoutStart.createWorkout(s, nextId, { ...workout(), startedAt: 200 }, [
        existing,
      ]);
      throw Error("Storage write failed");
    }),
    /storage write failed/i,
  );
  const state = await readAccount(account);
  assert.deepEqual(state.records[existingId], existing);
  assert.equal(state.records[nextId], undefined);
});

test("an old editor or Undo cannot resurrect a replaced workout while another is running", async () => {
  const account = crypto.randomUUID(),
    oldId = crypto.randomUUID(),
    currentId = crypto.randomUUID();
  const render = await provider(account);
  const old = { ...workout(), startedAt: 100 };
  await render().startWorkout(oldId, old);
  const record = (await readAccount(account)).records[oldId];
  await render().startWorkout(currentId, { ...workout(), startedAt: 200 }, [
    { ...record, name: old.name },
  ]);
  await assert.rejects(
    render().save(oldId, "workout", old),
    /removed|already in progress/i,
  );
  await assert.rejects(render().restoreWorkout(oldId), /already in progress/i);
  const state = await readAccount(account);
  assert.equal(state.records[oldId].deleted, true);
  assert.equal(state.records[currentId].deleted, false);
  await render().save(currentId, "workout", {
    ...workout(),
    name: "Updated current",
    startedAt: 200,
  });
  assert.equal(
    (await readAccount(account)).records[currentId].payload.name,
    "Updated current",
  );
});

test("delayed editor saves cannot resurrect a removed workout after the replacement finishes", async () => {
  const account = crypto.randomUUID(),
    oldId = crypto.randomUUID(),
    currentId = crypto.randomUUID();
  const render = await provider(account);
  const old = { ...workout(), startedAt: 100 };
  await render().startWorkout(oldId, old);
  const record = (await readAccount(account)).records[oldId];
  await render().startWorkout(currentId, { ...workout(), startedAt: 200 }, [
    { ...record, name: old.name },
  ]);
  const completed: Workout = {
    ...workout(),
    startedAt: 200,
    status: "completed",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:push-up",
        name: "Push Up",
        sets: [{ ...newSet(), load: "bodyweight", reps: 10, done: true }],
      },
    ],
  };
  await render().save(currentId, "workout", completed);
  await assert.rejects(render().save(oldId, "workout", old), /removed/i);
  await assert.rejects(
    render().save(oldId, "workout", { ...completed, startedAt: 100 }),
    /removed/i,
  );
  assert.equal((await readAccount(account)).records[oldId].deleted, true);
  await render().restoreWorkout(oldId);
  assert.equal((await readAccount(account)).records[oldId].deleted, false);
});

test("backup restore cannot introduce a second running workout", async () => {
  const account = crypto.randomUUID(),
    currentId = crypto.randomUUID(),
    restoredId = crypto.randomUUID();
  const render = await provider(account);
  await render().startWorkout(currentId, { ...workout(), startedAt: 100 });
  await assert.rejects(
    render().importRecords([
      document(restoredId, { ...workout(), startedAt: 200 }),
    ]),
    /in progress/i,
  );
  const state = await readAccount(account);
  assert.equal(state.records[currentId].deleted, false);
  assert.equal(state.records[restoredId], undefined);
});

test("abandon deletes the stored payload after invalid editor values fail to save", async () => {
  const account = crypto.randomUUID(),
    id = crypto.randomUUID(),
    render = await provider(account);
  await render().save(id, "workout", workout());
  await assert.rejects(
    render().save(id, "workout", { ...workout(), duration: -1 }),
  );
  await assert.doesNotReject(async () => {
    const data = render();
    if (data.deleteRecord) await data.deleteRecord(id);
    else await data.save(id, "workout", { ...workout(), duration: -1 }, true);
  });
  const saved = (await readAccount(account)).records[id];
  assert.equal(saved.deleted, true);
  assert.equal((saved.payload as Workout).duration, null);
  assert.equal(saved.localVersion, 2);
  assert.equal(saved.dirty, true);
});

test("validation reports the field and a later valid save clears the global error", async () => {
  const account = crypto.randomUUID(),
    id = crypto.randomUUID(),
    render = await provider(account);
  await assert.rejects(
    render().save(id, "workout", { ...workout(), duration: 1.5 }),
  );
  assert.match(render().error, /duration/i);
  assert.doesNotMatch(render().error, /storage/i);
  await render().save(id, "workout", workout());
  assert.equal(render().error, "");
});

test("saving timestamps new sessions and preserves completion order through later edits", async () => {
  const account = crypto.randomUUID(),
    id = crypto.randomUUID(),
    render = await provider(account);
  await render().save(id, "workout", workout());
  const created = (await readAccount(account)).records[id].payload as Workout;
  assert.equal(typeof created.createdAt, "number");
  const completed: Workout = {
    ...created,
    status: "completed",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:push-up",
        name: "Push Up",
        sets: [{ ...newSet(), reps: 10, load: "bodyweight", done: true }],
      },
    ],
  };
  await render().save(id, "workout", completed);
  const firstSave = (await readAccount(account)).records[id].payload as Workout;
  assert.equal(typeof firstSave.completedAt, "number");
  await render().save(id, "workout", { ...firstSave, name: "Edited session" });
  const edited = (await readAccount(account)).records[id].payload as Workout;
  assert.equal(edited.createdAt, created.createdAt);
  assert.equal(edited.completedAt, firstSave.completedAt);
});

test("restore resurrects backed-up tombstones with the local revision and preserves live edits", async () => {
  const account = crypto.randomUUID(),
    deletedId = crypto.randomUUID(),
    liveId = crypto.randomUUID(),
    render = await provider(account);
  await transact(account, (s) => {
    s.records[deletedId] = {
      ...document(deletedId, { ...workout(), name: "Old deleted value" }),
      deleted: true,
    };
    s.records[liveId] = document(liveId, {
      ...workout(),
      name: "Current local value",
    });
  });
  await render().importRecords([
    document(deletedId, { ...workout(), name: "Backup value" }),
    document(liveId, { ...workout(), name: "Stale backup value" }),
  ]);
  const state = await readAccount(account);
  assert.equal(state.records[deletedId].deleted, false);
  assert.equal(state.records[deletedId].payload.name, "Backup value");
  assert.equal(state.records[deletedId].revision, 5);
  assert.equal(state.records[deletedId].localVersion, 5);
  assert.equal(state.records[deletedId].dirty, true);
  assert.equal(state.records[liveId].payload.name, "Current local value");
  assert.equal(state.records[liveId].dirty, false);
});
test("editing a legacy completed record does not invent times that change its order", async () => {
  const account = crypto.randomUUID(),
    id = crypto.randomUUID(),
    render = await provider(account);
  const legacy: Workout = {
    ...workout(),
    status: "completed",
    startedAt: 100,
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:push-up",
        name: "Push Up",
        sets: [{ ...newSet(), load: "bodyweight", reps: 10, done: true }],
      },
    ],
  };
  await transact(account, (state) => {
    state.records[id] = document(id, legacy);
  });
  await render().save(id, "workout", { ...legacy, name: "Edited legacy" });
  const edited = (await readAccount(account)).records[id].payload as Workout;
  assert.equal(edited.startedAt, 100);
  assert.equal(edited.completedAt, undefined);
  assert.equal(edited.createdAt, undefined);
});

test("deleting a missing record gives a useful failure without creating a tombstone", async () => {
  const account = crypto.randomUUID(),
    id = crypto.randomUUID(),
    render = await provider(account);
  await assert.rejects(async () => {
    const data = render();
    if (data.deleteRecord) await data.deleteRecord(id);
    else await data.save(id, "workout", workout(), true);
  }, /could not find|no longer/i);
  assert.equal(Object.keys((await readAccount(account)).records).length, 0);
});
