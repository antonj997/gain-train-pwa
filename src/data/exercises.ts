import type { CustomExercise, RecordDoc } from "./model";
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
