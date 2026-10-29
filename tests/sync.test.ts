import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { transact, readAccount } from "../src/data/database";
import { syncAccount, type Transport } from "../src/data/sync";
import {
  newSet,
  validate,
  type Workout,
  type RemoteDoc,
  type Operation,
} from "../src/data/model";
import { baseline, estimate, progressFor } from "../src/data/analytics";

const workout = (): Workout => ({
  name: "Test",
  date: "2026-09-13",
  duration: null,
  startedAt: null,
  status: "draft",
  exercises: [],
});
async function setup() {
  const account = crypto.randomUUID(),
    id = crypto.randomUUID();
  await transact(account, (s) => {
    s.records[id] = {
      id,
      kind: "workout",
      payload: workout(),
      revision: 0,
      localVersion: 1,
      deleted: false,
      dirty: true,
    };
  });
  return { account, id };
}
function server() {
  const records = new Map<string, RemoteDoc>(),
    receipts = new Map<string, RemoteDoc>();
  let seq = 0;
  const transport: Transport = {
    async push(op) {
      if (receipts.has(op.opId)) return { record: receipts.get(op.opId)! };
      const old = records.get(op.id);
      if (old && old.revision !== op.baseRevision)
        return { record: old, conflict: true };
      const record: RemoteDoc = {
        id: op.id,
        kind: op.kind,
        payload: op.payload,
        deleted: op.deleted,
        revision: (old?.revision ?? 0) + 1,
        change_seq: ++seq,
      };
      records.set(op.id, record);
      receipts.set(op.opId, record);
      return { record };
    },
    async pull(cursor) {
      return [...records.values()]
        .filter((r) => r.change_seq > cursor)
        .sort((a, b) => a.change_seq - b.change_seq)
        .slice(0, 200);
    },
  };
  return { records, transport };
}
test("lost server response retries the same operation without duplicating the workout", async () => {
  const { account, id } = await setup(),
    cloud = server();
  await assert.rejects(
    syncAccount(
      account,
      {
        ...cloud.transport,
        push: async (op) => {
          await cloud.transport.push(op);
          throw Error("Connection lost after commit");
        },
      },
      () => {},
    ),
  );
  const pending = await readAccount(account);
  assert.equal(pending.outbox.length, 1);
  await syncAccount(account, cloud.transport, () => {});
  assert.equal(cloud.records.size, 1);
  assert.equal(cloud.records.get(id)!.revision, 1);
  assert.equal((await readAccount(account)).records[id].dirty, false);
});
test("editing while a request is in flight preserves and sends the newer edit", async () => {
  const { account, id } = await setup(),
    cloud = server();
  let first = true;
  await syncAccount(
    account,
    {
      ...cloud.transport,
      push: async (op) => {
        if (first) {
          first = false;
          await transact(account, (s) => {
            s.records[id].payload.name = "Newer edit";
            s.records[id].localVersion++;
          });
        }
        return cloud.transport.push(op);
      },
    },
    () => {},
  );
  assert.equal(cloud.records.get(id)!.payload.name, "Newer edit");
  assert.equal(cloud.records.get(id)!.revision, 2);
  assert.equal((await readAccount(account)).records[id].dirty, false);
});
test("two devices editing the same workout produce an explicit conflict", async () => {
  const { account, id } = await setup(),
    cloud = server();
  await syncAccount(account, cloud.transport, () => {});
  const remote = cloud.records.get(id)!;
  cloud.records.set(id, {
    ...remote,
    revision: 2,
    change_seq: 2,
    payload: { ...remote.payload, name: "Other phone" },
  });
  await transact(account, (s) => {
    s.records[id].payload.name = "This phone";
    s.records[id].localVersion++;
    s.records[id].dirty = true;
  });
  await syncAccount(account, cloud.transport, () => {});
  const local = (await readAccount(account)).records[id];
  assert.equal(local.payload.name, "This phone");
  assert.equal(local.conflict?.payload.name, "Other phone");
  assert.equal(local.dirty, true);
});
test("soft deletion reaches another device and cannot reappear on the next pull", async () => {
  const { account, id } = await setup(),
    cloud = server(),
    second = crypto.randomUUID();
  await syncAccount(account, cloud.transport, () => {});
  await syncAccount(second, cloud.transport, () => {});
  await transact(account, (s) => {
    s.records[id].deleted = true;
    s.records[id].dirty = true;
    s.records[id].localVersion++;
  });
  await syncAccount(account, cloud.transport, () => {});
  await syncAccount(second, cloud.transport, () => {});
  assert.equal((await readAccount(second)).records[id].deleted, true);
});
test("pagination consumes every remote page", async () => {
  const cloud = server(),
    account = crypto.randomUUID();
  for (let i = 0; i < 405; i++)
    await cloud.transport.push({
      opId: crypto.randomUUID(),
      id: crypto.randomUUID(),
      kind: "workout",
      payload: workout(),
      deleted: false,
      baseRevision: 0,
      localVersion: 1,
    });
  await syncAccount(account, cloud.transport, () => {});
  assert.equal(Object.keys((await readAccount(account)).records).length, 405);
});
test("account switch stops an in-flight response from changing the prior account", async () => {
  const { account, id } = await setup(),
    cloud = server();
  let active = true;
  await syncAccount(
    account,
    {
      ...cloud.transport,
      push: async (op) => {
        active = false;
        return cloud.transport.push(op);
      },
    },
    () => {},
    () => active,
  );
  assert.equal((await readAccount(account)).records[id].revision, 0);
  assert.equal((await readAccount(account)).outbox.length, 1);
});
test("bad dates and unfinished completed workouts are rejected; bodyweight needs no weight", () => {
  assert.throws(() =>
    validate("workout", { ...workout(), date: "2026-02-30" }),
  );
  assert.throws(() =>
    validate("workout", { ...workout(), status: "completed" }),
  );
  const set = { ...newSet(), load: "bodyweight" as const, reps: 6, done: true };
  assert.doesNotThrow(() =>
    validate("workout", {
      ...workout(),
      status: "completed",
      exercises: [
        {
          id: crypto.randomUUID(),
          exerciseId: "pull-up",
          name: "Pull Up",
          sets: [set],
        },
      ],
    }),
  );
  assert.equal(estimate(set), null);
});
test("30-day comparison uses the nearest session on or before the cutoff", () => {
  assert.equal(
    baseline(
      [
        { date: "2026-01-01", e1rm: 60 },
        { date: "2026-05-01", e1rm: 80 },
        { date: "2026-06-01", e1rm: 90 },
      ],
      "2026-05-15",
    ),
    80,
  );
  assert.equal(
    baseline([{ date: "2026-06-01", e1rm: 90 }], "2026-05-15"),
    null,
  );
});

