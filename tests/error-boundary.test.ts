import test from "node:test";
import assert from "node:assert/strict";
import {
  errorReport,
  isStaleCodeError,
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
