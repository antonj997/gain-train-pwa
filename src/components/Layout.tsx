import { Suspense, useEffect, useRef, type CSSProperties } from "react";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { Outlet, Link, Navigate, useLocation } from "react-router-dom";
import { Dumbbell, History, TrendingUp, Library } from "lucide-react";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useLegacyPlanImport } from "@/hooks/useLegacyPlanImport";
import ErrorBoundary from "@/components/ErrorBoundary";
import LanguagePrompt from "@/components/LanguagePrompt";
import { useT } from "@/i18n/useT";
import { usePageTransitions } from "@/hooks/usePageTransitions";
import { TAB_PATHS, tabIndex } from "@/lib/page-transition";

// In the order of TAB_PATHS, which sets the slide direction.
const tabs = [
  { title: "nav.train", Icon: Dumbbell },
  { title: "nav.history", Icon: History },
  { title: "nav.progress", Icon: TrendingUp },
  { title: "nav.library", Icon: Library },
] as const;

export default function Layout() {
  useVisualViewport();
  useLegacyPlanImport();
  const { ready } = useData();
  const { passwordRecovery } = useAuth();
  const { t, language } = useT();
  const path = useLocation().pathname;
  const activeWorkout = path.startsWith("/workout/");
  const main = useRef<HTMLElement>(null);
  const { onClickCapture } = usePageTransitions(main);
  const active = tabIndex(path);
  // On Settings no tab is active; the pill fades out where it was.
  const pillAt = useRef(0);
  if (active >= 0) pillAt.current = active;
  useEffect(() => {
    window.dispatchEvent(new Event("gain-route-change"));
  }, [path]);
  if (passwordRecovery && path !== "/auth")
    return <Navigate to="/auth" replace />;
  return (
    <div className="app-shell" onClickCapture={onClickCapture}>
      <main ref={main}>
        {ready ? (
          // A page that fails to render shows the crash screen in its place;
          // the tab bar stays, and another tab starts afresh. A new language
          // remounts the page, so nothing keeps text built in the old one.
          <ErrorBoundary key={path + ":" + language} scope="page">
            <Suspense
              fallback={
                <p className="empty" role="status" data-page-loading="">
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
        <nav
          className={"bottom-nav" + (active >= 0 ? " has-active" : "")}
          aria-label={t("nav.main")}
          style={{ "--nav-index": pillAt.current } as CSSProperties}
        >
          <div className="bottom-nav-track">
            <span className="nav-pill" aria-hidden="true" />
            {tabs.map((tab, index) => {
              const current = index === active;
              const label = t(tab.title);
              return (
                <Link
                  key={tab.title}
                  to={TAB_PATHS[index]}
                  className={"nav-tab" + (current ? " is-active" : "")}
                  aria-label={label}
                  aria-current={current ? "page" : undefined}
                >
                  <tab.Icon size={22} aria-hidden="true" />
                  <span className="nav-tab-label" aria-hidden="true">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      {ready && <LanguagePrompt />}
    </div>
  );
}