const rejection = (message: string) =>
  Object.assign(new Error(message), { code: "P0001" });

test("a change the server rejects is parked and the rest of the queue still syncs", async () => {
  const { account, id } = await setup(),
    cloud = server(),
    otherId = crypto.randomUUID();
  await transact(account, (s) => {
    s.records[otherId] = { ...s.records[id], id: otherId };
  });
  await syncAccount(
    account,
    {
      ...cloud.transport,
      push: async (op) => {
        if (op.id === id) throw rejection("Invalid set");
        return cloud.transport.push(op);
      },
    },
    () => {},
  );
  const state = await readAccount(account);
  assert.equal(state.records[id].syncError, "Invalid set");
  assert.equal(state.records[id].dirty, true);
  assert.equal(state.records[otherId].dirty, false);
  assert.equal(cloud.records.has(otherId), true);
  assert.deepEqual(state.outbox, []);
});

test("network failures keep the operation queued for the next sync", async () => {
  const { account, id } = await setup(),
    cloud = server();
  await assert.rejects(
    syncAccount(
      account,
      {
        ...cloud.transport,
        push: async () => {
          throw new TypeError("Failed to fetch");
        },
      },
      () => {},
    ),
    /failed to fetch/i,
  );
  const state = await readAccount(account);
  assert.equal(state.outbox.length, 1);
  assert.equal(state.records[id].syncError, undefined);
});

test("a record the server lost is re-created instead of blocking sync", async () => {
  const { account, id } = await setup(),
    cloud = server();
  await transact(account, (s) => {
    s.records[id].revision = 7;
  });
  await syncAccount(
    account,
    {
      ...cloud.transport,
      push: async (op) => {
        if (op.baseRevision !== 0 && !cloud.records.has(op.id))
          throw rejection("Record missing; restore a backup");
        return cloud.transport.push(op);
      },
    },
    () => {},
  );
  const state = await readAccount(account);
  assert.equal(cloud.records.get(id)?.revision, 1);
  assert.equal(state.records[id].revision, 1);
  assert.equal(state.records[id].dirty, false);
});

