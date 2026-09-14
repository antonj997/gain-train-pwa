import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, Cloud, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useTheme } from "@/contexts/ThemeContext";
import { readAccount } from "@/data/database";
import { type RecordDoc } from "@/data/model";
export default function Settings() {
  const { user, account, signOut } = useAuth(),
    { state, sync, syncing, error, resolve, importRecords } = useData(),
    { theme, toggleTheme } = useTheme();
  const [importing, setImporting] = useState(false);
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
        <h2>
          <Cloud size={20} />
          Cloud sync
        </h2>
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
      </section>
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
      <section className="settings-card">
        <h2>Backup & restore</h2>
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
      </section>
      <section className="settings-card">
        <h2>Your preferences</h2>
        <button className="secondary" onClick={toggleTheme}>
          Use {theme === "dark" ? "light" : "dark"} appearance
        </button>
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
    </div>
  );
}
