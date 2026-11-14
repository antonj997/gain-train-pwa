import test from "node:test";
import assert from "node:assert/strict";
import {
  recoveryRequested,
  recoveryRedirect,
  recoveredSessionMatches,
} from "../src/lib/authRecovery";
import { localizedDate } from "../src/lib/dates";

test("password recovery survives a callback URL and uses the app base path", () => {
  assert.equal(
    recoveryRequested("https://example.com/gain/auth?recovery=1"),
    true,
  );
  assert.equal(
    recoveryRequested(
      "https://example.com/gain/#access_token=secret&type=recovery",
    ),
    true,
  );
  assert.equal(
    recoveryRequested("https://example.com/gain/auth?recovery=0"),
    false,
  );
  assert.equal(recoveryRequested("https://example.com/gain/auth"), false);
  assert.equal(
    recoveryRedirect("/gain/", "https://example.com"),
    "https://example.com/gain/auth?recovery=1",
  );
});

test("an existing signed-in account cannot stand in for a failed recovery session", () => {
  assert.equal(recoveredSessionMatches(null, "already-signed-in"), false);
  assert.equal(
    recoveredSessionMatches("recovered-account", "other-account"),
    false,
  );
  assert.equal(
    recoveredSessionMatches("recovered-account", "recovered-account"),
    true,
  );
  assert.equal(recoveredSessionMatches("recovered-account", undefined), false);
});

test("calendar-only display stays on the logged day without UTC conversion", () => {
  assert.equal(
    localizedDate(
      "2026-01-01",
      { year: "numeric", month: "2-digit", day: "2-digit" },
      "en-GB",
    ),
    "01/01/2026",
  );
  assert.equal(localizedDate("bad-date"), "bad-date");
});
