import type { CustomExercise } from "../data/model";

/** One row of public.shared_exercises as the app reads it. */
export type SharedRow = {
  id: string;
  owner: string;
  name: string;
  category: string;
  equipment: string | null;
  aliases: string[];
  load: "weight" | "bodyweight" | "assisted" | null;
  measure: string | null;
};

/** The columns the app selects. */
export const SHARED_COLUMNS =
  "id, owner, name, category, equipment, aliases, load, measure";

/** The row to insert for a custom exercise. The owner column defaults to the signed-in user. */
export function toSharedInsert(exercise: CustomExercise) {
  return {
    name: exercise.name.trim(),
    category: exercise.category,
    equipment: exercise.equipment ?? null,
    aliases: exercise.aliases ?? [],
    load: exercise.load ?? null,
    measure: exercise.measure ?? null,
  };
}

/** A new custom exercise copied from a shared row. It keeps working if the row is removed. */
export function fromSharedRow(row: SharedRow): CustomExercise {
  return {
    name: row.name,
    category: row.category,
    note: "",
    favourite: false,
    sharedFrom: row.id,
    ...(row.equipment ? { equipment: row.equipment } : {}),
    ...(row.aliases.length ? { aliases: row.aliases } : {}),
    ...(row.load ? { load: row.load } : {}),
    ...(row.measure ? { measure: row.measure } : {}),
  };
}

/** Other people's rows that the user has not added yet. */
export function visibleShared(
  rows: readonly SharedRow[],
  me: string,
  added: ReadonlySet<string>,
) {
  return rows.filter((row) => row.owner !== me && !added.has(row.id));
}
