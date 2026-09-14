import { useEffect, useState } from "react";
import { readAccount } from "@/data/database";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import {
  Dumbbell,
  History,
  TrendingUp,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
export default function Layout() {
  const { state, error, syncing, online, ready } = useData();
  const { user, account } = useAuth();
  const path = useLocation().pathname;
  const [phoneLogAvailable, setPhoneLogAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    if (user)
      void readAccount("phone")
        .then((phone) => {
          if (active)
            setPhoneLogAvailable(
              Object.values(phone.records).some(
                (r) => !r.deleted && !state.records[r.id],
              ),
            );
        })
        .catch(() => {});
    else setPhoneLogAvailable(false);
    return () => {
      active = false;
    };
  }, [user, state.records]);
  useEffect(() => {
    window.dispatchEvent(new Event("gain-route-change"));
  }, [path]);
  const conflicts = Object.values(state.records).filter(
    (r) => r.conflict,
  ).length;
  const dirty = Object.values(state.records).filter((r) => r.dirty).length;
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <Dumbbell size={23} />
          <span>Gain Train</span>
        </Link>
        <Link to="/settings" className="icon-button" aria-label="Settings">
          <Settings size={21} />
        </Link>
      </header>
      <div className="sync-line" role="status">
        {syncing ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Syncing…
          </>
        ) : !user ? (
          <>
            <CloudOff size={14} />
            {account === "phone" ? "Saved on this phone" : "Offline account"}
            <Link to="/auth">Sign in to sync</Link>
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
      {error && (
        <div className="notice" role="alert">
          {error}
          <Link to="/settings">View sync</Link>
        </div>
      )}
      <main>
        {ready ? (
          <Outlet />
        ) : (
          <p className="empty">Opening your workout log…</p>
        )}
      </main>
      {!path.startsWith("/workout/") && (
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
