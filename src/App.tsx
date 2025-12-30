import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import ActiveWorkout from "./pages/ActiveWorkout";
import History from "./pages/History";
import Progress from "./pages/Progress";
import MyExercises from "./pages/MyExercises";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

const queryClient = new QueryClient();

const StatusBarManager = () => {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const updateStatusBar = () => {
        const isDark = document.documentElement.classList.contains('dark');
        StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
        StatusBar.setBackgroundColor({ 
          color: isDark ? '#0a0a0f' : '#ffffff' 
        });
      };

      updateStatusBar();
      
      const observer = new MutationObserver(updateStatusBar);
      observer.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: ['class'] 
      });

      return () => observer.disconnect();
    }
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <StatusBarManager />
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Layout><Home /></Layout>} />
              <Route path="/workout/:templateId" element={<Layout><ActiveWorkout /></Layout>} />
              <Route path="/history" element={<Layout><History /></Layout>} />
              <Route path="/progress" element={<Layout><Progress /></Layout>} />
              <Route path="/my-exercises" element={<Layout><MyExercises /></Layout>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
