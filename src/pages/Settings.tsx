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
import { useTheme } from "@/contexts/ThemeContext";
import { readAccount } from "@/data/database";
import { type RecordDoc } from "@/data/model";
export default function Settings() {
  const { user, account, signOut, deleteAccount } = useAuth(),
    { state, sync, syncing, error, resolve, importRecords } = useData(),
    { theme, toggleTheme } = useTheme();
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [deleteError, setDeleteError] = useState("");
  const conflicts = Object.values(state.records).filter((r) => r.conflict);
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
    <div className="stack">
      <h1>Settings</h1>
      <section className="settings-card">
        <div className="theme-setting">
          <div>
            <h2>Appearance</h2>
            <p className="small-note">
              {theme === "dark" ? "Moonlight" : "Daylight"}
            </p>
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
            const ok = await navigator.storage?.persist?.();
            toast(
              ok
                ? "Persistent storage enabled"
                : "Your browser manages storage automatically. Keep a backup too.",
            );
          }}
        >
          Keep data on this device
        </button>
      </section>
      <details className="settings-card settings-disclosure">
        <summary className="session-summary">
          <span>
            <strong>
              <UserRound size={20} /> Account
            </strong>
            <small>
              {user?.email || "Not signed in"} ·{" "}
              {Object.values(state.records).filter((r) => r.dirty).length
                ? "Changes waiting to sync"
                : "Saved"}
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
          <p className="muted">
            {Object.values(state.records).filter((r) => r.dirty).length} changes
            waiting to sync.
          </p>
          {error && <p className="error-text">{error}</p>}
          {user ? (
            <>
              <button
                className="secondary"
                disabled={syncing}
                onClick={() => void sync()}
              >
                <RefreshCw size={18} />
                Sync now
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  const phone = await readAccount("phone");
                  await importRecords(Object.values(phone.records));
                  toast.success("Phone workouts copied to this account");
                }}
              >
                Copy this phone's unsigned-in workouts to my account
              </button>
              <button className="text-button" onClick={() => void signOut()}>
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
            Sync runs when connected while the app is open, and when you return.
            Your phone keeps a local copy.
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
              onChange={(e) => void restore(e.target.files?.[0])}
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
