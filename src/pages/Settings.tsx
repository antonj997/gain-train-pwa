import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  RefreshCw,
  UserRound,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useTheme } from "@/contexts/useTheme";
import ProfileForm from "@/components/ProfileForm";
import { removeProfileCache } from "@/lib/profile";
import { readAccount } from "@/data/database";
import { requestPersistentStorage } from "@/lib/persistence";
import { type RecordDoc } from "@/data/model";
import {
  readTrainingPreferences,
  saveTrainingPreferences,
} from "@/lib/preferences";
export default function Settings() {
  const { user, account, signOut, deleteAccount } = useAuth(),
    { state, sync, syncing, online, error, resolve, importRecords } = useData(),
    { theme, toggleTheme } = useTheme();
  const [importing, setImporting] = useState(false);
  const [preferences, setPreferences] = useState(readTrainingPreferences);
  const [accountBusy, setAccountBusy] = useState(false);
  const [deleting, setDeleting] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [deleteError, setDeleteError] = useState("");
  const conflicts = Object.values(state.records).filter((r) => r.conflict);
  const dirty = Object.values(state.records).filter((r) => r.dirty).length;
  const updatePreferences = (patch: Partial<typeof preferences>) => {
    saveTrainingPreferences(patch);
    setPreferences(readTrainingPreferences());
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: "gain-train",
              version: 2,
              exportedAt: new Date().toISOString(),
              records: Object.values(state.records),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "gain-train-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restore = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > 20_000_000)
        throw Error("Choose a backup smaller than 20 MB.");
      const data = JSON.parse(await file.text());
      if (
        data.format !== "gain-train" ||
        data.version !== 2 ||
        !Array.isArray(data.records)
      )
        throw Error("This is not a Gain Train backup.");
      await importRecords(data.records as RecordDoc[]);
      toast.success("Backup restored. Existing workouts were kept.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore backup");
    } finally {
      setImporting(false);
    }
  };
  return (
    <div className="stack settings-page">
      <h1>Settings</h1>
      <ProfileForm />
      <section className="settings-card">
        <div className="theme-setting">
          <div>
            <h2>Appearance</h2>
            <p className="small-note">{theme === "dark" ? "Dark" : "Light"}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={theme === "light"}
            aria-label="Light appearance"
            className={
              "theme-switch " + (theme === "light" ? "is-day" : "is-night")
            }
            onClick={toggleTheme}
          >
            <span className="theme-stars" aria-hidden="true">
              ✦ · ✧
            </span>
            <span className="theme-orb" aria-hidden="true">
              <Moon className="theme-moon" size={22} />
              <Sun className="theme-sun" size={24} />
            </span>
            <span className="theme-horizon" aria-hidden="true" />
          </button>
        </div>
        <Link className="secondary" to="/my-exercises">
          Manage exercises & favourites
        </Link>
        <Link className="secondary" to="/routines">
          Manage routines
        </Link>
        <button
          className="text-button"
          onClick={async () => {
            try {
              const ok = await requestPersistentStorage();
              toast(
                ok
                  ? "Persistent storage enabled"
                  : "Your browser manages storage automatically. Keep a backup too.",
              );
            } catch {
              toast.error(
                "Your browser could not enable persistent storage. Export a backup to keep a separate copy.",
              );
            }
          }}
        >
          Keep data on this device
        </button>
      </section>
      <section className="settings-card">
        <h2>Between sets</h2>
        <label className="preference-setting">
          <span>
            Rest timer<small>Starts after checking a set as done.</small>
          </span>
          <select
            value={preferences.restSeconds}
            onChange={(event) =>
              updatePreferences({ restSeconds: Number(event.target.value) })
            }
          >
            {[0, 30, 60, 90, 120, 180].map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds ? `${seconds} seconds` : "Off"}
              </option>
            ))}
          </select>
        </label>
        <label className="preference-toggle">
          <input
            type="checkbox"
            checked={preferences.haptics}
            onChange={(event) =>
              updatePreferences({ haptics: event.target.checked })
            }
          />
          <span>
            Vibrate when a set is done
            <small>Off by default. Available on supported devices.</small>
          </span>
        </label>
      </section>
      <details className="settings-card settings-disclosure">
        <summary className="session-summary">
          <span>
            <strong>
              <UserRound size={20} /> Account
            </strong>
            <small>
              {user
                ? `${user.email} · ${syncing ? "Syncing…" : dirty ? `${dirty} pending` : "Synced"}`
                : account === "phone"
                  ? "Phone only · saved on this phone"
                  : "Saved on phone · sign in to sync"}
            </small>
          </span>
          <ChevronDown size={18} />
        </summary>
        <div className="stack">
          <p>
            {user
              ? user.email
              : account === "phone"
                ? "Your log is saved on this phone."
                : "Sign in again to sync this account."}
          </p>
          {(user || account !== "phone") && (
            <p className="muted">
              {dirty
                ? `${dirty} changes waiting to sync${!online ? " when you reconnect" : ""}.`
                : "Your local log is up to date."}
            </p>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {user ? (
            <>
              <button
                className="secondary"
                disabled={syncing || !online}
                onClick={() => void sync()}
              >
                <RefreshCw size={18} />
                {syncing ? "Syncing…" : online ? "Sync now" : "Connect to sync"}
              </button>
              <button
                className="text-button"
                disabled={accountBusy}
                onClick={async () => {
                  setAccountBusy(true);
                  try {
                    const phone = await readAccount("phone");
                    await importRecords(Object.values(phone.records));
                    toast.success("Phone workouts copied to this account");
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not copy this phone’s log. Try again.",
                    );
                  } finally {
                    setAccountBusy(false);
                  }
                }}
              >
                Copy this phone's unsigned-in workouts to my account
              </button>
              <button
                className="text-button"
                disabled={accountBusy}
                onClick={async () => {
                  setAccountBusy(true);
                  try {
                    await signOut();
                  } catch {
                    toast.error("Could not sign out. Try again.");
                  } finally {
                    setAccountBusy(false);
                  }
                }}
              >
                <LogOut size={17} />
                Sign out
              </button>
              <button
                className="text-button danger"
                onClick={() => {
                  setConfirmation("");
                  setDeleteError("");
                  setConfirmDelete(true);
                }}
              >
                <Trash2 size={17} /> Delete account
              </button>
            </>
          ) : (
            <Link className="primary" to="/auth">
              Sign in to sync
            </Link>
          )}
          <p className="small-note">
            {user || account !== "phone"
              ? "Sync runs when connected while the app is open, and when you return. Your phone keeps a local copy."
              : "An account is optional. Sign in to sync across devices; your phone-only log stays separate until you choose to copy it."}
          </p>
        </div>
      </details>
      {conflicts.map((r) => (
        <section key={r.id} className="settings-card">
          <h2>Choose which version to keep</h2>
          <p>
            {r.payload.name} changed on another device. Export a backup first to
            keep your local version separately.
          </p>
          <button
            className="secondary"
            onClick={() => void resolve(r.id, false)}
          >
            Use server version
          </button>
          <button
            className="secondary"
            onClick={() => void resolve(r.id, true)}
          >
            Keep this phone's version
          </button>
        </section>
      ))}
      <details className="settings-card settings-disclosure">
        <summary className="session-summary">
          <span>
            <strong>
              <Download size={20} /> Backup & restore
            </strong>
            <small>Export or restore a copy of your log</small>
          </span>
          <ChevronDown size={18} />
        </summary>
        <div className="stack">
          <p className="muted">
            Keep a separate backup before clearing browser data or switching
            phones.
          </p>
          <button className="secondary" onClick={exportData}>
            <Download size={18} />
            Export backup
          </button>
          <label className="file-label">
            {importing ? "Restoring…" : "Restore a Gain Train backup"}
            <input
              type="file"
              accept=".json,application/json"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void restore(file);
              }}
            />
          </label>
        </div>
      </details>
      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!deleting) setConfirmDelete(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all associated workouts,
              routines and exercises from the server and this device. This
              cannot be undone. Export a backup first if you want to keep your
              log. Downloaded backups and offline copies on other devices cannot
              be remotely erased.
            </DialogDescription>
          </DialogHeader>
          <label>
            Type DELETE to confirm
            <input
              value={confirmation}
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {deleteError && (
            <p role="alert" className="error-text">
              {deleteError}
            </p>
          )}
          <button
            className="secondary"
            disabled={deleting}
            onClick={() => setConfirmDelete(false)}
          >
            Keep account
          </button>
          <button
            className="primary delete-account-button"
            disabled={
              deleting || confirmation !== "DELETE" || !navigator.onLine
            }
            onClick={async () => {
              setDeleting(true);
              setDeleteError("");
              try {
                await deleteAccount();
                removeProfileCache(account);
                setConfirmDelete(false);
                toast.success("Account deleted");
              } catch (error) {
                setDeleteError(
                  error instanceof Error
                    ? error.message
                    : "Could not delete account.",
                );
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting…" : "Permanently delete account"}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
