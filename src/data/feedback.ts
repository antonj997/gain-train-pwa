import { supabase } from "@/integrations/supabase/client";
import {
  FEEDBACK_BUCKET,
  FEEDBACK_LIMITS,
  feedbackImagePath,
  parseFeedbackRow,
  type FeedbackKind,
  type FeedbackRow,
  type FeedbackStatus,
  type TechnicalDetails,
} from "@/lib/feedback";
import { t } from "../i18n";

const MY_COLUMNS =
  "id, kind, title, description, images, details, status, admin_note, created_at, updated_at";

const client = () => {
  if (!supabase) throw new Error(t("shared.unavailable"));
  return supabase;
};

/** A thrown error that says what to show: a server limit, or a plain retry. */
export class FeedbackError extends Error {
  constructor(
    message: string,
    readonly reason: "limit" | "upload" | "send",
  ) {
    super(message);
  }
}

/**
 * Uploads the images to `feedback/<uid>/<report id>/<n>.jpg`, then inserts the
 * report with their paths. When anything fails, the uploaded images are
 * removed again and the error is thrown.
 */
export async function sendFeedback(input: {
  userId: string;
  kind: FeedbackKind;
  title: string;
  description: string;
  images: Blob[];
  details: TechnicalDetails | null;
}) {
  const db = client();
  const id = crypto.randomUUID();
  const storage = db.storage.from(FEEDBACK_BUCKET);
  const uploaded: string[] = [];
  try {
    for (const [index, image] of input.images.entries()) {
      const path = feedbackImagePath(input.userId, id, index);
      const { error } = await storage.upload(path, image, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw new FeedbackError(t("feedback.uploadFailed"), "upload");
      uploaded.push(path);
    }
    const { error } = await db.from("feedback_reports").insert({
      id,
      kind: input.kind,
      title: input.title,
      description: input.description,
      images: uploaded,
      details: input.details,
    });
    if (error) {
      if (error.code === "P0001")
        throw new FeedbackError(
          t("feedback.limitDay", { max: FEEDBACK_LIMITS.perDay }),
          "limit",
        );
      throw new FeedbackError(t("feedback.sendFailed"), "send");
    }
    return id;
  } catch (cause) {
    if (uploaded.length) await storage.remove(uploaded).catch(() => {});
    if (cause instanceof FeedbackError) throw cause;
    throw new FeedbackError(t("feedback.sendFailed"), "send");
  }
}

/** The signed-in user's own reports, newest first. */
export async function fetchMyReports(userId: string): Promise<FeedbackRow[]> {
  const { data, error } = await client()
    .from("feedback_reports")
    .select(MY_COLUMNS)
    // Admins may read every report; this list is only the user's own.
    .eq("reporter", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(parseFeedbackRow).filter((r) => r !== null);
}

// Whether each account is an admin, asked once per session.
const admins = new Map<string, boolean>();

/** Whether the signed-in user is an admin; false when the server says no or lacks the function. */
export async function checkAdmin(userId: string): Promise<boolean> {
  const known = admins.get(userId);
  if (known !== undefined) return known;
  const { data, error } = await client().rpc("is_admin");
  if (error) {
    // No such function: the server has not got the feedback migration yet.
    if (["PGRST202", "42883"].includes(String(error.code))) {
      admins.set(userId, false);
      return false;
    }
    throw error;
  }
  admins.set(userId, data === true);
  return data === true;
}
export const knownAdmin = (userId: string) => admins.get(userId);

/** Every report, for the admin inbox. */
export async function fetchAllReports(): Promise<FeedbackRow[]> {
  const { data, error } = await client().rpc("admin_feedback_feed");
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map(parseFeedbackRow)
    .filter((r) => r !== null);
}

/** How many reports are open, for the badge on Settings → Admin. */
export async function countOpenReports() {
  const { count, error } = await client()
    .from("feedback_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) throw error;
  return count ?? 0;
}

export async function updateReport(
  id: string,
  change: { status: FeedbackStatus; admin_note: string | null },
) {
  const { data, error } = await client()
    .from("feedback_reports")
    .update(change)
    .eq("id", id)
    .select("id, status, admin_note, updated_at");
  if (error) throw error;
  if (!data?.length) throw new Error(t("admin.notSaved"));
  return data[0] as {
    id: string;
    status: FeedbackStatus;
    admin_note: string | null;
    updated_at: string;
  };
}

/** Deletes a report's images, then the report. */
export async function deleteReport(report: FeedbackRow) {
  const db = client();
  if (report.images.length) {
    const { error } = await db.storage
      .from(FEEDBACK_BUCKET)
      .remove(report.images);
    if (error) throw error;
  }
  const { error } = await db
    .from("feedback_reports")
    .delete()
    .eq("id", report.id);
  if (error) throw error;
}

/** Signed URLs for a report's images, an hour long; null for one that is gone. */
export async function signedImageUrls(paths: string[]) {
  if (!paths.length) return [];
  const { data, error } = await client()
    .storage.from(FEEDBACK_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  return paths.map(
    (path) => data?.find((d) => d.path === path && !d.error)?.signedUrl ?? null,
  );
}
