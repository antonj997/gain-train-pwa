import { supabase } from "@/integrations/supabase/client";
import { t } from "../i18n";

/** The signed-in user's display name, or null when none is set. */
export async function fetchDisplayName(userId: string): Promise<string | null> {
  if (!supabase) throw new Error(t("shared.unavailable"));
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const name = (data as { display_name?: unknown } | null)?.display_name;
  return typeof name === "string" && name ? name : null;
}

/** Saves (or with null, clears) the signed-in user's display name. */
export async function saveDisplayName(userId: string, name: string | null) {
  if (!supabase) throw new Error(t("shared.unavailable"));
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: name }, { onConflict: "id" });
  if (error) throw error;
}
