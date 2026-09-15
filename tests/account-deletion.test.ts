import test from "node:test";
import assert from "node:assert/strict";
import { deletionHandler } from "../supabase/functions/delete-account/handler";

const config = { url: "https://example.test", key: "server-only" };
const request = (body: unknown, token = "Bearer user-token") =>
  new Request("https://example.test/delete-account", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("account deletion rejects missing credentials and confirmation before touching Auth", async () => {
  const handler = deletionHandler(config, async () => {
    throw Error("Unexpected Auth call");
  });
  assert.equal(
    (await handler(request({ confirmation: "DELETE" }, ""))).status,
    401,
  );
  assert.equal((await handler(request({ confirmation: "no" }))).status, 400);
});
test("account deletion rejects invalid sessions", async () => {
  let calls = 0;
  const handler = deletionHandler(config, async () => {
    calls++;
    return new Response(null, { status: 401 });
  });
  assert.equal(
    (await handler(request({ confirmation: "DELETE" }))).status,
    401,
  );
  assert.equal(calls, 1);
});
test("deletion targets only the verified user and revokes sessions before deletion", async () => {
  const calls: string[] = [];
  const handler = deletionHandler(config, async (url) => {
    calls.push(String(url));
    return calls.length === 1
      ? Response.json({ id: "verified-user" })
      : new Response(null, { status: 204 });
  });
  assert.equal(
    (await handler(request({ confirmation: "DELETE", userId: "someone-else" })))
      .status,
    200,
  );
  assert.deepEqual(calls, [
    config.url + "/auth/v1/user",
    config.url + "/auth/v1/logout?scope=global",
    config.url + "/auth/v1/admin/users/verified-user",
  ]);
});
test("failed session revocation does not delete an account", async () => {
  let calls = 0;
  const handler = deletionHandler(config, async () =>
    ++calls === 1
      ? Response.json({ id: "verified-user" })
      : new Response(null, { status: 503 }),
  );
  assert.equal(
    (await handler(request({ confirmation: "DELETE" }))).status,
    503,
  );
  assert.equal(calls, 2);
});
