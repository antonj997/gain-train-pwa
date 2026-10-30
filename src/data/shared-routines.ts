import { supabase } from "@/integrations/supabase/client";
import type { SharedRoutineRow } from "@/lib/shared-routines";
import { t } from "../i18n";

// Fetched when the Shared view is chosen, kept for a minute and dropped after
// publishing, updating or unsharing (as for shared exercises).
const TTL_MS = 60_000;
let cache: { at: number; rows: SharedRoutineRow[] } | null = null;

type Insert = { name: string; note: string | null; payload: unknown };

/** Every shared routine the signed-in user may read. Throws on network or server errors. */
export async function fetchSharedRoutines(
  force = false,
): Promise<SharedRoutineRow[]> {
  if (!supabase) throw new Error(t("shared.unavailable"));
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const { data, error } = await supabase.rpc("shared_routine_feed");
  if (error) throw error;
  const rows = ((data ?? []) as SharedRoutineRow[]).filter(
    (r) => r && typeof r.id === "string" && typeof r.name === "string",
  );
  cache = { at: Date.now(), rows };
  return rows;
}

/** Publishes a routine and returns the new row's id. */
export async function publishRoutine(insert: Insert) {
  if (!supabase) throw new Error(t("shared.unavailable"));
  const { data, error } = await supabase
    .from("shared_routines")
    .insert(insert)
    .select("id")
    .single();
  if (error) throw error;
  cache = null;
  return data.id as string;
}

/** Brings a published routine up to date with the routine it was shared from. */
export async function updateSharedRoutine(sharedId: string, insert: Insert) {
  if (!supabase) throw new Error(t("shared.unavailable"));
  const { data, error } = await supabase
    .from("shared_routines")
    .update(insert)
    .eq("id", sharedId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error(t("shared.notUpdated"));
  cache = null;
}

/** Removes a published routine. Copies other people added are unaffected. */
export async function unpublishRoutine(sharedId: string) {
  if (!supabase) throw new Error(t("shared.unavailable"));
  const { error } = await supabase
    .from("shared_routines")
    .delete()
    .eq("id", sharedId);
  if (error) throw error;
  cache = null;
}
