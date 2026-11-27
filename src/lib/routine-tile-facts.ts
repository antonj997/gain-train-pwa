// What a Library tile says about a routine, yours or a shared one: its icons,
// "6 övningar · ~55 min" and the line at its foot. See RoutineTile.
import type { Exercise, RecordDoc, Routine } from "../data/model";
import { catalogueById } from "../data/catalogue";
import { exerciseCategory } from "../data/selectors";
import { t } from "../i18n";
import { sharedByLine } from "./display-name";
import { countLabel, durationLabel } from "./labels";
import { lastUsedLabel } from "./library";
import { exerciseDisplayName } from "./exercise-name";
import { estimatedMinutes, routineLength } from "./routine-preview";
import { tileIcons } from "./routine-library";
import {
  parseSharedPayload,
  parseSharedSet,
  type SharedRoutineExercise,
  type SharedRoutineRow,
} from "./shared-routines";

/** Any valid id: a shared routine's sets are only looked at, never saved. */
const LOOK_ID = "00000000-0000-4000-8000-000000000000";

/** "6 övningar · ~55 min", or just the count without a length. */
export const tileMeta = (exercises: number, minutes: number | null) =>
  countLabel(exercises, "exercise") +
  (minutes ? ` · ~${durationLabel(minutes)}` : "");

/** "Kört mån 16 nov." or "Aldrig körd". */
export const lastDoneLine = (date: string | undefined, now: string) =>
  date
    ? t("routineTile.lastDone", { when: lastUsedLabel(date, now) })
    : t("routine.neverDone");

/** A tile's facts for one of your routines. */
export function ownTileFacts(
  id: string,
  routine: Routine,
  records: Record<string, RecordDoc>,
  lastDone: string | undefined,
  now: string,
) {
  const { minutes } = routineLength(id, routine, records);
  return {
    ...tileIcons(routine.exercises, (exerciseId) =>
      exerciseCategory(records, exerciseId),
    ),
    meta: tileMeta(routine.exercises.length, minutes),
    foot: lastDoneLine(lastDone, now),
    minutes,
  };
}

/** A shared exercise's main category and equipment: the catalogue's, else what was shared. */
export function sharedExerciseFacts(exercise: SharedRoutineExercise) {
  const builtin = exercise.builtin
    ? catalogueById.get(exercise.builtin)
    : undefined;
  return {
    exerciseId: exercise.builtin ?? "shared:" + exercise.name,
    category: builtin?.category ?? exercise.custom?.category,
    equipment: builtin?.equipment ?? exercise.custom?.equipment,
    load: builtin?.load ?? exercise.custom?.load,
  };
}

/**
 * A shared routine as planned exercises, to look at: its sets by structure
 * (they carry no values), with placeholder ids.
 */
export function sharedAsExercises(row: SharedRoutineRow): Exercise[] {
  return parseSharedPayload(row.payload).map((exercise, index) => ({
    id: LOOK_ID,
    exerciseId: exercise.builtin ?? `shared:${index}`,
    name: exercise.name,
    sets: exercise.sets.flatMap((s) => parseSharedSet(s, LOOK_ID) ?? []),
  }));
}

/** A tile's facts for a shared routine in Discover. */
export function sharedTileFacts(row: SharedRoutineRow) {
  const parsed = parseSharedPayload(row.payload);
  const facts = parsed.map(sharedExerciseFacts);
  const categories = new Map(facts.map((f) => [f.exerciseId, f.category]));
  const minutes = estimatedMinutes({ exercises: sharedAsExercises(row) });
  return {
    ...tileIcons(
      facts.map((f) => ({ exerciseId: f.exerciseId })),
      (exerciseId) => categories.get(exerciseId),
    ),
    meta: tileMeta(parsed.length, minutes),
    foot: row.mine ? t("sharedPreview.byYou") : sharedByLine(row.by_name),
    minutes,
    facts,
    // Search finds the stored and the shown (Swedish) name.
    names: parsed.flatMap((exercise) =>
      exercise.builtin
        ? [exercise.name, exerciseDisplayName(exercise.builtin, exercise.name)]
        : [exercise.name],
    ),
  };
}
