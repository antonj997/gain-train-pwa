import test from "node:test";
import assert from "node:assert/strict";
import {
  FEEDBACK_LIMITS,
  buildTechnicalDetails,
  cleanTitle,
  feedbackFields,
  feedbackImagePath,
  feedbackProblem,
  filterReports,
  fitWithin,
  parseFeedbackRow,
  relativeAge,
  statusCounts,
  type FeedbackRow,
} from "../src/lib/feedback.ts";

const draft = (change = {}) => ({
  kind: "bug" as const,
  title: "Timer stops",
  description: "",
  imageCount: 0,
  ...change,
});

test("a report needs a title of at most 120 characters", () => {
  assert.equal(feedbackProblem(draft()), null);
  assert.equal(feedbackProblem(draft({ title: "   " })), "titleMissing");
  assert.equal(feedbackProblem(draft({ title: "x".repeat(120) })), null);
  assert.equal(
    feedbackProblem(draft({ title: "x".repeat(121) })),
    "titleTooLong",
  );
  // Spaces collapse before counting, as the server wants a trimmed title.
  assert.equal(
    feedbackProblem(draft({ title: " a" + " ".repeat(200) + "b " })),
    null,
  );
});

test("descriptions and images have limits", () => {
  assert.equal(feedbackProblem(draft({ description: "x".repeat(5000) })), null);
  assert.equal(
    feedbackProblem(draft({ description: "x".repeat(5001) })),
    "descriptionTooLong",
  );
  assert.equal(feedbackProblem(draft({ imageCount: 4 })), null);
  assert.equal(feedbackProblem(draft({ imageCount: 5 })), "tooManyImages");
});

test("fields are cleaned for the server", () => {
  assert.equal(cleanTitle("  Crash\non\tsave  "), "Crash on save");
  assert.deepEqual(
    feedbackFields(draft({ title: " Hi  there ", description: "  text \n" })),
    { kind: "bug", title: "Hi there", description: "text" },
  );
});

test("technical details stay under the size limit", () => {
  const base = {
    version: "abc1234 · 2026-10-30",
    language: "sv",
    userAgent: "Mozilla/5.0 (iPhone)",
    viewport: "390×844",
  };
  assert.deepEqual(buildTechnicalDetails(base), base);
  const crash = {
    message: "boom",
    stack: "at x\n".repeat(2000),
    path: "/workout/1",
    at: "2026-10-30T10:00:00Z",
  };
  const small = buildTechnicalDetails({ ...base, lastError: crash }, 2000);
  assert.ok(new TextEncoder().encode(JSON.stringify(small)).length <= 2000);
  assert.equal(small.lastError?.message, "boom");
  assert.ok(small.lastError!.stack.length < crash.stack.length);
  const full = buildTechnicalDetails({ ...base, lastError: crash });
  assert.equal(full.lastError?.stack.length, 4000);
  assert.ok(
    new TextEncoder().encode(JSON.stringify(full)).length <=
      FEEDBACK_LIMITS.detailsBytes,
  );
  // A huge user agent is cut rather than sent whole.
  assert.equal(
    buildTechnicalDetails({ ...base, userAgent: "x".repeat(1000) }).userAgent
      .length,
    400,
  );
});

test("images shrink to a 1600 px long edge and never grow", () => {
  assert.deepEqual(fitWithin(4032, 3024, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(1179, 2556, 1600), { width: 738, height: 1600 });
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(10000, 1, 1600), { width: 1600, height: 1 });
  assert.deepEqual(fitWithin(0, 100, 1600), { width: 0, height: 0 });
  assert.deepEqual(fitWithin(NaN, 100, 1600), { width: 0, height: 0 });
});

test("images are stored under the user and the report, numbered from 1", () => {
  assert.equal(feedbackImagePath("u", "r", 0), "u/r/1.jpg");
  assert.equal(feedbackImagePath("u", "r", 3), "u/r/4.jpg");
});

const row = (change: Partial<FeedbackRow>): FeedbackRow => ({
  id: "1",
  kind: "bug",
  title: "t",
  description: "",
  images: [],
  details: null,
  status: "open",
  admin_note: null,
  created_at: "2026-10-30T10:00:00Z",
  updated_at: "2026-10-30T10:00:00Z",
  ...change,
});

test("server rows are made safe to show", () => {
  assert.equal(parseFeedbackRow(null), null);
  assert.equal(parseFeedbackRow({ id: 1, title: "x" }), null);
  const parsed = parseFeedbackRow({
    id: "a",
    title: "x",
    kind: "weird",
    status: "lost",
    images: ["p", 3],
    details: [1],
    reporter_email: "a@b.c",
  });
  assert.equal(parsed?.kind, "bug");
  assert.equal(parsed?.status, "open");
  assert.deepEqual(parsed?.images, ["p"]);
  assert.equal(parsed?.details, null);
  assert.equal(parsed?.reporter_email, "a@b.c");
  assert.equal(parsed?.reporter_name, null);
});

test("the inbox filters by status and kind, newest first", () => {
  const rows = [
    row({ id: "a", created_at: "2026-10-28T00:00:00Z" }),
    row({ id: "b", kind: "feature", created_at: "2026-10-30T00:00:00Z" }),
    row({ id: "c", status: "done", created_at: "2026-10-29T00:00:00Z" }),
  ];
  assert.deepEqual(
    filterReports(rows, "open", "").map((r) => r.id),
    ["b", "a"],
  );
  assert.deepEqual(
    filterReports(rows, "open", "bug").map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(
    filterReports(rows, "all", "").map((r) => r.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(statusCounts(rows), {
    open: 2,
    planned: 0,
    done: 1,
    wontfix: 0,
  });
});

test("ages read as minutes, hours and days, then a date", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  assert.equal(relativeAge("2026-10-30T11:59:40Z", now, "en-GB"), "now");
  assert.equal(
    relativeAge("2026-10-30T11:55:00Z", now, "en-GB"),
    "5 minutes ago",
  );
  assert.equal(
    relativeAge("2026-10-30T09:00:00Z", now, "en-GB"),
    "3 hours ago",
  );
  assert.equal(relativeAge("2026-10-29T09:00:00Z", now, "en-GB"), "yesterday");
  assert.equal(
    relativeAge("2026-10-27T09:00:00Z", now, "sv-SE"),
    "för 3 dagar sedan",
  );
  assert.equal(relativeAge("2026-10-01T09:00:00Z", now, "en-GB"), "1 Oct");
  assert.equal(relativeAge("2025-10-01T09:00:00Z", now, "en-GB"), "1 Oct 2025");
  assert.equal(relativeAge("nope", now, "en-GB"), "");
});
