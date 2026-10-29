import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/useAuth";
import { useData } from "@/contexts/useData";
import { useProfile } from "@/contexts/useProfile";
import { useTheme } from "@/contexts/useTheme";
import PageHeader from "@/components/PageHeader";
import ProfileForm from "@/components/ProfileForm";
import ListRow from "@/components/ui/ListRow";
import Sheet from "@/components/ui/Sheet";
import AccountSheet from "@/components/settings/AccountSheet";
import DataSection from "@/components/settings/DataSection";
import DeleteAccountSheet from "@/components/settings/DeleteAccountSheet";
import {
  GoalSheet,
  RestSheet,
  ThemeSheet,
} from "@/components/settings/PreferenceSheets";
import SyncIssues from "@/components/settings/SyncIssues";
import { countLabel } from "@/lib/labels";
import {
  readTrainingPreferences,
  restLabel,
  saveTrainingPreferences,
} from "@/lib/preferences";

type SheetName = "bodyweight" | "goal" | "rest" | "theme" | "account";

export default function Settings() {
  const { user, account, signOut } = useAuth(),
    { state, syncing, error } = useData(),
    { theme } = useTheme(),
    { bodyWeightKg } = useProfile(),
    navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [preferences, setPreferences] = useState(readTrainingPreferences);
  const [accountBusy, setAccountBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = Object.values(state.records).filter((r) => r.dirty).length;
  const updatePreferences = (patch: Partial<typeof preferences>) => {
    saveTrainingPreferences(patch);
    setPreferences(readTrainingPreferences());
  };
  const back = () => {
    // Settings opens from Train and from notices; go back there, or home on a fresh load.
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/");
  };
  const leave = async (failure: string) => {
    setAccountBusy(true);
    try {
      await signOut();
    } catch {
      toast.error(failure);
    } finally {
      setAccountBusy(false);
    }
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
      <SyncIssues />

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

      <DataSection />

      <section>
        <h2 className="group-title">Account</h2>
        {/* Signed out, the account row above is the way in. */}
        {(user || account !== "phone") && (
          <div className="list">
            {user ? (
              <>
                <ListRow
                  title="Sign out"
                  tone="accent"
                  disabled={accountBusy}
                  onClick={() => void leave("Could not sign out. Try again.")}
                />
                <ListRow
                  title="Delete account"
                  tone="danger"
                  onClick={() => setConfirmDelete(true)}
                />
              </>
            ) : (
              <>
                <ListRow title="Sign in again" tone="accent" to="/auth" />
                <ListRow
                  title="Use this phone's own log instead"
                  disabled={accountBusy}
                  onClick={() =>
                    void leave("Could not switch logs. Try again.")
                  }
                />
              </>
            )}
          </div>
        )}
        <p className="small-note group-note">
          {user
            ? "Sync runs when connected while the app is open, and when you return. Your phone keeps a local copy."
            : account !== "phone"
              ? "Your session ended, so this account's log is not syncing. It stays on this phone; sign in again to sync it."
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
      <GoalSheet
        open={sheet === "goal"}
        onClose={closeSheet}
        preferences={preferences}
        onChange={updatePreferences}
      />
      <RestSheet
        open={sheet === "rest"}
        onClose={closeSheet}
        preferences={preferences}
        onChange={updatePreferences}
      />
      <ThemeSheet open={sheet === "theme"} onClose={closeSheet} />
      <AccountSheet
        open={sheet === "account"}
        onClose={closeSheet}
        dirty={dirty}
      />
      <DeleteAccountSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
