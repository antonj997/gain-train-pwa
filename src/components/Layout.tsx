import { Suspense, useEffect } from "react";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { Outlet, Link, Navigate, useLocation } from "react-router-dom";
import { Dumbbell, History, TrendingUp, Library } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";

const tabs = [
  { to: "/", title: "Train", Icon: Dumbbell },
  { to: "/history", title: "History", Icon: History },
  { to: "/progress", title: "Progress", Icon: TrendingUp },
  { to: "/library", title: "Library", Icon: Library },
];

export default function Layout() {
  useVisualViewport();
  const { ready } = useData();
  const { passwordRecovery } = useAuth();
  const path = useLocation().pathname;
  const activeWorkout = path.startsWith("/workout/");
  useEffect(() => {
    window.dispatchEvent(new Event("gain-route-change"));
  }, [path]);
  if (passwordRecovery && path !== "/auth")
    return <Navigate to="/auth" replace />;
  const isActive = (tab: (typeof tabs)[number]) =>
    tab.to === "/"
      ? path === "/"
      : path === tab.to || path.startsWith(tab.to + "/");
  return (
    <div className="app-shell">
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
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                <tab.Icon size={22} aria-hidden="true" />
                <span>{tab.title}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
