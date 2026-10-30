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
import NameSheet from "@/components/settings/NameSheet";
import { useDisplayName } from "@/hooks/useDisplayName";
import {
  GoalSheet,
  RestSheet,
  LanguageSheet,
  ThemeSheet,
} from "@/components/settings/PreferenceSheets";
import SyncIssues from "@/components/settings/SyncIssues";
import { LANGUAGE_NAMES, formatDecimal } from "@/i18n";
import { useT } from "@/i18n/useT";
import { countLabel } from "@/lib/labels";
import {
  readTrainingPreferences,
  restLabel,
  saveTrainingPreferences,
} from "@/lib/preferences";

type SheetName =
  "bodyweight" | "goal" | "rest" | "theme" | "language" | "account" | "name";

export default function Settings() {
  const { user, account, signOut } = useAuth(),
    { state, syncing, error } = useData(),
    { theme } = useTheme(),
    { bodyWeightKg } = useProfile(),
    navigate = useNavigate(),
    { t, language } = useT(),
    displayName = useDisplayName();
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
      ? t("settings.signedInSyncing")
      : dirty
        ? t("settings.signedInPending", { count: dirty })
        : t("settings.signedInSynced")
    : account === "phone"
      ? t("settings.phoneSignIn")
      : t("settings.phoneSignInAgain");
  const goal = preferences.weeklyGoal;
  const closeSheet = () => setSheet(null);

  return (
    <div className="page settings-page">
      <PageHeader
        title={t("settings.title")}
        notices={false}
        leading={
          <button
            type="button"
            className="icon-btn"
            aria-label={t("common.back")}
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
              {(displayName.name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          }
          title={displayName.name ?? user?.email ?? t("settings.notSignedIn")}
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
        <h2 className="group-title">{t("settings.training")}</h2>
        <div className="list">
          <ListRow
            title={t("settings.bodyweight")}
            value={
              bodyWeightKg === null
                ? t("settings.notSet")
                : t("common.kg", { value: formatDecimal(bodyWeightKg) })
            }
            chevron
            onClick={() => setSheet("bodyweight")}
          />
          <ListRow
            title={t("settings.weeklyGoal")}
            value={
              goal === null ? t("common.off") : countLabel(goal, "workout")
            }
            chevron
            onClick={() => setSheet("goal")}
          />
          <ListRow
            title={t("settings.restTimer")}
            value={restLabel(preferences.restSeconds)}
            chevron
            onClick={() => setSheet("rest")}
          />
          <ListRow
            title={t("settings.theme")}
            value={theme === "dark" ? t("settings.dark") : t("settings.light")}
            chevron
            onClick={() => setSheet("theme")}
          />
          <ListRow
            title={t("language.title")}
            value={LANGUAGE_NAMES[language]}
            chevron
            onClick={() => setSheet("language")}
          />
        </div>
      </section>

      <DataSection />

      <section>
        <h2 className="group-title">{t("settings.account")}</h2>
        {/* Signed out, the account row above is the way in. */}
        {(user || account !== "phone") && (
          <div className="list">
            {user ? (
              <>
                {displayName.available && (
                  <ListRow
                    title={t("settings.name")}
                    sub={t("settings.nameNote")}
                    value={displayName.name ?? t("settings.notSet")}
                    chevron
                    onClick={() => setSheet("name")}
                  />
                )}
                <ListRow
                  title={t("settings.signOut")}
                  tone="accent"
                  disabled={accountBusy}
                  onClick={() => void leave(t("settings.signOutFailed"))}
                />
                <ListRow
                  title={t("settings.deleteAccount")}
                  tone="danger"
                  onClick={() => setConfirmDelete(true)}
                />
              </>
            ) : (
              <>
                <ListRow
                  title={t("settings.signInAgain")}
                  tone="accent"
                  to="/auth"
                />
                <ListRow
                  title={t("settings.usePhoneLog")}
                  disabled={accountBusy}
                  onClick={() => void leave(t("settings.switchFailed"))}
                />
              </>
            )}
          </div>
        )}
        <p className="small-note group-note">
          {user
            ? t("settings.noteSignedIn")
            : account !== "phone"
              ? t("settings.noteSessionEnded")
              : t("settings.notePhone")}
        </p>
      </section>

      <Sheet
        open={sheet === "bodyweight"}
        onClose={closeSheet}
        title={t("settings.bodyweight")}
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
      <LanguageSheet open={sheet === "language"} onClose={closeSheet} />
      <AccountSheet
        open={sheet === "account"}
        onClose={closeSheet}
        dirty={dirty}
      />
      <NameSheet
        open={sheet === "name"}
        onClose={closeSheet}
        name={displayName.name}
        status={displayName.status}
        online={displayName.online}
        onSave={displayName.save}
      />
      <DeleteAccountSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
