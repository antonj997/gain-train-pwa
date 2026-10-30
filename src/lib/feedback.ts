// Pure helpers for bug reports and feature ideas: validation, the technical
// details sent with a report, image sizes and storage paths. The server
// (migration 20261030120000) enforces the same limits.

export type FeedbackKind = "bug" | "feature";
export type FeedbackStatus = "open" | "planned" | "done" | "wontfix";

export const FEEDBACK_KINDS: readonly FeedbackKind[] = ["bug", "feature"];
export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = [
  "open",
  "planned",
  "done",
  "wontfix",
];

export const FEEDBACK_LIMITS = {
  title: 120,
  description: 5000,
  images: 4,
  note: 2000,
  /** The long edge of an attached image after compression. */
  imageEdge: 1600,
  imageQuality: 0.82,
  /** The server refuses details over 16 KB of JSON text. */
  detailsBytes: 16384,
  /** Reports a person may send a day. */
  perDay: 10,
} as const;

export const FEEDBACK_BUCKET = "feedback";

export type FeedbackDraft = {
  kind: FeedbackKind;
  title: string;
  description: string;
  imageCount: number;
};

export type FeedbackProblem =
  "titleMissing" | "titleTooLong" | "descriptionTooLong" | "tooManyImages";

/** Collapses spaces and removes control characters, as the server wants a trimmed title. */
export const cleanTitle = (title: string) =>
  title
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The first problem with a draft, or null when it can be sent. */
export function feedbackProblem(draft: FeedbackDraft): FeedbackProblem | null {
  const title = cleanTitle(draft.title);
  if (!title) return "titleMissing";
  if ([...title].length > FEEDBACK_LIMITS.title) return "titleTooLong";
  if (draft.description.trim().length > FEEDBACK_LIMITS.description)
    return "descriptionTooLong";
  if (draft.imageCount > FEEDBACK_LIMITS.images) return "tooManyImages";
  return null;
}

/** The row fields of a valid draft, without images or details. */
export function feedbackFields(draft: FeedbackDraft) {
  return {
    kind: draft.kind,
    title: cleanTitle(draft.title),
    description: draft.description.trim(),
  };
}

export type TechnicalDetails = {
  version: string;
  language: string;
  userAgent: string;
  viewport: string;
  screen?: string;
  pixelRatio?: number;
  standalone?: boolean;
  path?: string;
  online?: boolean;
  lastError?: { message: string; stack: string; path: string; at: string };
};

const byteLength = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * The technical details sent with a report, kept under the server's size
 * limit: a long crash stack is shortened first, then dropped.
 */
export function buildTechnicalDetails(
  input: TechnicalDetails,
  maxBytes: number = FEEDBACK_LIMITS.detailsBytes,
): TechnicalDetails {
  const details: TechnicalDetails = {
    ...input,
    version: input.version.slice(0, 80),
    language: input.language.slice(0, 10),
    userAgent: input.userAgent.slice(0, 400),
    viewport: input.viewport.slice(0, 40),
  };
  if (input.lastError)
    details.lastError = {
      message: input.lastError.message.slice(0, 500),
      stack: input.lastError.stack.slice(0, 4000),
      path: input.lastError.path.slice(0, 200),
      at: input.lastError.at.slice(0, 40),
    };
  while (details.lastError && byteLength(details) > maxBytes) {
    const stack = details.lastError.stack;
    if (!stack) delete details.lastError;
    else details.lastError.stack = stack.slice(0, Math.floor(stack.length / 2));
  }
  return details;
}

/** The size to draw an image at so its long edge is at most `max`; never upscales. */
export function fitWithin(width: number, height: number, max: number) {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Where an attached image is stored: `<uid>/<report id>/<n>.jpg`, n from 1. */
export const feedbackImagePath = (
  userId: string,
  reportId: string,
  index: number,
) => `${userId}/${reportId}/${index + 1}.jpg`;

export type FeedbackRow = {
  id: string;
  kind: FeedbackKind;
  title: string;
  description: string;
  images: string[];
  details: Record<string, unknown> | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string | null;
  reporter_email?: string | null;
};

const isStatus = (value: unknown): value is FeedbackStatus =>
  FEEDBACK_STATUSES.includes(value as FeedbackStatus);

/** A report row from the server, with anything unexpected made safe to show. */
export function parseFeedbackRow(raw: unknown): FeedbackRow | null {
  const row = raw as Record<string, unknown> | null;
  if (!row || typeof row.id !== "string" || typeof row.title !== "string")
    return null;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: row.id,
    kind: row.kind === "feature" ? "feature" : "bug",
    title: row.title,
    description: text(row.description),
    images: Array.isArray(row.images)
      ? row.images.filter((p): p is string => typeof p === "string")
      : [],
    details:
      row.details &&
      typeof row.details === "object" &&
      !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : null,
    status: isStatus(row.status) ? row.status : "open",
    admin_note: typeof row.admin_note === "string" ? row.admin_note : null,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
    reporter_name:
      typeof row.reporter_name === "string" ? row.reporter_name : null,
    reporter_email:
      typeof row.reporter_email === "string" ? row.reporter_email : null,
  };
}

export type StatusFilter = FeedbackStatus | "all";

/** Reports with the chosen status and kind ("" for every kind), newest first. */
export function filterReports(
  rows: readonly FeedbackRow[],
  status: StatusFilter,
  kind: FeedbackKind | "",
) {
  return rows
    .filter(
      (r) =>
        (status === "all" || r.status === status) && (!kind || r.kind === kind),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** How many reports have each status. */
export function statusCounts(rows: readonly FeedbackRow[]) {
  const counts: Record<FeedbackStatus, number> = {
    open: 0,
    planned: 0,
    done: 0,
    wontfix: 0,
  };
  for (const row of rows) counts[row.status]++;
  return counts;
}

/**
 * "just now", "5 min ago", "3 h ago", "2 days ago", then a date: how long ago
 * a report was sent, in the given locale.
 */
export function relativeAge(iso: string, now: number, locale: string) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, (now - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return rtf.format(0, "second");
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 86400 * 7)
    return rtf.format(-Math.floor(seconds / 86400), "day");
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(new Date(then).getFullYear() !== new Date(now).getFullYear()
      ? { year: "numeric" }
      : {}),
  }).format(then);
}
