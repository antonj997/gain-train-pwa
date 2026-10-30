import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import { parseBodyWeightInput } from "@/lib/profile";
import "@/styles/profile.css";
import { formatDecimal, t } from "@/i18n";

export default function ProfileForm() {
  const { user } = useAuth();
  const { bodyWeightKg, saveProfile, status, error, retrySync } = useProfile();
  const [draft, setDraft] = useState(
    bodyWeightKg === null ? "" : formatDecimal(bodyWeightKg),
  );
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldError, setFieldError] = useState("");
  useEffect(() => {
    if (!editing)
      setDraft(bodyWeightKg === null ? "" : formatDecimal(bodyWeightKg));
  }, [bodyWeightKg, editing]);
  const save = (event: FormEvent) => {
    event.preventDefault();
    try {
      saveProfile({ bodyWeightKg: parseBodyWeightInput(draft) });
      setFieldError("");
      setEditing(false);
      setSaved(true);
    } catch (error) {
      setFieldError(errorMessage(error, t("profile.saveFailed")));
    }
  };
  const saveMessage = editing
    ? t("profile.unsaved")
    : status === "syncing"
      ? t("profile.checking")
      : status === "pending"
        ? user
          ? t("profile.pendingSignedIn")
          : t("profile.pendingSignIn")
        : status === "synced"
          ? t("profile.synced")
          : bodyWeightKg === null
            ? saved
              ? t("profile.cleared")
              : t("profile.none")
            : t("profile.savedDevice");
  return (
    <section className="profile-section">
      <p className="small-note">{t("profile.intro")}</p>
      <form className="profile-form" onSubmit={save} noValidate>
        <label htmlFor="profile-bodyweight">{t("profile.label")}</label>
        <div className="profile-input-row">
          <input
            id="profile-bodyweight"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            placeholder={t("profile.placeholder")}
            value={draft}
            aria-describedby={`profile-weight-help${fieldError ? " profile-weight-error" : ""}`}
            aria-invalid={!!fieldError}
            onChange={(event) => {
              setDraft(event.target.value);
              setEditing(true);
              setFieldError("");
            }}
          />
          <button className="primary" type="submit" disabled={!editing}>
            {t("profile.save")}
          </button>
        </div>
        <p className="small-note" id="profile-weight-help">
          {t("profile.clearHint")}
        </p>
        {fieldError && (
          <p className="error-text" role="alert" id="profile-weight-error">
            {fieldError}
          </p>
        )}
        {error && !fieldError && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {!error && (
          <p className="small-note profile-save-state" role="status">
            {saveMessage}
          </p>
        )}
        {status === "error" && user && (
          <button className="text-button" type="button" onClick={retrySync}>
            {t("profile.retry")}
          </button>
        )}
      </form>
    </section>
  );
}
