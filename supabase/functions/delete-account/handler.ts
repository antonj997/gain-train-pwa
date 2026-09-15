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
      // Foreign keys cascade to all gain_records and gain_sync_receipts.
      return reply(200);
    } catch {
      return reply(
        400,
        "Could not complete account deletion. Check your connection and try again.",
      );
    }
  };
}
