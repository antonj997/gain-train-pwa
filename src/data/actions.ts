import { z } from "zod";
import {
  validate,
  isFromNewerApp,
  RecordValidationError,
  SCHEMA_VERSION,
  recordKinds,
  type Kind,
  type Library,
  type LocalState,
  type Payload,
  type RecordDoc,
  type Workout,
} from "./model";
import { startedWorkouts, WorkoutInProgressError } from "./workout-start";
import { libraryRecordId, mergeLibraries } from "./exercises";
import { t } from "../i18n";

// The local writes behind DataContext, as plain functions on the stored state.
// Each runs inside one IndexedDB transaction (see `transact`): a throw rolls the
// whole change back. Keeping them free of React makes them testable on their own.

export const newerAppMessage = () => t("err.newerApp");

/** Below the server's 512 KB jsonb limit, with room for its encoding. */
export const MAX_PAYLOAD_CHARS = 450_000;

/** A new local version supersedes any earlier server rejection. */
const nextVersion = (record: RecordDoc): Partial<RecordDoc> => ({
  localVersion: record.localVersion + 1,
  dirty: true,
  syncError: undefined,
});

const isRunning = (workout: Workout) =>
  workout.status === "draft" && workout.startedAt !== null;

/** True when saving `next` would make a workout run that is not running yet. */
export function startsRunning(old: RecordDoc | undefined, next: Workout) {
  if (!isRunning(next)) return false;
  return !(old?.kind === "workout" && !old.deleted && isRunning(old.payload));
}

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
    throw new RecordValidationError(newerAppMessage());
  if (kind === "workout" && old?.deleted)
    throw new RecordValidationError(t("err.workoutRemoved"));
  let saved: Payload = { ...parsed, schemaVersion: SCHEMA_VERSION };
  // The server refuses payloads over 512 KB; say so before anything is queued.
  if (JSON.stringify(saved).length > MAX_PAYLOAD_CHARS)
    throw new RecordValidationError(t("err.tooLarge"));
  if (kind === "workout") {
    const workout = saved as Workout;
    // One running workout at a time is checked when a workout starts running
    // here. A second one can still arrive from another device by sync; saving
    // a workout that is already running must keep working then.
    if (startsRunning(old, workout)) {
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
  if (!saved) throw new RecordValidationError(t("err.recordMissing"));
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
    throw new RecordValidationError(t("err.backupTooLarge"));
  const restored: RecordDoc[] = [];
  for (const r of records) {
    if (
      !z.string().uuid().safeParse(r.id).success ||
      !z.enum(recordKinds).safeParse(r.kind).success
    )
      throw new RecordValidationError(t("err.backupInvalidId"));
    if (!r.deleted)
      restored.push({
        ...r,
        payload: validate(r.kind, r.payload),
      } as RecordDoc);
  }
  return restored;
}

export type ImportResult = {
  /** Records this log did not have. */
  added: number;
  /** Records deleted here that the backup brought back. */
  restored: number;
  /** Records this log already has; the version here was kept. */
  kept: number;
};

/** Adds checked backup records that are missing here, or deleted here. Live records are kept. */
export function importRecordsIn(
  s: LocalState,
  restored: RecordDoc[],
): ImportResult {
  const result: ImportResult = { added: 0, restored: 0, kept: 0 };
  let restoredStartedWorkout = false;
  for (const r of restored) {
    const old = s.records[r.id];
    if (old && !old.deleted) {
      result.kept++;
      continue;
    }
    result[old ? "restored" : "added"]++;
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
    throw new RecordValidationError(t("err.backupStarted"));
  return result;
}

/** The toast after a restore: what was added and brought back, and what was kept. */
export function importSummary({ added, restored, kept }: ImportResult) {
  if (!added && !restored) return t("err.nothingToRestore");
  const parts = [
    added && t("summary.added", { count: added }),
    restored && t("summary.broughtBack", { count: restored }),
  ].filter(Boolean);
  return (
    t("summary.restored", { parts: parts.join(", ") }) +
    (kept ? " " + t("summary.kept", { count: kept }) : "")
  );
}

/**
 * Saves the account's library record and folds any other library record into
 * it: an earlier phone-log copy brought the phone's own, and settings saved
 * only to the account's could not undo what that one held.
 */
export function saveLibraryIn(
  s: LocalState,
  account: string,
  library: Library,
) {
  const own = libraryRecordId(account);
  for (const r of Object.values(s.records))
    if (r.kind === "library" && !r.deleted && r.id !== own)
      deleteRecordIn(s, r.id);
  saveRecordIn(s, own, "library", library);
}

export type CopyResult = {
  /** Records copied into the account. */
  added: number;
  /** Running workouts copied as past workouts, with no timer. */
  pastWorkouts: number;
};

/** Phone-log records the account has never had, live or deleted. The library is merged, not copied. */
export function phoneRecordsToCopy(
  phone: Record<string, RecordDoc>,
  account: Record<string, RecordDoc>,
) {
  return Object.values(phone).filter(
    (r) => !r.deleted && r.kind !== "library" && !account[r.id],
  );
}

/**
 * Copies the phone-only log into a signed-in account, in one transaction.
 * - Records the account already has stay as they are, and records deleted
 *   in the account are not brought back.
 * - The phone's library (hidden exercises, groups) is merged into the
 *   account's one library record instead of being copied next to it.
 * - A workout still running on the phone arrives as a past workout, so it
 *   never blocks the copy or the account's own running workout.
 */
export function copyPhoneLogIn(
  s: LocalState,
  account: string,
  phone: RecordDoc[],
): CopyResult {
  const result: CopyResult = { added: 0, pastWorkouts: 0 };
  const byId = Object.fromEntries(phone.map((r) => [r.id, r]));
  for (const r of phoneRecordsToCopy(byId, s.records)) {
    let payload = r.payload;
    if (
      r.kind === "workout" &&
      r.payload.status === "draft" &&
      r.payload.startedAt !== null
    ) {
      payload = { ...r.payload, startedAt: null };
      result.pastWorkouts++;
    }
    s.records[r.id] = {
      id: r.id,
      kind: r.kind,
      payload,
      deleted: false,
      revision: 0,
      localVersion: 1,
      dirty: true,
    } as RecordDoc;
    result.added++;
  }
  const libraries = phone.filter((r) => r.kind === "library" && !r.deleted);
  if (libraries.length) {
    const own = s.records[libraryRecordId(account)];
    let library: Library =
      own?.kind === "library" && !own.deleted
        ? own.payload
        : { hiddenExerciseIds: [] };
    for (const r of libraries)
      library = mergeLibraries(library, r.payload as Library);
    saveLibraryIn(s, account, validate("library", library));
  }
  return result;
}

/** The toast after copying the phone log. */
export function copySummary({ added, pastWorkouts }: CopyResult) {
  if (!added) return t("err.nothingToCopy");
  return (
    t("summary.copied", { count: added }) +
    (pastWorkouts ? " " + t("summary.pastWorkout") : "")
  );
}
