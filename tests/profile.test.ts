import test from "node:test";
import assert from "node:assert/strict";
import {
  newSet,
  repeatExercises,
  validate,
  type Workout,
} from "../src/data/model.ts";

// The only substitute is browser storage / the network boundary. The profile
// parser, cache, merge logic and asynchronous controller remain real.
const library = () => import("../src/lib/profile.ts");
const storage = () => {
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
};
const metadata = (bodyWeightKg: number | null, updatedAt: number) => ({
  gain_train_profile: { bodyWeightKg, updatedAt },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("profile accepts decimal kg, allows clearing, and rejects invalid bodyweight", async () => {
  const { parseBodyWeightInput } = await library();
  for (const [input, expected] of [
    ["78.5", 78.5],
    [" 78,25 ", 78.25],
    [".5", 0.5],
    ["", null],
    [" ", null],
  ] as const)
    assert.equal(parseBodyWeightInput(input), expected);
  for (const input of [
    "0",
    "-4",
    "1000.1",
    "Infinity",
    "NaN",
    "1e2",
    "78kg",
    "70,2.4",
  ])
    assert.throws(
      () => parseBodyWeightInput(input),
      /greater than 0|bodyweight/i,
    );
});

test("guest and account profiles persist offline without exposing another account's weight", async () => {
  const { ProfileStore } = await library();
  const cache = storage();
  const phone = new ProfileStore({ account: "phone", storage: cache });
  phone.saveProfile({ bodyWeightKg: 78.5 });
  assert.equal(phone.getSnapshot().status, "local");
  const accountA = new ProfileStore({ account: "a", storage: cache });
  assert.equal(accountA.getSnapshot().bodyWeightKg, null);
  accountA.saveProfile({ bodyWeightKg: 83 });
  const accountB = new ProfileStore({ account: "b", storage: cache });
  assert.equal(accountB.getSnapshot().bodyWeightKg, null);
  assert.equal(
    new ProfileStore({ account: "phone", storage: cache }).getSnapshot()
      .bodyWeightKg,
    78.5,
  );
  const reopened = new ProfileStore({ account: "a", storage: cache });
  assert.equal(reopened.getSnapshot().bodyWeightKg, 83);
  assert.equal(reopened.getSnapshot().status, "pending");
  reopened.saveProfile({ bodyWeightKg: null });
  assert.equal(
    new ProfileStore({ account: "a", storage: cache }).getSnapshot()
      .bodyWeightKg,
    null,
  );
});

test("dirty offline edits win over remote data and clear only after a successful sync", async () => {
  const { ProfileStore } = await library();
  const cache = storage();
  const offline = new ProfileStore({
    account: "a",
    storage: cache,
    now: () => 100,
  });
  offline.saveProfile({ bodyWeightKg: 81.25 });
  let uploaded: unknown;
  const store = new ProfileStore({
    account: "a",
    storage: cache,
    canSync: () => true,
    connect: async () => ({
      read: async () => metadata(90, 200),
      write: async (record) => {
        uploaded = record.bodyWeightKg;
        return metadata(record.bodyWeightKg, record.updatedAt);
      },
    }),
  });
  await store.sync();
  assert.equal(uploaded, 81.25);
  assert.equal(store.getSnapshot().bodyWeightKg, 81.25);
  assert.equal(store.getSnapshot().status, "synced");
  const reopened = new ProfileStore({
    account: "a",
    storage: cache,
    metadata: metadata(82, 300),
  });
  assert.equal(reopened.getSnapshot().bodyWeightKg, 82);
});

test("sync failure keeps the local edit queued and exposes a recoverable error", async () => {
  const { ProfileStore } = await library();
  const cache = storage();
  let fail = true;
  const store = new ProfileStore({
    account: "a",
    storage: cache,
    canSync: () => true,
    connect: async () => ({
      read: async () => metadata(70, 1),
      write: async (record) => {
        if (fail) throw new Error("Network unavailable");
        return metadata(record.bodyWeightKg, record.updatedAt);
      },
    }),
  });
  store.saveProfile({ bodyWeightKg: 80 });
  await store.sync();
  assert.equal(store.getSnapshot().bodyWeightKg, 80);
  assert.equal(store.getSnapshot().status, "error");
  assert.match(store.getSnapshot().error ?? "", /saved.*device|sync/i);
  assert.equal(
    new ProfileStore({ account: "a", storage: cache }).getSnapshot().status,
    "pending",
  );
  fail = false;
  await store.sync();
  assert.equal(store.getSnapshot().status, "synced");
});

test("an offline edit made with an older clock remains newer than the remote profile after sync", async () => {
  const { ProfileStore } = await library();
  const cache = storage();
  const store = new ProfileStore({
    account: "a",
    storage: cache,
    now: () => 100,
    canSync: () => true,
    connect: async () => ({
      read: async () => metadata(90, 200),
      write: async (record) => metadata(record.bodyWeightKg, record.updatedAt),
    }),
  });
  store.saveProfile({ bodyWeightKg: 81 });
  await store.sync();
  const reopened = new ProfileStore({
    account: "a",
    storage: cache,
    metadata: metadata(90, 200),
  });
  assert.equal(reopened.getSnapshot().bodyWeightKg, 81);
});

test("a late sync acknowledgement cannot erase a newer local edit", async () => {
  const { ProfileStore } = await library();
  const first = deferred<unknown>();
  const uploads: (number | null)[] = [];
  const store = new ProfileStore({
    account: "a",
    storage: storage(),
    canSync: () => true,
    now: () => 100,
    connect: async () => ({
      read: async () => metadata(70, 1),
      write: async (record) => {
        uploads.push(record.bodyWeightKg);
        if (uploads.length === 1) return first.promise;
        return metadata(record.bodyWeightKg, record.updatedAt);
      },
    }),
  });
  store.saveProfile({ bodyWeightKg: 80 });
  const pending = store.sync();
  await new Promise((done) => setImmediate(done));
  store.saveProfile({ bodyWeightKg: 81 });
  first.resolve(metadata(80, 100));
  await pending;
  assert.deepEqual(uploads, [80, 81]);
  assert.equal(store.getSnapshot().bodyWeightKg, 81);
  assert.equal(store.getSnapshot().status, "synced");
});

test("disposing on an account switch prevents late pull results from writing the cache", async () => {
  const { ProfileStore } = await library();
  const cache = storage();
  const pull = deferred<unknown>();
  const old = new ProfileStore({
    account: "a",
    storage: cache,
    canSync: () => true,
    connect: async () => ({
      read: () => pull.promise,
      write: async () => {
        throw new Error("Switched account must not upload");
      },
    }),
  });
  const syncing = old.sync();
  await new Promise((done) => setImmediate(done));
  old.dispose();
  const current = new ProfileStore({ account: "b", storage: cache });
  current.saveProfile({ bodyWeightKg: 63 });
  pull.resolve(metadata(99, 200));
  await syncing;
  assert.equal(current.getSnapshot().bodyWeightKg, 63);
  assert.equal(
    new ProfileStore({ account: "a", storage: cache }).getSnapshot()
      .bodyWeightKg,
    null,
  );
});

test("clearing weight syncs a null value while preserving unrelated profile metadata", async () => {
  const { ProfileStore, profileMetadataPatch } = await library();
  const patch = profileMetadataPatch(
    {
      email: "private@example.com",
      role: "member",
      gain_train_profile: { nickname: "A" },
    },
    { bodyWeightKg: null, updatedAt: 123 },
  );
  assert.deepEqual(patch, {
    gain_train_profile: { nickname: "A", bodyWeightKg: null, updatedAt: 123 },
  });
  let uploaded: unknown = "not saved";
  const store = new ProfileStore({
    account: "a",
    storage: storage(),
    metadata: metadata(80, 1),
    canSync: () => true,
    connect: async () => ({
      read: async () => metadata(80, 1),
      write: async (record) => {
        uploaded = record.bodyWeightKg;
        return metadata(null, record.updatedAt);
      },
    }),
  });
  store.saveProfile({ bodyWeightKg: null });
  await store.sync();
  assert.equal(uploaded, null);
  assert.equal(store.getSnapshot().status, "synced");
});

test("failed device storage never reports a weight as saved", async () => {
  const { ProfileStore } = await library();
  const store = new ProfileStore({
    account: "phone",
    storage: {
      ...storage(),
      setItem: () => {
        throw new Error("quota");
      },
    },
  });
  assert.throws(
    () => store.saveProfile({ bodyWeightKg: 81 }),
    /storage|device/i,
  );
  assert.equal(store.getSnapshot().bodyWeightKg, null);
});

test("late restored auth metadata is available offline without replacing a queued edit", async () => {
  const { ProfileStore } = await library();
  const cache = storage();
  const store = new ProfileStore({
    account: "a",
    storage: cache,
    now: () => 100,
  });
  assert.equal(
    typeof store.acceptMetadata,
    "function",
    "Restored offline auth metadata must reach the profile",
  );
  store.acceptMetadata(metadata(78, 1));
  assert.equal(store.getSnapshot().bodyWeightKg, 78);
  assert.equal(
    new ProfileStore({ account: "a", storage: cache }).getSnapshot()
      .bodyWeightKg,
    78,
  );
  store.saveProfile({ bodyWeightKg: 80 });
  store.acceptMetadata(metadata(90, 200));
  assert.equal(store.getSnapshot().bodyWeightKg, 80);
  assert.equal(store.getSnapshot().status, "pending");
});

test("profile HTTP writes bind to the captured user token and patch only profile metadata", async () => {
  const api = await library();
  assert.equal(
    typeof api.createProfileConnection,
    "function",
    "Token-bound profile transport is required",
  );
  const requests: { url: string; options: RequestInit }[] = [];
  const connection = api.createProfileConnection({
    account: "account-a",
    token: "captured-a",
    url: "https://example.supabase.co",
    publishableKey: "public-key",
    isCurrent: () => true,
    signal: new AbortController().signal,
    request: async (url, options) => {
      requests.push({ url: String(url), options: options! });
      const user_metadata =
        options?.method === "PUT"
          ? JSON.parse(String(options.body)).data
          : {
              email: "private@example.com",
              gain_train_profile: {
                nickname: "A",
                bodyWeightKg: 70,
                updatedAt: 1,
              },
            };
      return new Response(JSON.stringify({ id: "account-a", user_metadata }), {
        status: 200,
      });
    },
  });
  const remote = await connection.read();
  const result = await connection.write(
    { bodyWeightKg: 80, updatedAt: 2 },
    remote,
  );
  assert.deepEqual(result, {
    gain_train_profile: { nickname: "A", bodyWeightKg: 80, updatedAt: 2 },
  });
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "https://example.supabase.co/auth/v1/user",
      "https://example.supabase.co/auth/v1/user",
    ],
  );
  assert.deepEqual(
    requests.map(
      (request) =>
        (request.options.headers as Record<string, string>).Authorization,
    ),
    ["Bearer captured-a", "Bearer captured-a"],
  );
  assert.deepEqual(JSON.parse(String(requests[1].options.body)), {
    data: {
      gain_train_profile: { nickname: "A", bodyWeightKg: 80, updatedAt: 2 },
    },
  });
});

