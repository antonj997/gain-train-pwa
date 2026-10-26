import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useProfile } from "@/contexts/useProfile";
import { parseBodyWeightInput } from "@/lib/profile";
import "@/styles/profile.css";

export default function ProfileForm() {
  const { user } = useAuth();
  const { bodyWeightKg, saveProfile, status, error, retrySync } = useProfile();
  const [draft, setDraft] = useState(bodyWeightKg?.toString() ?? "");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fieldError, setFieldError] = useState("");
  useEffect(() => {
    if (!editing) setDraft(bodyWeightKg?.toString() ?? "");
  }, [bodyWeightKg, editing]);
  const save = (event: FormEvent) => {
    event.preventDefault();
    try {
      saveProfile({ bodyWeightKg: parseBodyWeightInput(draft) });
      setFieldError("");
      setEditing(false);
      setSaved(true);
    } catch (error) {
      setFieldError(
        error instanceof Error
          ? error.message
          : "Could not save your bodyweight. Try again.",
      );
    }
  };
  const saveMessage = editing
    ? "Unsaved changes."
    : status === "syncing"
      ? "Checking profile sync…"
      : status === "pending"
        ? user
          ? "Saved on this device. Will sync when connected."
          : "Saved on this device. Sign in to sync."
        : status === "synced"
          ? "Profile synced."
          : bodyWeightKg === null
            ? saved
              ? "Bodyweight cleared on this device."
              : "No bodyweight saved."
            : "Saved on this device.";
  return (
    <section
      className="settings-card profile-section"
      aria-labelledby="profile-heading"
    >
      <div>
        <h2 id="profile-heading">Profile</h2>
        <p className="small-note">
          Your bodyweight appears when you choose BW in a workout.
        </p>
      </div>
      <form className="profile-form" onSubmit={save} noValidate>
        <label htmlFor="profile-bodyweight">Bodyweight (kg)</label>
        <div className="profile-input-row">
          <input
            id="profile-bodyweight"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            placeholder="e.g. 75.5"
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
            Save bodyweight
          </button>
        </div>
        <p className="small-note" id="profile-weight-help">
          Leave blank and save to clear your bodyweight.
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
            Retry profile sync
          </button>
        )}
      </form>
    </section>
  );
}
