import { Suspense, useEffect, useRef } from "react";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useData } from "@/contexts/useData";
import { useAuth } from "@/contexts/useAuth";
import { useLegacyPlanImport } from "@/hooks/useLegacyPlanImport";
import ErrorBoundary from "@/components/ErrorBoundary";
import LanguagePrompt from "@/components/LanguagePrompt";
import Tips from "@/components/Tips";
import BottomNav from "@/components/BottomNav";
import { useT } from "@/i18n/useT";
import { usePageTransitions } from "@/hooks/usePageTransitions";
import { tabIndex } from "@/lib/page-transition";
import { legacyRedirect } from "@/lib/legacy-routes";

export default function Layout() {
  useVisualViewport();
  useLegacyPlanImport();
  const { ready } = useData();
  const { passwordRecovery } = useAuth();
  const { t, language } = useT();
  const location = useLocation();
  const path = location.pathname;
  const moved = legacyRedirect(path, location.search);
  const activeWorkout = path.startsWith("/workout/");
  const main = useRef<HTMLElement>(null);
  const { onClickCapture } = usePageTransitions(main);
  const active = tabIndex(path);
  // On Settings no tab is active; the pill fades out where it was. A tab's
  // subscreens (Goals, Plan, Shared routines) keep their tab lit.
  const pillAt = useRef(0);
  if (active >= 0) pillAt.current = active;
  useEffect(() => {
    window.dispatchEvent(new Event("gain-route-change"));
  }, [path]);
  if (passwordRecovery && path !== "/auth")
    return <Navigate to="/auth" replace />;
  // Old links (?tab=plan, ?tab=goals, /routines …) go where the screen is now.
  if (moved) return <Navigate to={moved + location.hash} replace />;
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
      {!activeWorkout && <BottomNav active={active} pillAt={pillAt.current} />}
      {ready && <LanguagePrompt />}
      {ready && <Tips />}
    </div>
  );
}
