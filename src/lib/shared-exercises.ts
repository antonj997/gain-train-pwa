import type { CustomExercise } from "../data/model";

/** One shared exercise as the app reads it. `mine` replaces the owner's id. */
export type SharedRow = {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  aliases: string[];
  load: "weight" | "bodyweight" | "assisted" | null;
  measure: string | null;
  /** True for rows the signed-in user published. */
  mine: boolean;
  /** The sharer's display name. Absent from an older server's feed. */
  by_name?: string | null;
};

/** The columns an older server (before `shared_exercise_feed`) is read with. */
export const LEGACY_SHARED_COLUMNS =
  "id, owner, name, category, equipment, aliases, load, measure";

/** A row of the older server's table, which still exposed the owner's id. */
export type LegacySharedRow = Omit<SharedRow, "mine"> & { owner: string };

/** The feed shape from an older server's row. */
export const fromLegacyRow = (
  { owner, ...row }: LegacySharedRow,
  me: string,
): SharedRow => ({ ...row, mine: owner === me });

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

const LOADS = ["weight", "bodyweight", "assisted"] as const;
const clip = (text: string, max: number) => text.trim().slice(0, max);

/**
 * A new custom exercise copied from a shared row. It keeps working if the row
 * is removed. Anyone can publish, so each field is clipped to what a custom
 * exercise may hold instead of failing to save.
 */
export function fromSharedRow(row: SharedRow): CustomExercise {
  const aliases = (Array.isArray(row.aliases) ? row.aliases : [])
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && a.length <= 100)
    .slice(0, 20);
  const equipment = row.equipment ? clip(row.equipment, 50) : "";
  const measure = row.measure ? clip(row.measure, 20) : "";
  return {
    name: clip(row.name, 100),
    category: clip(row.category, 50),
    note: "",
    favourite: false,
    sharedFrom: row.id,
    ...(equipment ? { equipment } : {}),
    ...(aliases.length ? { aliases } : {}),
    ...(row.load && LOADS.includes(row.load) ? { load: row.load } : {}),
    ...(measure ? { measure } : {}),
  };
}

/** Other people's rows that the user has not added yet. */
export function visibleShared(
  rows: readonly SharedRow[],
  added: ReadonlySet<string>,
) {
  return rows.filter((row) => !row.mine && !added.has(row.id));
}

/** True when an edit changes what the shared copy shows. */
export function sharedFieldsChanged(
  before: CustomExercise,
  after: CustomExercise,
) {
  return (
    JSON.stringify(toSharedInsert(before)) !==
    JSON.stringify(toSharedInsert(after))
  );
}
