import { z } from "zod";
import {
  validate,
  isFromNewerApp,
  RecordValidationError,
  SCHEMA_VERSION,
  recordKinds,
  type Kind,
  type LocalState,
  type Payload,
  type RecordDoc,
  type Workout,
} from "./model";
import { startedWorkouts, WorkoutInProgressError } from "./workout-start";

// The local writes behind DataContext, as plain functions on the stored state.
// Each runs inside one IndexedDB transaction (see `transact`): a throw rolls the
// whole change back. Keeping them free of React makes them testable on their own.

export const NEWER_APP_MESSAGE =
  "This was saved by a newer version of Gain Train. Close and reopen the app to update it, then try again.";

/** A new local version supersedes any earlier server rejection. */
const nextVersion = (record: RecordDoc): Partial<RecordDoc> => ({
  localVersion: record.localVersion + 1,
  dirty: true,
  syncError: undefined,
});

/** Saves an already validated payload as the next local version of `id`. */
export function saveRecordIn(
  s: LocalState,
  id: string,
  kind: Kind,
  parsed: Payload,
  now = Date.now(),
) {
  const old = s.records[id];
  if (old && isFromNewerApp(old.payload))
    throw new RecordValidationError(NEWER_APP_MESSAGE);
  if (kind === "workout" && old?.deleted)
    throw new RecordValidationError(
      "This workout was removed. Return to your log to resume your current workout.",
    );
  let saved: Payload = { ...parsed, schemaVersion: SCHEMA_VERSION };
  if (kind === "workout") {
    const workout = saved as Workout;
    if (workout.status === "draft" && workout.startedAt !== null) {
      const others = startedWorkouts(s).filter((record) => record.id !== id);
      if (others.length) throw new WorkoutInProgressError(others);
    }
    const previous = old?.kind === "workout" ? old.payload : undefined;
    saved = {
      ...workout,
      createdAt: previous
        ? (previous.createdAt ?? workout.createdAt)
        : (workout.createdAt ?? now),
      ...(workout.status === "completed"
        ? {
            completedAt:
              previous?.status === "completed"
                ? previous.completedAt
                : (workout.completedAt ?? now),
          }
        : {}),
    };
  }
  s.records[id] = {
    ...old,
    id,
    kind,
    payload: saved,
    deleted: false,
    revision: old?.revision ?? 0,
    localVersion: (old?.localVersion ?? 0) + 1,
    dirty: true,
    syncError: undefined,
  } as RecordDoc;
}

/** Marks a record deleted. The payload is kept, so Undo can bring it back. */
export function deleteRecordIn(s: LocalState, id: string) {
  const saved = s.records[id];
  if (!saved)
    throw new RecordValidationError(
      "Could not find the saved record. Return to your log and try again.",
    );
  if (saved.deleted) return;
  s.records[id] = {
    ...saved,
    ...nextVersion(saved),
    payload: validate(saved.kind, saved.payload),
    deleted: true,
  } as RecordDoc;
}

/** Settles a sync conflict: keep this phone's version, or take the server's. */
export function resolveConflictIn(s: LocalState, id: string, mine: boolean) {
  const r = s.records[id],
    remote = r?.conflict;
  if (!remote) return;
  s.outbox = s.outbox.filter((o) => o.id !== id);
  s.records[id] = (
    mine
      ? {
          ...r,
          ...nextVersion(r),
          conflict: undefined,
          revision: remote.revision,
        }
      : { ...remote, localVersion: r.localVersion + 1, dirty: false }
  ) as RecordDoc;
}

/** Lets every change the server refused be sent once more. */
export function retryRejectedIn(s: LocalState) {
  for (const record of Object.values(s.records)) delete record.syncError;
}

/**
 * Checks backup records before the import transaction: ids, kinds and payloads.
 * Deleted records in the backup are left out.
 */
export function parseImport(records: RecordDoc[]) {
  if (records.length > 10000)
    throw new RecordValidationError("Backup is too large.");
  const restored: RecordDoc[] = [];
  for (const r of records) {
    if (
      !z.string().uuid().safeParse(r.id).success ||
      !z.enum(recordKinds).safeParse(r.kind).success
    )
      throw new RecordValidationError(
        "Backup contains an invalid record ID or type.",
      );
    if (!r.deleted)
      restored.push({
        ...r,
        payload: validate(r.kind, r.payload),
      } as RecordDoc);
  }
  return restored;
}

/** Adds checked backup records that are missing here, or deleted here. Live records are kept. */
export function importRecordsIn(s: LocalState, restored: RecordDoc[]) {
  let restoredStartedWorkout = false;
  for (const r of restored) {
    const old = s.records[r.id];
    if (old && !old.deleted) continue;
    if (old && old.kind !== r.kind)
      throw new RecordValidationError(
        "A backup record does not match its saved record type.",
      );
    s.records[r.id] = {
      ...old,
      id: r.id,
      kind: r.kind,
      payload: r.payload,
      deleted: false,
      revision: old?.revision ?? 0,
      localVersion: (old?.localVersion ?? 0) + 1,
      dirty: true,
      syncError: undefined,
    } as RecordDoc;
    if (
      r.kind === "workout" &&
      r.payload.status === "draft" &&
      r.payload.startedAt !== null
    )
      restoredStartedWorkout = true;
  }
  if (restoredStartedWorkout && startedWorkouts(s).length > 1)
    throw new RecordValidationError(
      "A workout is already in progress. Finish or abandon it before restoring a backup with another started workout. No backup records were changed.",
    );
}
