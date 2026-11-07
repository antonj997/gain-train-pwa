import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/useAuth";
import { DataProvider } from "@/contexts/DataContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import Layout from "@/components/Layout";
import SlowMotion from "@/components/SlowMotion";
import Home from "@/pages/Home";
import ActiveWorkout from "@/pages/ActiveWorkout";
import NotFound from "@/pages/NotFound";
const History = lazy(() => import("@/pages/History"));
const Auth = lazy(() => import("@/pages/Auth"));
const Settings = lazy(() => import("@/pages/Settings"));
const Library = lazy(() => import("@/pages/Library"));
const Progress = lazy(() => import("@/pages/Progress"));
const ProgressGoals = lazy(() => import("@/pages/ProgressGoals"));
const LibraryPlan = lazy(() => import("@/pages/LibraryPlan"));
const LibraryShared = lazy(() => import("@/pages/LibraryShared"));
const AdminReports = lazy(() => import("@/pages/AdminReports"));
const Exercise = lazy(() => import("@/pages/Exercise"));
function AccountApp() {
  const { account } = useAuth();
  return (
    <ProfileProvider key={account}>
      <DataProvider>
        <SlowMotion />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="workout/:id" element={<ActiveWorkout />} />
              <Route path="history" element={<History />} />
              <Route path="progress" element={<Progress />} />
              <Route path="progress/goals" element={<ProgressGoals />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/admin" element={<AdminReports />} />
              <Route path="library" element={<Library />} />
              <Route path="library/plan" element={<LibraryPlan />} />
              <Route path="library/shared" element={<LibraryShared />} />
              <Route path="exercise/:id" element={<Exercise />} />
              {/* Old URLs (/routines, ?tab=plan, ?tab=goals …) are
                  redirected in Layout; see src/lib/legacy-routes.ts. */}
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
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
