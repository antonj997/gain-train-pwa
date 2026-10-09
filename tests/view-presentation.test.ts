import test from "node:test";
import assert from "node:assert/strict";
import {
  recoveryRequested,
  recoveryRedirect,
  recoveredSessionMatches,
} from "../src/lib/authRecovery";
import { localizedDate } from "../src/lib/dates";
import { chartSessions, chartDomain } from "../src/lib/progressPresentation";

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

test("charts distinguish same-day sessions and keep a zero baseline", () => {
  const sessions = chartSessions(
    [
      { date: "2026-10-08", workoutId: "early" },
      { date: "2026-10-08", workoutId: "late" },
      { date: "2026-10-09", workoutId: "next" },
    ],
    "en-GB",
  );
  assert.match(sessions[0].label, /8 Oct.*1/);
  assert.match(sessions[1].label, /8 Oct.*2/);
  assert.doesNotMatch(sessions[2].label, /·/);
  assert.deepEqual(chartDomain([100, 101]), [0, 112]);
  assert.deepEqual(chartDomain([]), [0, 1]);
});
