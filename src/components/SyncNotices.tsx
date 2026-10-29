import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { readAccount } from "@/data/database";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { isSyncOutage } from "@/lib/sync-health";
import { needsSignInAgain } from "@/lib/auth-account";

/**
 * The sync, sign-in and conflict notices, as banners under a page's title.
 * Problems show on every page; the plain "saved on this phone" status only
 * where `status` is set (Train).
 */
export default function SyncNotices({ status = false }: { status?: boolean }) {
  const { state, error, syncing, online, syncHealth } = useData();
  const { user, account } = useAuth();
  const [phoneLogAvailable, setPhoneLogAvailable] = useState(false);
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
              Object.values(phone.records).some(
                (r) => !r.deleted && !records.current[r.id],
              ),
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
        <span>
          You were signed out. Your log is still here and syncs once you sign in
          again.
        </span>
        <Link to="/auth">Sign in again</Link>
      </div>,
    );
  if (conflicts > 0)
    banners.push(
      <div className="banner" key="conflicts">
        <span>{conflicts} changes need your choice before syncing</span>
        <Link to="/settings">Open Settings</Link>
      </div>,
    );
  if (phoneLogAvailable)
    banners.push(
      <div className="banner" key="phone">
        <span>Your phone log is ready to copy to this account.</span>
        <Link to="/settings">Open Settings</Link>
      </div>,
    );
  if (rejected > 0)
    banners.push(
      <div className="banner" key="rejected">
        <span>
          {rejected === 1
            ? "1 change couldn't sync."
            : `${rejected} changes couldn't sync.`}
        </span>
        <Link to="/settings">Retry in Settings</Link>
      </div>,
    );
  if (needsUpdate)
    banners.push(
      <div className="banner" key="update">
        Some synced records need a newer version of Gain Train. Close and reopen
        the app to update.
      </div>,
    );
  if (outage)
    banners.push(
      <div className="banner banner-danger" role="alert" key="outage">
        <span>
          The sync server hasn't responded since{" "}
          {new Date(syncHealth.failingSince!).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
          . Your workouts are safe on this phone and upload automatically when
          it's back.
        </span>
        <Link to="/settings">Open Settings</Link>
      </div>,
    );
  else if (error)
    banners.push(
      <div className="banner banner-danger" role="alert" key="error">
        <span>{error}</span>
        <Link to="/settings">Open Settings</Link>
      </div>,
    );
  if (status && !syncing) {
    if (!user && !signedOut)
      banners.push(
        <div className="banner" key="status">
          <span>Saved on this phone.</span>
          <Link to="/auth">Sign in to sync</Link>
        </div>,
      );
    else if (dirty)
      banners.push(
        <div className="banner" key="status">
          {online
            ? `Saved on this phone · ${dirty} pending`
            : "Offline · saved on this phone"}
        </div>,
      );
  }
  if (!banners.length) return null;
  return (
    <div className="banners" role="status">
      {banners}
    </div>
  );
}
