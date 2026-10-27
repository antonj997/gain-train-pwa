import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let cachedSyncClient: { token: string; client: SupabaseClient } | undefined;
// Sync uses the session snapshot it checked, not the auto-refreshing client. Reuse
// one client per access token instead of creating one for every 30-second sync.
export function syncClient(token: string) {
  if (cachedSyncClient?.token !== token)
    cachedSyncClient = {
      token,
      client: createClient(url, key, {
        global: { headers: { Authorization: "Bearer " + token } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    };
  return cachedSyncClient.client;
}
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
