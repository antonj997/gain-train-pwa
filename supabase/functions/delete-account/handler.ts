const PAGE = 1000;

/**
 * Removes the user's images from the `feedback` bucket (migration
 * 20261030120000), since Supabase refuses to delete an auth user who owns
 * storage objects. Paths are `<uid>/<report id>/<n>.jpg`. A bucket that does
 * not exist yet, or a listing that fails, leaves nothing to remove here; only a
 * failed removal returns false. Their reports stay, with `reporter` set null.
 */
export async function removeFeedbackImages(
  config: { url: string; key: string },
  request: typeof fetch,
  userId: string,
) {
  const headers = {
    apikey: config.key,
    Authorization: "Bearer " + config.key,
    "Content-Type": "application/json",
  };
  const list = async (prefix: string) => {
    const entries: { name: string; id: string | null }[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await request(
        config.url + "/storage/v1/object/list/feedback",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ prefix, limit: PAGE, offset }),
        },
      );
      if (!res.ok) return entries;
      const page = await res.json().catch(() => null);
      if (!Array.isArray(page)) return entries;
      entries.push(...page);
      if (page.length < PAGE) return entries;
    }
  };
  const paths: string[] = [];
  for (const entry of await list(userId)) {
    if (typeof entry?.name !== "string") continue;
    // A folder (one report's images) has no id.
    if (entry.id) paths.push(userId + "/" + entry.name);
    else
      for (const file of await list(userId + "/" + entry.name))
        if (file?.id && typeof file.name === "string")
          paths.push(userId + "/" + entry.name + "/" + file.name);
  }
  for (let i = 0; i < paths.length; i += PAGE) {
    const removed = await request(config.url + "/storage/v1/object/feedback", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ prefixes: paths.slice(i, i + PAGE) }),
    });
    if (!removed.ok) return false;
  }
  return true;
}

export function deletionHandler(
  config: { url: string; key: string },
  request: typeof fetch = fetch,
) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  const reply = (status: number, error?: string) =>
    new Response(JSON.stringify(error ? { error } : { deleted: true }), {
      status,
      headers,
    });
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (req.method !== "POST") return reply(405, "Use POST.");
    const token = req.headers.get("authorization");
    if (!token?.startsWith("Bearer "))
      return reply(401, "Sign in before deleting your account.");
    try {
      const body = await req.json();
      if (body.confirmation !== "DELETE")
        return reply(400, "Confirm account deletion.");
      // Authoritative Auth lookup: never accept a user ID from the request body.
      const auth = await request(config.url + "/auth/v1/user", {
        headers: { apikey: config.key, Authorization: token },
      });
      if (!auth.ok)
        return reply(401, "Sign in again before deleting your account.");
      const user = await auth.json();
      if (!user.id) return reply(401, "Account not found.");
      const logout = await request(
        config.url + "/auth/v1/logout?scope=global",
        {
          method: "POST",
          headers: { apikey: config.key, Authorization: token },
        },
      );
      if (!logout.ok)
        return reply(503, "Could not end your sessions. Try again.");
      if (!(await removeFeedbackImages(config, request, user.id)))
        return reply(
          503,
          "Could not delete your account. Sign in again and retry.",
        );
      const removed = await request(
        config.url + "/auth/v1/admin/users/" + encodeURIComponent(user.id),
        {
          method: "DELETE",
          headers: {
            apikey: config.key,
            Authorization: "Bearer " + config.key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ should_soft_delete: false }),
        },
      );
      if (!removed.ok)
        return reply(
          503,
          "Could not delete your account. Sign in again and retry.",
        );
      // Foreign keys cascade to gain_records, gain_sync_receipts,
      // shared_exercises, and (from migration 20261029120000) to the legacy
      // workout_sessions and workout_templates tables and their child rows,
      // and (from migration 20261030090000) to profiles and shared_routines.
      // From migration 20261030120000, app_admins cascades and
      // feedback_reports keep the report with `reporter` set null; the
      // user's feedback images were removed above.
      return reply(200);
    } catch {
      return reply(
        400,
        "Could not complete account deletion. Check your connection and try again.",
      );
    }
  };
}
