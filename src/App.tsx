import { lazy, type CSSProperties } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/useAuth";
import { DataProvider } from "@/contexts/DataContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useTheme } from "@/contexts/useTheme";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ActiveWorkout from "@/pages/ActiveWorkout";
import NotFound from "@/pages/NotFound";
const History = lazy(() => import("@/pages/History"));
const Auth = lazy(() => import("@/pages/Auth"));
const Settings = lazy(() => import("@/pages/Settings"));
const Library = lazy(() => import("@/pages/Library"));
const Progress = lazy(() => import("@/pages/Progress"));
function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      // At the top and phone-wide, but below the page's header or the
      // workout's top bar (--toast-top in usability.css), so Back, Save and
      // the title stay in reach; two at most, the newest in front.
      position="top-center"
      offset={{ top: "var(--toast-top)", left: 16, right: 16 }}
      mobileOffset={{ top: "var(--toast-top)", left: 16, right: 16 }}
      visibleToasts={2}
      closeButton
      toastOptions={{
        // Inverted against the page, so a toast never melts into the
        // cards behind it in either theme.
        style: {
          "--normal-bg": "var(--gt-ink)",
          "--normal-text": "var(--gt-ground)",
          "--normal-border": "var(--gt-ink)",
          background: "var(--gt-ink)",
          color: "var(--gt-ground)",
          border: "1px solid var(--gt-ink)",
          boxShadow: "var(--gt-shadow-chip)",
          fontWeight: 600,
        } as CSSProperties,
      }}
    />
  );
}
function AccountApp() {
  const { account } = useAuth();
  return (
    <ProfileProvider key={account}>
      <DataProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="workout/:id" element={<ActiveWorkout />} />
              <Route path="history" element={<History />} />
              <Route path="progress" element={<Progress />} />
              <Route path="settings" element={<Settings />} />
              <Route path="library" element={<Library />} />
              <Route
                path="library/plan"
                element={<Navigate to="/library?tab=plan" replace />}
              />
              <Route
                path="routines"
                element={<Navigate to="/library" replace />}
              />
              <Route
                path="my-exercises"
                element={<Navigate to="/library?tab=exercises" replace />}
              />
              <Route path="auth" element={<Auth />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </ProfileProvider>
  );
}
export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <AccountApp />
          <AppToaster />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