test("a profile connection cannot write after switching account or accept another user's response", async () => {
  const api = await library();
  assert.equal(
    typeof api.createProfileConnection,
    "function",
    "Token-bound profile transport is required",
  );
  let current = true,
    writes = 0;
  const connection = api.createProfileConnection({
    account: "a",
    token: "token-a",
    url: "https://example.supabase.co",
    publishableKey: "public-key",
    isCurrent: () => current,
    signal: new AbortController().signal,
    request: async (_url, options) => {
      if (options?.method === "PUT") writes++;
      return new Response(
        JSON.stringify({ id: "b", user_metadata: metadata(99, 1) }),
        { status: 200 },
      );
    },
  });
  await assert.rejects(connection.read(), /account|profile/i);
  current = false;
  await assert.rejects(
    connection.write({ bodyWeightKg: 80, updatedAt: 2 }, {}),
    /account/i,
  );
  assert.equal(writes, 0);
});

test("bodyweight snapshots survive workout validation and backup roundtrips", () => {
  const workout: Workout = {
    name: "Bodyweight session",
    date: "2026-10-18",
    duration: 20,
    startedAt: null,
    status: "completed",
    exercises: [
      {
        id: crypto.randomUUID(),
        exerciseId: "builtin:push-up",
        name: "Push Up",
        sets: [
          {
            ...newSet(),
            load: "bodyweight",
            reps: 12,
            done: true,
            bodyWeightKg: 78.5,
          },
        ],
      },
    ],
  };
  const restored = validate(
    "workout",
    JSON.parse(JSON.stringify(workout)),
  ) as Workout;
  assert.equal(restored.exercises[0].sets[0].bodyWeightKg, 78.5);
  for (const invalid of [0, -2, Infinity, 1001]) {
    const candidate = structuredClone(workout);
    candidate.exercises[0].sets[0].bodyWeightKg = invalid;
    assert.throws(() => validate("workout", candidate), /bodyweight/i);
  }
});

