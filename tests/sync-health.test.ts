import test from "node:test";
import assert from "node:assert/strict";
import { draftKey, staleDraftKeys } from "../src/lib/drafts";
import {
  SYNC_OUTAGE_MS,
  isSyncOutage,
  readSyncHealth,
  recordSyncResult,
} from "../src/lib/sync-health";
import type { RecordDoc, Workout } from "../src/data/model";

const record = (
  id: string,
  status: Workout["status"],
  deleted = false,
): RecordDoc => ({
  id,
  kind: "workout",
  payload: {
    name: "W",
    date: "2026-10-26",
    duration: null,
    startedAt: 1,
    status,
    exercises: [],
  },
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted,
});

test("recovery drafts and rest timers of finished or removed workouts are stale", () => {
  const records = {
    running: record("running", "draft"),
    finished: record("finished", "completed"),
    removed: record("removed", "draft", true),
  };
  const keys = [
    draftKey("me", "workout", "running"),
    draftKey("me", "workout", "finished"),
    draftKey("me", "rest", "removed"),
    draftKey("me", "workout", "unknown"),
    draftKey("someone-else", "workout", "finished"),
    draftKey("me", "routine", "finished"),
    "gain-train-theme",
  ];
  assert.deepEqual(staleDraftKeys(keys, "me", records), [
    draftKey("me", "workout", "finished"),
    draftKey("me", "rest", "removed"),
  ]);
});

test("sync health remembers when failures started and clears on success", () => {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  try {
    const account = crypto.randomUUID();
    assert.deepEqual(readSyncHealth(account), {
      lastSyncedAt: null,
      failingSince: null,
    });
    recordSyncResult(account, true, 100);
    recordSyncResult(account, false, 200);
    const failing = recordSyncResult(account, false, 900);
    assert.deepEqual(failing, { lastSyncedAt: 100, failingSince: 200 });
    assert.deepEqual(readSyncHealth(account), failing);
    assert.equal(isSyncOutage(failing, 200 + SYNC_OUTAGE_MS - 1), false);
    assert.equal(isSyncOutage(failing, 200 + SYNC_OUTAGE_MS), true);
    assert.deepEqual(recordSyncResult(account, true, 1000), {
      lastSyncedAt: 1000,
      failingSince: null,
    });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
