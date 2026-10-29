import test from "node:test";
import assert from "node:assert/strict";
import {
  errorReport,
  isStaleCodeError,
  shouldReloadForStaleCode,
} from "../src/components/ErrorBoundary.tsx";

test("stale code after a deploy is recognised in Safari and Chromium wording", () => {
  assert.ok(isStaleCodeError("Importing a module script failed."));
  assert.ok(
    isStaleCodeError(
      "Failed to fetch dynamically imported module: /assets/History-abc.js",
    ),
  );
  assert.ok(!isStaleCodeError("Cannot read properties of undefined"));
});

test("error reports carry the message and the component stack", () => {
  const report = errorReport(new TypeError("boom"), "in SetLine");
  assert.equal(report.message, "boom");
  assert.match(report.stack, /in SetLine/);
  assert.equal(errorReport("plain").message, "plain");
});

test("a later deploy still reloads, but a reload that did not help does not loop", () => {
  const stale = "Importing a module script failed.";
  assert.equal(shouldReloadForStaleCode(stale, null, 1_000_000), true);
  // Days after the first reload in the same installed-app session.
  assert.equal(shouldReloadForStaleCode(stale, 1_000, 1_000_000), true);
  assert.equal(shouldReloadForStaleCode(stale, 990_000, 1_000_000), false);
  assert.equal(shouldReloadForStaleCode("boom", null, 1_000_000), false);
});
