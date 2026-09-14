import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ActiveWorkout from "@/pages/ActiveWorkout";
import History from "@/pages/History";
import Auth from "@/pages/Auth";
import Settings from "@/pages/Settings";
import Routines from "@/pages/Routines";
import MyExercises from "@/pages/MyExercises";
import NotFound from "@/pages/NotFound";
const Progress = lazy(() => import("@/pages/Progress"));
function AccountApp() {
  const { account } = useAuth();
  return (
    <DataProvider key={account}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<p className="empty">Opening…</p>}>
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
        </Suspense>
      </BrowserRouter>
    </DataProvider>
  );
}
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AccountApp />
        <Toaster richColors position="top-center" closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}
