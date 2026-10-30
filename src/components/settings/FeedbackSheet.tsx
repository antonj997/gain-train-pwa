import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { readLastError } from "@/components/ErrorBoundary";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import MyReports from "@/components/settings/MyReports";
import { sendFeedback } from "@/data/feedback";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { errorMessage } from "@/lib/errors";
import {
  FEEDBACK_LIMITS,
  buildTechnicalDetails,
  feedbackFields,
  feedbackProblem,
  type FeedbackKind,
  type FeedbackProblem,
} from "@/lib/feedback";
import { useT } from "@/i18n/useT";
import type { Language } from "@/i18n";

type Picked = { id: string; blob: Blob; url: string };

/** What this device and build look like, for a bug report. */
function collectDetails(language: Language, online: boolean) {
  const standalone =
    globalThis.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return buildTechnicalDetails({
    version: typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "dev",
    language,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${screen.width}×${screen.height}`,
    pixelRatio: window.devicePixelRatio,
    standalone,
    path: location.pathname,
    online,
    lastError: readLastError() ?? undefined,
  });
}

const problemText = (
  problem: FeedbackProblem,
  t: ReturnType<typeof useT>["t"],
) =>
  problem === "titleMissing"
    ? t("feedback.titleMissing")
    : problem === "titleTooLong"
      ? t("feedback.titleTooLong", { max: FEEDBACK_LIMITS.title })
      : problem === "descriptionTooLong"
        ? t("feedback.descriptionTooLong", {
            max: FEEDBACK_LIMITS.description,
          })
        : t("feedback.tooManyImages", { max: FEEDBACK_LIMITS.images });

/**
 * Settings → Send feedback: a bug or feature idea with a title, description,
 * up to four images and optional technical details, and the user's own
 * reports with their status. The draft stays while Settings is open, so
 * closing the sheet or going offline loses nothing.
 */
export default function FeedbackSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, account } = useAuth();
  const { online } = useData();
  const { t, language } = useT();
  const signedIn = !!supabase && !!user && account === user.id;
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<Picked[]>([]);
  const [details, setDetails] = useState<boolean | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<FeedbackProblem | null>(null);
  const [error, setError] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  // Technical details are on for bugs and off for ideas until the user chooses.
  const includeDetails = details ?? kind === "bug";

  // Thumbnails are object URLs; release them when the sheet's owner goes away.
  const latest = useRef(images);
  latest.current = images;
  useEffect(
    () => () => latest.current.forEach((i) => URL.revokeObjectURL(i.url)),
    [],
  );

  if (!signedIn)
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={t("feedback.signInTitle")}
        description={t("feedback.signInText")}
      >
        <Link className="btn-primary" to="/auth" onClick={onClose}>
          {t("feedback.signIn")}
        </Link>
      </Sheet>
    );

  const addFiles = async (files: File[]) => {
    setImageNote("");
    const room = FEEDBACK_LIMITS.images - images.length;
    const chosen = files.slice(0, room);
    let failed = 0;
    setPreparing(true);
    const added: Picked[] = [];
    for (const file of chosen) {
      try {
        const blob = await compressImage(file);
        added.push({
          id: crypto.randomUUID(),
          blob,
          url: URL.createObjectURL(blob),
        });
      } catch {
        failed++;
      }
    }
    setPreparing(false);
    setImages((current) => [...current, ...added]);
    if (failed) setImageNote(t("feedback.imageFailed", { count: failed }));
    else if (files.length > room)
      setImageNote(
        t("feedback.tooManyImages", { max: FEEDBACK_LIMITS.images }),
      );
  };
  const removeImage = (id: string) => {
    setImages((current) => {
      const gone = current.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter((i) => i.id !== id);
    });
    setImageNote("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const draft = { kind, title, description, imageCount: images.length };
    const found = feedbackProblem(draft);
    setProblem(found);
    setError("");
    if (found || !user) return;
    if (!online) {
      setError(t("feedback.offline"));
      return;
    }
    setBusy(true);
    try {
      await sendFeedback({
        userId: user.id,
        ...feedbackFields(draft),
        images: images.map((i) => i.blob),
        details: includeDetails ? collectDetails(language, online) : null,
      });
      images.forEach((i) => URL.revokeObjectURL(i.url));
      setImages([]);
      setTitle("");
      setDescription("");
      setDetails(null);
      setKind("bug");
      setImageNote("");
      setSentAt(Date.now());
      toast.success(t("feedback.sent"));
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, t("feedback.sendFailed")));
    } finally {
      setBusy(false);
    }
  };

  const descriptionLength = description.length;
  const full = images.length >= FEEDBACK_LIMITS.images;
  return (
    <Sheet
      size="full"
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t("feedback.title")}
      description={t("feedback.description")}
    >
      <form className="feedback-form" onSubmit={submit} noValidate>
        <Segmented<FeedbackKind>
          label={t("feedback.kind")}
          value={kind}
          options={[
            { value: "bug", label: t("feedback.bug") },
            { value: "feature", label: t("feedback.feature") },
          ]}
          onChange={setKind}
        />
        <label>
          {t("feedback.titleLabel")}
          <input
            type="text"
            autoCapitalize="sentences"
            enterKeyHint="next"
            maxLength={FEEDBACK_LIMITS.title + 20}
            placeholder={
              kind === "bug"
                ? t("feedback.titlePlaceholderBug")
                : t("feedback.titlePlaceholderFeature")
            }
            value={title}
            disabled={busy}
            aria-invalid={
              problem === "titleMissing" || problem === "titleTooLong"
            }
            onChange={(event) => {
              setTitle(event.target.value);
              setProblem(null);
            }}
          />
        </label>
        <label>
          {t("feedback.descriptionLabel")}
          <textarea
            className="feedback-description"
            maxLength={FEEDBACK_LIMITS.description}
            placeholder={
              kind === "bug"
                ? t("feedback.descriptionPlaceholderBug")
                : t("feedback.descriptionPlaceholderFeature")
            }
            value={description}
            disabled={busy}
            onChange={(event) => {
              setDescription(event.target.value);
              setProblem(null);
            }}
          />
        </label>
        {descriptionLength > FEEDBACK_LIMITS.description * 0.8 && (
          <p className="row-sub feedback-count">
            {t("feedback.characters", {
              count: descriptionLength,
              max: FEEDBACK_LIMITS.description,
            })}
          </p>
        )}

        <div className="feedback-images">
          <span className="feedback-label">{t("feedback.images")}</span>
          {images.length > 0 && (
            <ul className="feedback-thumbs">
              {images.map((image, index) => (
                <li key={image.id} className="feedback-thumb">
                  <img
                    src={image.url}
                    alt={t("feedback.imageAlt", { n: index + 1 })}
                  />
                  <button
                    type="button"
                    className="feedback-thumb-remove"
                    aria-label={t("feedback.removeImage", { n: index + 1 })}
                    disabled={busy}
                    onClick={() => removeImage(image.id)}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // The same file can be picked again after removing it.
              event.target.value = "";
              if (files.length) void addFiles(files);
            }}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || preparing || full}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={18} aria-hidden="true" />
            {preparing ? t("feedback.preparing") : t("feedback.addImages")}
          </button>
          <p className="row-sub">
            {t("feedback.imagesNote", { max: FEEDBACK_LIMITS.images })}
          </p>
          {imageNote && (
            <p className="field-warning" role="status">
              {imageNote}
            </p>
          )}
        </div>

        <div>
          <Switch
            label={t("feedback.includeDetails")}
            checked={includeDetails}
            disabled={busy}
            onChange={setDetails}
          />
          <p className="small-note">{t("feedback.includeDetailsNote")}</p>
        </div>

        {problem && (
          <p className="field-error" role="alert">
            {problemText(problem, t)}
          </p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn-primary"
          type="submit"
          disabled={busy || preparing}
        >
          {busy ? t("feedback.sending") : t("feedback.send")}
        </button>
      </form>

      <MyReports active={open} userId={user?.id ?? ""} refresh={sentAt} />
    </Sheet>
  );
}
