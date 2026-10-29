import { supabase } from "@/integrations/supabase/client";
import {
  LEGACY_SHARED_COLUMNS,
  fromLegacyRow,
  toSharedInsert,
  type LegacySharedRow,
  type SharedRow,
} from "@/lib/shared-exercises";
import type { CustomExercise } from "./model";

// A simple in-memory cache: the list is fetched when the Shared chip is chosen,
// kept for a minute and dropped after publishing or unsharing.
const TTL_MS = 60_000;
let cache: { at: number; rows: SharedRow[] } | null = null;

// PostgREST's "no such function" codes, for a server without the feed yet.
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

/** Every shared exercise the signed-in user may read. Throws on network or server errors. */
export async function fetchShared(
  me: string,
  force = false,
): Promise<SharedRow[]> {
  if (!supabase) throw new Error("Sharing is unavailable.");
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const feed = await supabase.rpc("shared_exercise_feed");
  let rows: SharedRow[];
  if (!feed.error) rows = (feed.data ?? []) as SharedRow[];
  else if (MISSING_FUNCTION.has(String(feed.error.code))) {
    const { data, error } = await supabase
      .from("shared_exercises")
      .select(LEGACY_SHARED_COLUMNS)
      .order("name")
      .limit(1000);
    if (error) throw error;
    rows = ((data ?? []) as LegacySharedRow[]).map((r) => fromLegacyRow(r, me));
  } else throw feed.error;
  cache = { at: Date.now(), rows };
  return rows;
}

/** Publishes an exercise and returns the new row's id. */
export async function publishExercise(exercise: CustomExercise) {
  if (!supabase) throw new Error("Sharing is unavailable.");
  const { data, error } = await supabase
    .from("shared_exercises")
    .insert(toSharedInsert(exercise))
    .select("id")
    .single();
  if (error) throw error;
  cache = null;
  return data.id as string;
}

/** Brings a published row up to date with the exercise it was shared from. */
export async function updateSharedExercise(
  sharedId: string,
  exercise: CustomExercise,
) {
  if (!supabase) throw new Error("Sharing is unavailable.");
  const { data, error } = await supabase
    .from("shared_exercises")
    .update(toSharedInsert(exercise))
    .eq("id", sharedId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("The shared copy was not updated.");
  cache = null;
}

/** Removes a published row. Copies other people made are unaffected. */
export async function unpublishExercise(sharedId: string) {
  if (!supabase) throw new Error("Sharing is unavailable.");
  const { error } = await supabase
    .from("shared_exercises")
    .delete()
    .eq("id", sharedId);
  if (error) throw error;
  cache = null;
}