test("unreadable downloads are set aside without stopping later rows", async () => {
  const account = crypto.randomUUID(),
    badId = crypto.randomUUID(),
    goodId = crypto.randomUUID();
  const rows: RemoteDoc[] = [
    {
      id: badId,
      kind: "workout",
      payload: { ...workout(), status: "unknown" } as unknown as Workout,
      revision: 1,
      deleted: false,
      change_seq: 1,
    },
    {
      id: goodId,
      kind: "workout",
      payload: workout(),
      revision: 1,
      deleted: false,
      change_seq: 2,
    },
  ];
  await syncAccount(
    account,
    {
      push: async () => assert.fail("nothing to push"),
      pull: async (c) => rows.filter((r) => r.change_seq > c),
    },
    () => {},
  );
  let state = await readAccount(account);
  assert.equal(state.cursor, 2);
  assert.equal(state.records[goodId].payload.name, "Test");
  assert.equal(state.records[badId], undefined);
  assert.equal(state.quarantine?.[badId]?.revision, 1);
  // A later readable revision replaces the parked row.
  rows.push({ ...rows[1], id: badId, revision: 2, change_seq: 3 });
  await syncAccount(
    account,
    {
      push: async () => assert.fail("nothing to push"),
      pull: async (c) => rows.filter((r) => r.change_seq > c),
    },
    () => {},
  );
  state = await readAccount(account);
  assert.equal(state.records[badId].revision, 2);
  assert.equal(state.quarantine?.[badId], undefined);
});

test("parked downloads are applied once this version can read them", async () => {
  const account = crypto.randomUUID(),
    id = crypto.randomUUID();
  await transact(account, (s) => {
    s.quarantine = {
      [id]: {
        id,
        kind: "workout",
        payload: workout(),
        revision: 4,
        deleted: false,
        change_seq: 9,
      },
    };
    s.cursor = 9;
  });
  await syncAccount(
    account,
    { push: async () => assert.fail("nothing to push"), pull: async () => [] },
    () => {},
  );
  const state = await readAccount(account);
  assert.equal(state.records[id].revision, 4);
  assert.deepEqual(state.quarantine, {});
});
test("a restored record the server already has takes its revision instead of conflicting", async () => {
  const { account, id } = await setup(),
    cloud = server();
  await syncAccount(account, cloud.transport, () => {});
  const remote = cloud.records.get(id)!;
  // A backup restored on a fresh install: the same content, sent as new.
  const fresh = crypto.randomUUID();
  await transact(fresh, (s) => {
    s.records[id] = {
      id,
      kind: "workout",
      // Key order differs from the server's copy, as jsonb does not keep it.
      payload: Object.fromEntries(
        Object.entries(remote.payload).reverse(),
      ) as Workout,
      revision: 0,
      localVersion: 1,
      deleted: false,
      dirty: true,
    };
  });
  await syncAccount(fresh, cloud.transport, () => {});
  const local = (await readAccount(fresh)).records[id];
  assert.equal(local.conflict, undefined);
  assert.equal(local.dirty, false);
  assert.equal(local.revision, remote.revision);
});
test("a different restored record still asks which version to keep", async () => {
  const { account, id } = await setup(),
    cloud = server();
  await syncAccount(account, cloud.transport, () => {});
  const remote = cloud.records.get(id)!;
  const fresh = crypto.randomUUID();
  await transact(fresh, (s) => {
    s.records[id] = {
      id,
      kind: "workout",
      payload: { ...(remote.payload as Workout), name: "Edited" },
      revision: 0,
      localVersion: 1,
      deleted: false,
      dirty: true,
    };
  });
  await syncAccount(fresh, cloud.transport, () => {});
  const local = (await readAccount(fresh)).records[id];
  assert.equal(local.conflict?.payload.name, "Test");
  assert.equal(local.dirty, true);
});
test("a sync reloads the log once, however many operations it sends", async () => {
  const { account } = await setup(),
    cloud = server();
  await transact(account, (s) => {
    for (let i = 0; i < 5; i++) {
      const id = crypto.randomUUID();
      s.records[id] = {
        id,
        kind: "workout",
        payload: workout(),
        revision: 0,
        localVersion: 1,
        deleted: false,
        dirty: true,
      };
    }
  });
  let reloads = 0;
  await syncAccount(account, cloud.transport, () => reloads++);
  assert.equal(reloads, 1);
  assert.equal(cloud.records.size, 6);
  // Nothing new: no reload at all.
  await syncAccount(account, cloud.transport, () => reloads++);
  assert.equal(reloads, 1);
});
