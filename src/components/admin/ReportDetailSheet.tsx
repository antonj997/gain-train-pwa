import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { deleteReport, signedImageUrls, updateReport } from "@/data/feedback";
import { errorMessage } from "@/lib/errors";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_STATUSES,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/feedback";
import { localizedMoment } from "@/lib/dates";
import { useT } from "@/i18n/useT";

type Change = {
  id: string;
  status: FeedbackStatus;
  admin_note: string | null;
  updated_at: string;
};

/** One report for an admin: its text, images and details, with status, note and Delete. */
export default function ReportDetailSheet({
  report: current,
  onClose,
  onUpdated,
  onDeleted,
}: {
  report: FeedbackRow | null;
  onClose: () => void;
  onUpdated: (change: Change) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useT();
  // The last report stays drawn while the sheet animates closed.
  const last = useRef(current);
  if (current) last.current = current;
  const report = last.current;
  const [status, setStatus] = useState<FeedbackStatus>("open");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [urls, setUrls] = useState<(string | null)[] | "loading" | "error">(
    "loading",
  );
  const [viewing, setViewing] = useState<number | null>(null);
  const id = report?.id ?? "";
  const paths = report?.images.join("\n") ?? "";

  // Each report opens with its saved status and note.
  useEffect(() => {
    if (!report) return;
    setStatus(report.status);
    setNote(report.admin_note ?? "");
    setError("");
    setViewing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!paths) {
      setUrls([]);
      return;
    }
    let current = true;
    setUrls("loading");
    signedImageUrls(paths.split("\n"))
      .then((next) => current && setUrls(next))
      .catch(() => current && setUrls("error"));
    return () => {
      current = false;
    };
  }, [paths]);

  if (!report) return null;

  const savedNote = report.admin_note ?? "";
  const dirty = status !== report.status || note.trim() !== savedNote;
  const save = async () => {
    if (note.length > FEEDBACK_LIMITS.note) {
      setError(t("admin.noteTooLong", { max: FEEDBACK_LIMITS.note }));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const change = await updateReport(report.id, {
        status,
        admin_note: note.trim() || null,
      });
      onUpdated(change);
      setNote(change.admin_note ?? "");
      toast.success(t("admin.saved"));
    } catch (cause) {
      setError(errorMessage(cause, t("admin.saveFailed")));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await deleteReport(report);
      setConfirm(false);
      toast.success(t("admin.deleted"));
      onDeleted(report.id);
    } catch {
      toast.error(t("admin.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };
  const who =
    report.reporter_name || report.reporter_email || t("admin.someone");
  const when = localizedMoment(new Date(report.created_at), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const viewed = viewing !== null && Array.isArray(urls) ? urls[viewing] : null;
  return (
    <>
      <Sheet
        size="full"
        open={!!current}
        onClose={() => {
          if (!busy) onClose();
        }}
        title={report.title}
        description={
          (report.kind === "bug" ? t("feedback.bug") : t("feedback.feature")) +
          " · " +
          [who, report.reporter_name && report.reporter_email]
            .filter(Boolean)
            .join(" · ") +
          " · " +
          when
        }
      >
        <section className="report-section">
          <h3 className="feedback-label">{t("admin.descriptionLabel")}</h3>
          <p className="report-text">
            {report.description || t("admin.noDescription")}
          </p>
        </section>

        {report.images.length > 0 && (
          <section className="report-section">
            <h3 className="feedback-label">{t("admin.images")}</h3>
            {urls === "loading" ? (
              <p className="small-note">{t("admin.imagesLoading")}</p>
            ) : urls === "error" ? (
              <p className="small-note">{t("admin.imagesFailed")}</p>
            ) : (
              <ul className="feedback-thumbs">
                {urls.map((url, index) => (
                  <li key={index} className="feedback-thumb">
                    {url ? (
                      <button
                        type="button"
                        className="feedback-thumb-open"
                        aria-label={t("admin.openImage", { n: index + 1 })}
                        onClick={() => setViewing(index)}
                      >
                        <img src={url} alt="" />
                      </button>
                    ) : (
                      <span className="feedback-thumb-missing">
                        {t("admin.imageMissing")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <details className="report-details">
          <summary>{t("admin.details")}</summary>
          {report.details ? (
            <pre>{JSON.stringify(report.details, null, 2)}</pre>
          ) : (
            <p className="small-note">{t("admin.noDetails")}</p>
          )}
        </details>

        <section className="report-section">
          <h3 className="feedback-label">{t("admin.status")}</h3>
          <Segmented<FeedbackStatus>
            label={t("admin.status")}
            value={status}
            options={FEEDBACK_STATUSES.map((value) => ({
              value,
              label: t(`feedback.status.${value}`),
            }))}
            onChange={setStatus}
          />
        </section>
        <label>
          {t("admin.note")}
          <textarea
            value={note}
            maxLength={FEEDBACK_LIMITS.note}
            placeholder={t("admin.notePlaceholder")}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn-danger"
          disabled={busy}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={18} aria-hidden="true" />
          {t("admin.delete")}
        </button>
        <div className="sheet-footer">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            {busy ? t("common.saving") : t("admin.save")}
          </button>
        </div>
      </Sheet>

      <Sheet
        size="full"
        open={viewing !== null && !!viewed}
        onClose={() => setViewing(null)}
        title={t("admin.imageTitle", {
          n: (viewing ?? 0) + 1,
          count: report.images.length,
        })}
      >
        {viewed && (
          <img
            className="report-image-full"
            src={viewed}
            alt={t("feedback.imageAlt", { n: (viewing ?? 0) + 1 })}
          />
        )}
      </Sheet>

      <ConfirmDialog
        open={confirm}
        title={t("admin.deleteTitle")}
        description={t("admin.deleteText")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
