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
    config.url + "/storage/v1/object/list/feedback",
    config.url + "/auth/v1/admin/users/verified-user",
  ]);
});
test("deletion removes the user's feedback images before deleting the user", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const handler = deletionHandler(config, async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: String(url), body });
    if (String(url).endsWith("/auth/v1/user"))
      return Response.json({ id: "u1" });
    if (String(url).endsWith("/object/list/feedback"))
      return Response.json(
        body.prefix === "u1"
          ? [
              { name: "r1", id: null },
              { name: "stray.jpg", id: "x" },
            ]
          : [
              { name: "1.jpg", id: "a" },
              { name: "2.jpg", id: "b" },
            ],
      );
    return new Response(null, { status: 200 });
  });
  assert.equal(
    (await handler(request({ confirmation: "DELETE" }))).status,
    200,
  );
  const removal = calls.find((c) =>
    c.url.endsWith("/storage/v1/object/feedback"),
  );
  assert.deepEqual(removal?.body, {
    prefixes: ["u1/r1/1.jpg", "u1/r1/2.jpg", "u1/stray.jpg"],
  });
  assert.ok(calls.at(-1)?.url.endsWith("/auth/v1/admin/users/u1"));
});
test("a failed image removal keeps the account", async () => {
  const urls: string[] = [];
  const handler = deletionHandler(config, async (url) => {
    urls.push(String(url));
    if (String(url).endsWith("/auth/v1/user"))
      return Response.json({ id: "u1" });
    if (String(url).endsWith("/object/list/feedback"))
      return Response.json([{ name: "1.jpg", id: "a" }]);
    if (String(url).endsWith("/storage/v1/object/feedback"))
      return new Response(null, { status: 500 });
    return new Response(null, { status: 200 });
  });
  assert.equal(
    (await handler(request({ confirmation: "DELETE" }))).status,
    503,
  );
  assert.ok(!urls.some((u) => u.includes("/admin/users/")));
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
