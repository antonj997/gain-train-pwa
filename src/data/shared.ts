import { supabase } from "@/integrations/supabase/client";
import {
  SHARED_COLUMNS,
  toSharedInsert,
  type SharedRow,
} from "@/lib/shared-exercises";
import type { CustomExercise } from "./model";

// A simple in-memory cache: the list is fetched when the Shared chip is chosen,
// kept for a minute and dropped after publishing or unsharing.
const TTL_MS = 60_000;
let cache: { at: number; rows: SharedRow[] } | null = null;

/** Every shared exercise the signed-in user may read. Throws on network or server errors. */
export async function fetchShared(force = false): Promise<SharedRow[]> {
  if (!supabase) throw new Error("Sharing is unavailable.");
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const { data, error } = await supabase
    .from("shared_exercises")
    .select(SHARED_COLUMNS)
    .order("name")
    .limit(1000);
  if (error) throw error;
  const rows = (data ?? []) as SharedRow[];
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