test("new and repeated unfinished sets do not inherit an old bodyweight snapshot", () => {
  const prior = {
    ...newSet(),
    load: "bodyweight" as const,
    reps: 12,
    done: true,
    bodyWeightKg: 78.5,
  };
  assert.equal(newSet(prior).bodyWeightKg, undefined);
  const repeated = repeatExercises([
    {
      id: crypto.randomUUID(),
      exerciseId: "push-up",
      name: "Push Up",
      sets: [prior],
    },
  ]);
  assert.equal(repeated[0].sets[0].bodyWeightKg, undefined);
  assert.equal(repeated[0].sets[0].done, false);
  assert.equal(repeated[0].sets[0].reps, 12);
  assert.equal(prior.bodyWeightKg, 78.5);
});

test("a store disposed by a simulated unmount works again once reactivated", async () => {
  const { ProfileStore } = await library();
  const store = new ProfileStore({ account: "phone", storage: storage() });
  let heard = 0;
  store.subscribe(() => heard++);
  // StrictMode and Fast Refresh unmount and remount with the same store.
  store.dispose();
  assert.throws(() => store.saveProfile({ bodyWeightKg: 70 }));
  store.activate();
  store.saveProfile({ bodyWeightKg: 70 });
  assert.equal(store.getSnapshot().bodyWeightKg, 70);
  assert.equal(heard, 1);
});
