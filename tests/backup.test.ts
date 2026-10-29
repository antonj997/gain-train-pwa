import test from "node:test";
import assert from "node:assert/strict";
import {
  BackupError,
  backupFileName,
  parseBackup,
  serializeBackup,
} from "../src/lib/backup";
import { versionSummary, kindName } from "../src/lib/record-summary";
import { newSet, type RecordDoc, type Workout } from "../src/data/model";

const workout: Workout = {
  name: "Push",
  date: "2026-10-12",
  duration: null,
  startedAt: null,
  status: "completed",
  exercises: [
    {
      id: crypto.randomUUID(),
      exerciseId: "bench",
      name: "Bench Press",
      sets: [{ ...newSet(), weight: 60, reps: 5, done: true }],
    },
  ],
};
const record: RecordDoc = {
  id: crypto.randomUUID(),
  kind: "workout",
  payload: workout,
  revision: 1,
  localVersion: 1,
  dirty: false,
  deleted: false,
};

test("a backup round-trips its records", () => {
  const text = serializeBackup([record], new Date("2026-10-12T10:00:00Z"));
  assert.deepEqual(parseBackup(text), [record]);
});

test("malformed backups say they are not backups instead of blaming storage", () => {
  for (const text of [
    "not json",
    "null",
    JSON.stringify({ format: "other", version: 2, records: [] }),
  ])
    assert.throws(() => parseBackup(text), /not a Gain Train backup/);
  for (const records of [[null], [{ id: 1 }], "x"])
    assert.throws(
      () =>
        parseBackup(
          JSON.stringify({ format: "gain-train", version: 2, records }),
        ),
      (error) => error instanceof BackupError && /damaged/.test(error.message),
    );
});

test("the backup file is named after the local date", () => {
  // 00:30 in Stockholm is still the previous day in UTC.
  const local = new Date(2026, 9, 13, 0, 30);
  assert.equal(backupFileName(local), "gain-train-backup-2026-10-13.json");
});

test("conflict versions are summarised so the choice is not blind", () => {
  assert.equal(kindName("workout"), "Workout");
  assert.equal(versionSummary("workout", workout, true), "Deleted");
  assert.match(versionSummary("workout", workout, false), /1 set$/);
  assert.equal(
    versionSummary("routine", { name: "R", exercises: [] }, false),
    "0 exercises",
  );
  assert.equal(
    versionSummary("workout", { name: "Odd" } as unknown as Workout, false),
    "Changed",
  );
});
