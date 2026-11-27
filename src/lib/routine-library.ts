// Library → Routines as tiles (Library concept, step 13): the tile's icons,
// folders, the two sort orders, Duplicate and a routine saved from a
// workout. Pure, so it is tested (tests/routine-library.test.ts).
import type { Exercise, Routine, Workout } from "../data/model";
import { isDrop } from "../data/drops";
import { initialSet, type ExerciseDefaults } from "../data/workouts";
import { parseSharedSet, toSharedSet } from "./shared-routines";

/** Icons a tile shows at most; more categories become a "+N" chip. */
export const TILE_ICONS = 3;

export type TileIcon = { exerciseId: string; category: string };

/**
 * A tile's icons: the first exercise of each main category, in the
 * routine's order, at most three, and how many more categories there are.
 * An exercise of unknown category counts as Other.
 */
export function tileIcons(
  exercises: readonly Pick<Exercise, "exerciseId">[],
  categoryOf: (exerciseId: string) => string | undefined,
): { icons: TileIcon[]; more: number } {
  const seen = new Set<string>();
  const lead: TileIcon[] = [];
  for (const { exerciseId } of exercises) {
    const category = categoryOf(exerciseId) || "Other";
    if (seen.has(category)) continue;
    seen.add(category);
    lead.push({ exerciseId, category });
  }
  return {
    icons: lead.slice(0, TILE_ICONS),
    more: Math.max(0, lead.length - TILE_ICONS),
  };
}

/**
 * A routine name in pieces that may break after "|" and "/", so
 * "Bröst|Axlar|Armar" wraps as "Bröst|" / "Axlar|Armar" and not mid-word.
 */
export const namePieces = (name: string) =>
  name.match(/[^|/]+[|/]?|[|/]/g) ?? [name];

export type RoutineSort = "recent" | "name";

/**
 * Routines in the tile grid's order. "recent": the last done first, then the
 * ones never done, A–Ö. "name": A–Ö. `pins` maps a copy to its original: a
 * copy made this session sits right after its original, whatever the order
 * (the newest copy first), so Duplicate lands where it was asked for.
 */
export function sortRoutines<
  T extends { id: string; payload: { name: string } },
>(
  items: readonly T[],
  lastDone: ReadonlyMap<string, string>,
  sort: RoutineSort,
  pins: ReadonlyMap<string, string> = new Map(),
  locale?: string,
): T[] {
  const byName = (a: T, b: T) =>
    a.payload.name.localeCompare(b.payload.name, locale, {
      sensitivity: "base",
      numeric: true,
    }) || a.id.localeCompare(b.id);
  const sorted = [...items].sort((a, b) => {
    if (sort === "recent") {
      const da = lastDone.get(a.id) ?? "";
      const db = lastDone.get(b.id) ?? "";
      if (da !== db) return db.localeCompare(da);
    }
    return byName(a, b);
  });
  const present = new Set(items.map((item) => item.id));
  const pinned = [...pins].filter(
    ([copy, original]) =>
      copy !== original && present.has(copy) && present.has(original),
  );
  if (!pinned.length) return sorted;
  const moved = new Set(pinned.map(([copy]) => copy));
  const result = sorted.filter((item) => !moved.has(item.id));
  for (const [copy, original] of pinned) {
    const item = sorted.find((r) => r.id === copy)!;
    const at = result.findIndex((r) => r.id === original);
    if (at < 0) result.push(item);
    else result.splice(at + 1, 0, item);
  }
  return result;
}

/** The longest folder name. */
export const FOLDER_MAX = 40;

/** A folder name as stored: trimmed, single spaces, at most 40 characters; null when empty. */
export function normalizeFolder(name: string | null | undefined) {
  const clean = (name ?? "").trim().replace(/\s+/g, " ").slice(0, FOLDER_MAX);
  return clean.trimEnd() || null;
}

/**
 * The folder a typed name means: an existing one with the same name in any
 * case ("push" → "Push"), else the name itself. Null when empty.
 */
export function matchFolder(name: string, existing: readonly string[]) {
  const clean = normalizeFolder(name);
  if (!clean) return null;
  const key = clean.toLocaleLowerCase();
  return existing.find((f) => f.toLocaleLowerCase() === key) ?? clean;
}

