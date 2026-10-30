import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import Sheet from "@/components/ui/Sheet";
import type { DisplayNameStatus } from "@/hooks/useDisplayName";
import { DISPLAY_NAME_MAX, normalizeDisplayName } from "@/lib/display-name";
import { errorMessage } from "@/lib/errors";
import { t } from "@/i18n";

/** Settings → Name: the display name shown on what the user shares. */
export default function NameSheet({
  open,
  onClose,
  name,
  status,
  online,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  name: string | null;
  status: DisplayNameStatus;
  online: boolean;
  onSave: (name: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(name ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Each opening starts from the saved name.
  useEffect(() => {
    if (open) {
      setDraft(name ?? "");
      setError("");
    }
  }, [open, name]);

  const store = async (next: string | null) => {
    setBusy(true);
    setError("");
    try {
      await onSave(next);
      toast.success(next ? t("name.saved") : t("name.removed"));
      onClose();
    } catch {
      setError(t("name.saveFailed"));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    let next: string | null;
    try {
      next = normalizeDisplayName(draft);
    } catch (cause) {
      setError(errorMessage(cause, t("name.saveFailed")));
      return;
    }
    void store(next);
  };
  const disabled = busy || !online || status === "loading";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("name.title")}
      description={t("name.description")}
    >
      <form className="name-form" onSubmit={submit} noValidate>
        <label>
          {t("name.label")}
          <input
            type="text"
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={DISPLAY_NAME_MAX + 10}
            placeholder={t("name.placeholder")}
            value={draft}
            disabled={disabled}
            aria-invalid={!!error}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {!online && (
          <p className="row-sub" role="status">
            {t("name.offline")}
          </p>
        )}
        {online && status === "error" && (
          <p className="row-sub" role="status">
            {t("name.loadFailed")}
          </p>
        )}
        <button className="btn-primary" type="submit" disabled={disabled}>
          {busy ? t("name.saving") : t("name.save")}
        </button>
        {name && (
          <button
            className="btn-quiet"
            type="button"
            disabled={disabled}
            onClick={() => void store(null)}
          >
            {t("name.remove")}
          </button>
        )}
      </form>
    </Sheet>
  );
}
