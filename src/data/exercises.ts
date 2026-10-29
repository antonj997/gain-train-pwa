import type { CustomExercise, Library, RecordDoc } from "./model";
import { customExercises } from "./selectors";

type Records = Record<string, RecordDoc>;
// Favouriting a built-in exercise saves a hidden custom exercise whose note marks it.
const FAVOURITE_PREFIX = "favourite:";
export const favouriteNote = (builtinId: string) =>
  FAVOURITE_PREFIX + builtinId;
const isFavouriteMarker = (exercise: CustomExercise) =>
  exercise.note.startsWith(FAVOURITE_PREFIX);

/** The hidden record marking a built-in exercise as a favourite, if any. */
export const favouriteMarker = (records: Records, builtinId: string) =>
  customExercises(records).find(
    (r) => r.payload.note === favouriteNote(builtinId),
  );

/** Exercises the user created, without favourite markers. */
export const ownExercises = (records: Records) =>
  customExercises(records)
    .filter((r) => !isFavouriteMarker(r.payload))
    .map((r) => ({ id: r.id, ...r.payload }));

/** Ids of favourite exercises: the user's own starred ones and marked built-ins. */
export function favouriteIds(records: Records) {
  const ids = new Set<string>();
  for (const { id, payload } of customExercises(records))
    if (isFavouriteMarker(payload))
      ids.add(payload.note.slice(FAVOURITE_PREFIX.length));
    else if (payload.favourite) ids.add(id);
  return ids;
}

/**
 * A version 4 UUID (needed by the server) built from a hash of `seed`, so every
 * device derives the same id for the same thing instead of making its own.
 */
export function derivedUuid(seed: string) {
  let h = [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344];
  for (const ch of seed) {
    const c = ch.codePointAt(0)!;
    h = h.map((x, i) => Math.imul(x ^ (c + i), 0x9e3779b1) ^ (x >>> 15));
  }
  for (let round = 0; round < 4; round++)
    h = h.map((x, i) => Math.imul(x ^ h[(i + 1) % 4], 0x85ebca6b) ^ (x >>> 13));
  const hex = h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "89ab"[parseInt(hex[16], 16) % 4] + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** The id of an account's one `library` record. */
export const libraryRecordId = (account: string) =>
  derivedUuid("library:" + account);

/**
 * The account's library settings as saved, or empty ones. Save changes on top
 * of this so one setting (hidden exercises, groups) never drops the other.
 */
export function libraryOf(records: Records, account: string): Library {
  const record = records[libraryRecordId(account)];
  return record?.kind === "library" && !record.deleted
    ? record.payload
    : { hiddenExerciseIds: [] };
}

/** Ids of exercises the user hid from their catalogue, built-in or their own. */
export function hiddenIds(records: Records) {
  const ids = new Set<string>();
  for (const r of Object.values(records))
    if (r.kind === "library" && !r.deleted)
      for (const id of r.payload.hiddenExerciseIds) ids.add(id);
  return ids;
}

/** The hidden list after hiding or unhiding one exercise. */
export function withHidden(
  hidden: ReadonlySet<string>,
  id: string,
  hide: boolean,
) {
  const next = new Set(hidden);
  if (hide) next.add(id);
  else next.delete(id);
  return [...next];
}

/** The items the user has not hidden. */
export const visibleExercises = <T extends { id: string }>(
  items: readonly T[],
  hidden: ReadonlySet<string>,
) => items.filter((item) => !hidden.has(item.id));
