import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import { useTheme } from "@/contexts/useTheme";
import PageHeader from "@/components/PageHeader";
import ProfileForm from "@/components/ProfileForm";
import ListRow from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import Switch from "@/components/ui/Switch";
import { removeProfileCache } from "@/lib/profile";
import { readAccount } from "@/data/database";
import { requestPersistentStorage } from "@/lib/persistence";
import { recordLabel, type RecordDoc } from "@/data/model";
import { countLabel } from "@/lib/labels";
import {
  readTrainingPreferences,
  saveTrainingPreferences,
} from "@/lib/preferences";

type SheetName = "bodyweight" | "goal" | "rest" | "theme" | "account";

const REST_OPTIONS = [0, 30, 60, 90, 120, 180];
/** Rest time as shown on the row: "Off", "0:30", "2:00". */
const restLabel = (seconds: number) =>
  seconds
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
    : "Off";

export default function Settings() {
  const { user, account, signOut, deleteAccount } = useAuth(),
    {
      state,
      sync,
      syncing,
      online,
      error,
      syncHealth,
      resolve,
      retryRejected,
      importRecords,
    } = useData(),
    { theme, toggleTheme } = useTheme(),
    { bodyWeightKg } = useProfile(),
    navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [importing, setImporting] = useState(false);
  const [preferences, setPreferences] = useState(readTrainingPreferences);
  const [accountBusy, setAccountBusy] = useState(false);
  const [protectedStorage, setProtectedStorage] = useState<boolean | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [deleteError, setDeleteError] = useState("");
  const conflicts = Object.values(state.records).filter((r) => r.conflict);
  const rejected = Object.values(state.records).filter((r) => r.syncError);
  const parked = Object.keys(state.quarantine ?? {}).length;
  const dirty = Object.values(state.records).filter((r) => r.dirty).length;
  useEffect(() => {
    let active = true;
    void (
      globalThis.navigator?.storage?.persisted?.() ?? Promise.resolve(false)
    )
      .then((value) => active && setProtectedStorage(value))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const choose = async (id: string, mine: boolean) => {
    try {
      await resolve(id, mine);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save your choice."));
    }
  };
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
      toast.error(errorMessage(e, "Could not restore backup"));
    } finally {
      setImporting(false);
    }
  };
  const keepOnDevice = async () => {
    try {
      const ok = await requestPersistentStorage();
      setProtectedStorage(ok);
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
  };
  const back = () => {
    // Settings opens from Train and from notices; go back there, or home on a fresh load.
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/");
  };
  const syncStatus = user
    ? syncing
      ? "Signed in · syncing…"
      : dirty
        ? `Signed in · ${dirty} pending`
        : "Signed in · synced"
    : account === "phone"
      ? "Saved on this phone · sign in to sync"
      : "Saved on this phone · sign in again to sync";
  const goal = preferences.weeklyGoal;
  const closeSheet = () => setSheet(null);

  return (
    <div className="page settings-page">
      <PageHeader
        title="Settings"
        notices={false}
        leading={
          <button
            type="button"
            className="icon-btn"
            aria-label="Back"
            onClick={back}
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        }
      />
      {error && (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      )}
      {parked > 0 && (
        <div className="banner">
          {parked === 1
            ? "1 synced record needs"
            : `${parked} synced records need`}{" "}
          a newer version of Gain Train. Close and reopen the app to update;
          they appear once it can read them.
        </div>
      )}
      {rejected.length > 0 && (
        <section className="card col-12">
          <h2 className="card-title">Changes the server didn't accept</h2>
          <p className="row-sub">
            These stay saved on this phone. Editing one sends it again; Retry
            sends them all, for example after an app update.
          </p>
          <ul className="sync-rejections">
            {rejected.map((r) => (
              <li key={r.id}>
                <strong>{recordLabel(r)}</strong>
                <small>{r.syncError}</small>
              </li>
            ))}
          </ul>
          <button
            className="btn-secondary"
            disabled={!online}
            onClick={async () => {
              try {
                await retryRejected();
                void sync();
              } catch (error) {
                toast.error(errorMessage(error, "Could not retry."));
              }
            }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            Retry
          </button>
        </section>
      )}
      {conflicts.map((r) => (
        <section key={r.id} className="card col-12">
          <h2 className="card-title">Choose which version to keep</h2>
          <p className="row-sub">
            {recordLabel(r)} changed on another device. Export a backup first to
            keep your local version separately.
          </p>
          <button
            className="btn-secondary"
            onClick={() => void choose(r.id, false)}
          >
            Use server version
          </button>
          <button
            className="btn-secondary"
            onClick={() => void choose(r.id, true)}
          >
            Keep this phone's version
          </button>
        </section>
      ))}

      <div className="list">
        <ListRow
          className="account-row"
          leading={
            <span className="avatar" aria-hidden="true">
              {(user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          }
          title={user?.email ?? "Not signed in"}
          sub={
            <span className="status-line">
              <span
                className={"status-dot" + (user && !dirty ? " ok" : "")}
                aria-hidden="true"
              />
              {syncStatus}
            </span>
          }
          chevron
          {...(user ? { onClick: () => setSheet("account") } : { to: "/auth" })}
        />
      </div>

      <section>
        <h2 className="group-title">Training</h2>
        <div className="list">
          <ListRow
            title="Bodyweight"
            value={bodyWeightKg === null ? "Not set" : `${bodyWeightKg} kg`}
            chevron
            onClick={() => setSheet("bodyweight")}
          />
          <ListRow
            title="Weekly goal"
            value={goal === null ? "Off" : countLabel(goal, "workout")}
            chevron
            onClick={() => setSheet("goal")}
          />
          <ListRow
            title="Rest timer"
            value={restLabel(preferences.restSeconds)}
            chevron
            onClick={() => setSheet("rest")}
          />
          <ListRow
            title="Theme"
            value={theme === "dark" ? "Dark" : "Light"}
            chevron
            onClick={() => setSheet("theme")}
          />
        </div>
      </section>

      <section>
        <h2 className="group-title">Your data</h2>
        <div className="list">
          <ListRow title="Export a backup" chevron onClick={exportData} />
          <label className="row row-file">
            <span className="row-main">
              <span className="row-title">
                {importing ? "Restoring…" : "Restore a backup"}
              </span>
            </span>
            <ChevronRight className="chev" size={20} aria-hidden="true" />
            <input
              className="sr-only"
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
          <ListRow
            title="Storage on this device"
            onClick={() => void keepOnDevice()}
            trailing={
              protectedStorage === null ? undefined : (
                <span
                  className={
                    "stat-chip " + (protectedStorage ? "done" : "warm")
                  }
                >
                  {protectedStorage ? "Protected" : "Not protected"}
                </span>
              )
            }
          />
        </div>
      </section>

      <section>
        <h2 className="group-title">Account</h2>
        <div className="list">
          {user ? (
            <>
              <ListRow
                title="Sign out"
                tone="accent"
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
              />
              <ListRow
                title="Delete account"
                tone="danger"
                onClick={() => {
                  setConfirmation("");
                  setDeleteError("");
                  setConfirmDelete(true);
                }}
              />
            </>
          ) : (
            <ListRow title="Sign in to sync" tone="accent" to="/auth" />
          )}
        </div>
        <p className="small-note group-note">
          {user || account !== "phone"
            ? "Sync runs when connected while the app is open, and when you return. Your phone keeps a local copy."
            : "An account is optional. Sign in to sync across devices; your phone-only log stays separate until you choose to copy it."}
        </p>
      </section>

      <Sheet
        open={sheet === "bodyweight"}
        onClose={closeSheet}
        title="Bodyweight"
      >
        <ProfileForm />
      </Sheet>

      <Sheet
        open={sheet === "goal"}
        onClose={closeSheet}
        title="Weekly goal"
        description="How many workouts you aim for each week, Monday to Sunday."
      >
        <Switch
          label="Set a weekly goal"
          checked={goal !== null}
          onChange={(on) => updatePreferences({ weeklyGoal: on ? 3 : null })}
        />
        {goal !== null && (
          <div className="stepper">
            <button
              type="button"
              className="icon-btn filled"
              aria-label="One fewer workout"
              disabled={goal <= 1}
              onClick={() => updatePreferences({ weeklyGoal: goal - 1 })}
            >
              <Minus size={20} aria-hidden="true" />
            </button>
            <output aria-live="polite">
              <strong>{goal}</strong> {goal === 1 ? "workout" : "workouts"} a
              week
            </output>
            <button
              type="button"
              className="icon-btn filled"
              aria-label="One more workout"
              disabled={goal >= 14}
              onClick={() => updatePreferences({ weeklyGoal: goal + 1 })}
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        <button className="btn-primary" onClick={closeSheet}>
          Done
        </button>
      </Sheet>

      <Sheet
        open={sheet === "rest"}
        onClose={closeSheet}
        title="Rest timer"
        description="Starts after checking a set as done."
      >
        <Segmented
          label="Rest time"
          value={String(preferences.restSeconds)}
          options={REST_OPTIONS.map((seconds) => ({
            value: String(seconds),
            label: restLabel(seconds),
          }))}
          onChange={(value) =>
            updatePreferences({ restSeconds: Number(value) })
          }
        />
        <Switch
          label="Vibrate when a set is done"
          checked={preferences.haptics}
          onChange={(haptics) => updatePreferences({ haptics })}
        />
        <p className="small-note">
          Vibration is off by default and works on supported devices.
        </p>
      </Sheet>

      <Sheet open={sheet === "theme"} onClose={closeSheet} title="Theme">
        <div className="theme-setting">
          <p>{theme === "dark" ? "Dark" : "Light"}</p>
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
      </Sheet>

      <Sheet
        open={sheet === "account"}
        onClose={closeSheet}
        title="Account"
        description={user?.email}
      >
        <p className="row-sub">
          {dirty
            ? `${dirty} changes waiting to sync${!online ? " when you reconnect" : ""}.`
            : "Your local log is up to date."}
          {syncHealth.lastSyncedAt &&
            ` Last synced ${new Date(syncHealth.lastSyncedAt).toLocaleString(
              undefined,
              {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              },
            )}.`}
        </p>
        <button
          className="btn-secondary"
          disabled={syncing || !online}
          onClick={() => void sync()}
        >
          <RefreshCw size={18} aria-hidden="true" />
          {syncing ? "Syncing…" : online ? "Sync now" : "Connect to sync"}
        </button>
        <button
          className="btn-quiet"
          disabled={accountBusy}
          onClick={async () => {
            setAccountBusy(true);
            try {
              const phone = await readAccount("phone");
              await importRecords(Object.values(phone.records));
              toast.success("Phone workouts copied to this account");
            } catch (error) {
              toast.error(
                errorMessage(
                  error,
                  "Could not copy this phone’s log. Try again.",
                ),
              );
            } finally {
              setAccountBusy(false);
            }
          }}
        >
          Copy this phone's unsigned-in workouts to my account
        </button>
      </Sheet>

      <Sheet
        open={confirmDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        title="Delete your account?"
        description="This permanently deletes your account and all associated workouts, routines and exercises from the server and this device. This cannot be undone. Export a backup first if you want to keep your log. Downloaded backups and offline copies on other devices cannot be remotely erased."
      >
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
          className="btn-secondary"
          disabled={deleting}
          onClick={() => setConfirmDelete(false)}
        >
          Keep account
        </button>
        <button
          className="btn-danger"
          disabled={deleting || confirmation !== "DELETE" || !navigator.onLine}
          onClick={async () => {
            setDeleting(true);
            setDeleteError("");
            try {
              await deleteAccount();
              removeProfileCache(account);
              setConfirmDelete(false);
              toast.success("Account deleted");
            } catch (error) {
              setDeleteError(errorMessage(error, "Could not delete account."));
            } finally {
              setDeleting(false);
            }
          }}
        >
          {deleting ? "Deleting…" : "Permanently delete account"}
        </button>
      </Sheet>
    </div>
  );
}
