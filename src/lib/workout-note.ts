// The optional note on a whole workout. Pure, so it is tested
// (tests/workout-note.test.ts).
import { WORKOUT_NOTE_MAX, type Workout } from "../data/model";

export { WORKOUT_NOTE_MAX };

/**
 * A note as it is saved: trimmed, at most WORKOUT_NOTE_MAX characters, and
 * undefined when nothing is left. Line breaks inside it stay.
 */
export function cleanWorkoutNote(text: string | null | undefined) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= WORKOUT_NOTE_MAX) return trimmed;
  // Counted in UTF-16 units like the schema; never split an emoji in two.
  let clipped = trimmed.slice(0, WORKOUT_NOTE_MAX);
  if (/[\uD800-\uDBFF]$/.test(clipped)) clipped = clipped.slice(0, -1);
  return clipped.trimEnd();
}

/** The workout with its note set, or without one when the text is blank. */
export function withWorkoutNote<T extends Pick<Workout, "note">>(
  workout: T,
  text: string | null | undefined,
): T {
  const note = cleanWorkoutNote(text);
  const result = { ...workout };
  if (note === undefined) delete result.note;
  else result.note = note;
  return result;
}

/** The note to show, or null when the workout has none. */
export const workoutNoteOf = (workout: Pick<Workout, "note">) =>
  cleanWorkoutNote(workout.note) ?? null;
