import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { readAccount } from "@/data/database";
import { phoneRecordsToCopy } from "@/data/actions";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { isSyncOutage } from "@/lib/sync-health";
import { needsSignInAgain } from "@/lib/auth-account";
import { local, storageKeys, writeStored } from "@/lib/storage";
import { useT } from "@/i18n/useT";

/**
 * The sync, sign-in and conflict notices, as banners under a page's title.
 * Problems show on every page; the plain "saved on this phone" status only
 * where `status` is set (Train).
 */
export default function SyncNotices({ status = false }: { status?: boolean }) {
  const { state, error, syncing, online, syncHealth } = useData();
  const { user, account } = useAuth();
  const { t, locale } = useT();
  const [phoneLogAvailable, setPhoneLogAvailable] = useState(false);
  // The sign-in invitation is closed once per device; Settings keeps the way in.
  const [inviteClosed, setInviteClosed] = useState(
    () => local.getItem(storageKeys.signInBannerDismissed) === "1",
  );
  // Only additions can change whether phone records are missing here, so don't
  // re-read the phone log on every edit.
  const recordCount = Object.keys(state.records).length;
  const records = useRef(state.records);
  records.current = state.records;
  useEffect(() => {
    let active = true;
    if (user)
      void readAccount("phone")
        .then((phone) => {
          if (active)
            setPhoneLogAvailable(
              phoneRecordsToCopy(phone.records, records.current).length > 0,
            );
        })
        .catch(() => {});
    else setPhoneLogAvailable(false);
    return () => {
      active = false;
    };
  }, [user, recordCount]);

  const all = Object.values(state.records);
  const conflicts = all.filter((r) => r.conflict).length;
  const rejected = all.filter((r) => r.syncError).length;
  const dirty = all.filter((r) => r.dirty).length;
  const needsUpdate = Object.keys(state.quarantine ?? {}).length > 0;
  const outage = !!user && online && isSyncOutage(syncHealth);

  const signedOut = needsSignInAgain(account, user);

  const banners: React.ReactNode[] = [];
  if (signedOut)
    banners.push(
      <div className="banner" key="signed-out">
        <span>{t("sync.signedOut")}</span>
        <Link to="/auth">{t("sync.signInAgain")}</Link>
      </div>,
    );
  if (conflicts > 0)
    banners.push(
      <div className="banner" key="conflicts">
        <span>{t("sync.conflicts", { count: conflicts })}</span>
        <Link to="/settings">{t("sync.openSettings")}</Link>
      </div>,
    );
  if (phoneLogAvailable)
    banners.push(
      <div className="banner" key="phone">
        <span>{t("sync.phoneLogReady")}</span>
        <Link to="/settings">{t("sync.openSettings")}</Link>
      </div>,
    );
  if (rejected > 0)
    banners.push(
      <div className="banner" key="rejected">
        <span>{t("sync.rejected", { count: rejected })}</span>
        <Link to="/settings">{t("sync.retryInSettings")}</Link>
      </div>,
    );
  if (needsUpdate)
    banners.push(
      <div className="banner" key="update">
        {t("sync.needsUpdate")}
      </div>,
    );
  if (outage)
    banners.push(
      <div className="banner banner-danger" role="alert" key="outage">
        <span>
          {t("sync.outage", {
            date: new Date(syncHealth.failingSince!).toLocaleDateString(
              locale,
              { day: "numeric", month: "short" },
            ),
          })}
        </span>
        <Link to="/settings">{t("sync.openSettings")}</Link>
      </div>,
    );
  else if (error)
    banners.push(
      <div className="banner banner-danger" role="alert" key="error">
        <span>{error}</span>
        <Link to="/settings">{t("sync.openSettings")}</Link>
      </div>,
    );
  if (status && !syncing) {
    if (!user && !signedOut) {
      if (!inviteClosed)
        banners.push(
          <div className="banner banner-closable" key="status">
            <span>{t("sync.savedOnPhone")}</span>
            <Link to="/auth">{t("sync.signInToSync")}</Link>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("sync.dismissSignIn")}
              onClick={() => {
                // Closed for this visit even if storage refuses to remember it.
                writeStored(storageKeys.signInBannerDismissed, "1");
                setInviteClosed(true);
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>,
        );
    } else if (dirty)
      banners.push(
        <div className="banner" key="status">
          {online ? t("sync.pending", { count: dirty }) : t("sync.offline")}
        </div>,
      );
  }
  if (!banners.length) return null;
  // No live region around the stack: the alerts inside announce themselves,
  // and a wrapping status region would read the whole stack again on any change.
  return <div className="banners">{banners}</div>;
}
