import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useTheme } from "@/contexts/useTheme";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ActiveWorkout from "@/pages/ActiveWorkout";
import NotFound from "@/pages/NotFound";
const History = lazy(() => import("@/pages/History"));
const Auth = lazy(() => import("@/pages/Auth"));
const Settings = lazy(() => import("@/pages/Settings"));
const Routines = lazy(() => import("@/pages/Routines"));
const MyExercises = lazy(() => import("@/pages/MyExercises"));
const Progress = lazy(() => import("@/pages/Progress"));
function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      offset={{
        top: "calc(16px + env(safe-area-inset-top))",
        left: 16,
        right: 16,
      }}
      mobileOffset={{
        top: "calc(16px + env(safe-area-inset-top))",
        left: 16,
        right: 16,
      }}
      closeButton
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
        },
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
              <Route path="routines" element={<Routines />} />
              <Route path="my-exercises" element={<MyExercises />} />
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
    <ThemeProvider>
      <AuthProvider>
        <AccountApp />
        <AppToaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
