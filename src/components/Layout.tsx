import { Suspense, useEffect, useRef, useState } from "react";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { readAccount } from "@/data/database";
import { Outlet, NavLink, Link, Navigate, useLocation } from "react-router-dom";
import {
  Dumbbell,
  History,
  TrendingUp,
  Settings,
  X,
  Cloud,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { isSyncOutage } from "@/lib/sync-health";
export default function Layout() {
  useVisualViewport();
  const { state, error, syncing, online, ready, syncHealth } = useData();
  const { user, account, passwordRecovery } = useAuth();
  const path = useLocation().pathname;
  const activeWorkout = path.startsWith("/workout/");
  const returnPath = useRef("/");
  useEffect(() => {
    if (path !== "/settings") returnPath.current = path;
  }, [path]);
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
  useEffect(() => {
    window.dispatchEvent(new Event("gain-route-change"));
  }, [path]);
  const all = Object.values(state.records);
  const conflicts = all.filter((r) => r.conflict).length;
  const rejected = all.filter((r) => r.syncError).length;
  const dirty = all.filter((r) => r.dirty).length;
  const needsUpdate = Object.keys(state.quarantine ?? {}).length > 0;
  const outage = !!user && online && isSyncOutage(syncHealth);
  if (passwordRecovery && path !== "/auth")
    return <Navigate to="/auth" replace />;
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <Dumbbell size={23} />
          <span>Gain Train</span>
        </Link>
        <Link
          to={path === "/settings" ? returnPath.current : "/settings"}
          className="icon-button"
          aria-label={path === "/settings" ? "Close settings" : "Settings"}
        >
          {path === "/settings" ? <X size={21} /> : <Settings size={21} />}
        </Link>
      </header>
      <div
        className={"sync-line" + (activeWorkout ? " workout-sync-line" : "")}
        role="status"
      >
        {syncing ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Syncing…
          </>
        ) : !user ? (
          <>
            <CloudOff size={14} />
            {account === "phone"
              ? "Saved on this phone"
              : "Saved on phone · sign in to sync"}
            {!activeWorkout && <Link to="/auth">Sign in to sync</Link>}
          </>
        ) : dirty ? (
          <>
            <CloudOff size={14} />
            {online
              ? "Saved on phone · " + dirty + " pending"
              : "Offline · saved on phone"}
          </>
        ) : (
          <>
            <Cloud size={14} />
            Synced
          </>
        )}
      </div>
      {conflicts > 0 && (
        <div className="notice">
          <Link to="/settings">
            {conflicts} changes need your choice before syncing
          </Link>
        </div>
      )}
      {phoneLogAvailable && (
        <div className="notice">
          <Link to="/settings">
            Your phone log is ready to copy to this account. Open Settings.
          </Link>
        </div>
      )}
      {rejected > 0 && (
        <div className="notice">
          <Link to="/settings">
            {rejected === 1
              ? "1 change couldn't sync. Open Settings to retry."
              : `${rejected} changes couldn't sync. Open Settings to retry.`}
          </Link>
        </div>
      )}
      {needsUpdate && (
        <div className="notice">
          Some synced records need a newer version of Gain Train. Close and
          reopen the app to update.
        </div>
      )}
      {outage ? (
        <div className="notice" role="alert">
          The sync server hasn't responded since{" "}
          {new Date(syncHealth.failingSince!).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
          . Your workouts are safe on this phone and upload automatically when
          it's back.
          <Link to="/settings">Open settings</Link>
        </div>
      ) : (
        error && (
          <div className="notice" role="alert">
            {error}
            <Link to="/settings">Open settings</Link>
          </div>
        )
      )}
      <main>
        {ready ? (
          <Suspense
            fallback={
              <p className="empty" role="status">
                Opening…
              </p>
            }
          >
            <Outlet />
          </Suspense>
        ) : (
          <p className="empty">Opening your workout log…</p>
        )}
      </main>
      {!activeWorkout && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {[
            { to: "/", title: "Workout", Icon: Dumbbell },
            { to: "/history", title: "History", Icon: History },
            { to: "/progress", title: "Progress", Icon: TrendingUp },
          ].map(({ to, title, Icon }) => (
            <NavLink key={to} to={to} end>
              <Icon size={21} />
              <span>{title}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