/** Every folder in use with its routine count, A–Ö. */
export function folderCounts(
  routines: readonly { payload: Pick<Routine, "folder"> }[],
  locale?: string,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { payload } of routines) {
    const folder = normalizeFolder(payload.folder);
    if (folder) counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, locale, { sensitivity: "base" }),
    );
}

/** The routine in `folder`, or in none for null. */
export function withFolder(routine: Routine, folder: string | null): Routine {
  const next = { ...routine };
  const clean = normalizeFolder(folder);
  if (clean) next.folder = clean;
  else delete next.folder;
  return next;
}

/** "Push day (kopia)": the name with a suffix, kept within 100 characters. */
export function copyName(name: string, suffix: string) {
  const tail = ` ${suffix}`;
  return (
    name
      .trim()
      .slice(0, 100 - tail.length)
      .trimEnd() + tail
  );
}

/**
 * A copy of a routine for Duplicate: the same exercises, sets, targets and
 * folder under `name`, with new ids for the exercises and sets, and not
 * shared (no sharedId) nor marked as saved from a shared routine.
 */
export function duplicateRoutine(
  routine: Routine,
  name: string,
  newId: () => string = () => crypto.randomUUID(),
): Routine {
  const {
    sharedId: _sharedId,
    sharedFrom: _sharedFrom,
    ...rest
  } = structuredClone(routine);
  return {
    ...rest,
    name,
    exercises: rest.exercises.map((exercise) => ({
      ...exercise,
      id: newId(),
      sets: exercise.sets.map((set) => ({ ...set, id: newId(), done: false })),
    })),
  };
}

/**
 * The routine "Save as a routine" keeps from a finished workout: its
 * exercises and the structure of their sets (section, drop, load, measure),
 * with no weights, reps or other values, the rule shared routines follow
 * (toSharedSet). New ids throughout.
 */
export function routineFromWorkout(
  workout: Pick<Workout, "name" | "exercises">,
  newId: () => string = () => crypto.randomUUID(),
): Routine {
  return {
    name: workout.name,
    exercises: workout.exercises.map((exercise) => ({
      id: newId(),
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      ...(exercise.repRange ? { repRange: exercise.repRange } : {}),
      sets: exercise.sets.flatMap(
        (set) => parseSharedSet(toSharedSet(set), newId()) ?? [],
      ),
    })),
  };
}

/**
 * Planned working sets per main category, for the preview's bar: most sets
 * first, then in the routine's order. Warm-ups, cool-downs and drops are not
 * counted.
 */
export function plannedSetsByCategory(
  exercises: readonly Pick<Exercise, "exerciseId" | "sets">[],
  categoryOf: (exerciseId: string) => string | undefined,
): { category: string; sets: number }[] {
  const counts = new Map<string, number>();
  for (const exercise of exercises) {
    const sets = exercise.sets.filter(
      (set) => set.section === "working" && !isDrop(set),
    ).length;
    if (!sets) continue;
    const category = categoryOf(exercise.exerciseId) || "Other";
    counts.set(category, (counts.get(category) ?? 0) + sets);
  }
  return [...counts]
    .map(([category, sets]) => ({ category, sets }))
    .sort((a, b) => b.sets - a.sets);
}

/** Working sets a new routine exercise starts with (v6 §E5; it was 1). */
export const NEW_ROUTINE_SETS = 3;

/**
 * The routine with the picked exercises added at the end, in the order
 * picked, each with three empty working sets (their targets come from
 * history at the start). New ids throughout.
 */
export function addExercisesToRoutine(
  routine: Routine,
  items: readonly ({ id: string; name: string } & ExerciseDefaults)[],
  newId: () => string = () => crypto.randomUUID(),
): Routine {
  return {
    ...routine,
    exercises: [
      ...routine.exercises,
      ...items.map((item) => ({
        id: newId(),
        exerciseId: item.id,
        name: item.name,
        sets: Array.from({ length: NEW_ROUTINE_SETS }, () => ({
          ...initialSet(item.id, item),
          id: newId(),
        })),
      })),
    ],
  };
}
