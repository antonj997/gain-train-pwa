import { Suspense, useEffect } from "react";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { Outlet, Link, Navigate, useLocation } from "react-router-dom";
import { Dumbbell, History, TrendingUp, Library } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useLegacyPlanImport } from "@/hooks/useLegacyPlanImport";
import ErrorBoundary from "@/components/ErrorBoundary";
import LanguagePrompt from "@/components/LanguagePrompt";
import { useT } from "@/i18n/useT";

const tabs = [
  { to: "/", title: "nav.train", Icon: Dumbbell },
  { to: "/history", title: "nav.history", Icon: History },
  { to: "/progress", title: "nav.progress", Icon: TrendingUp },
  { to: "/library", title: "nav.library", Icon: Library },
] as const;

export default function Layout() {
  useVisualViewport();
  useLegacyPlanImport();
  const { ready } = useData();
  const { passwordRecovery } = useAuth();
  const { t, language } = useT();
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
          // A page that fails to render shows the crash screen in its place;
          // the tab bar stays, and another tab starts afresh. A new language
          // remounts the page, so nothing keeps text built in the old one.
          <ErrorBoundary key={path + ":" + language} scope="page">
            <Suspense
              fallback={
                <p className="empty" role="status">
                  {t("app.opening")}
                </p>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <p className="empty">{t("app.openingLog")}</p>
        )}
      </main>
      {!activeWorkout && (
        <nav className="bottom-nav" aria-label={t("nav.main")}>
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
                <span>{t(tab.title)}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {ready && <LanguagePrompt />}
    </div>
  );
}
