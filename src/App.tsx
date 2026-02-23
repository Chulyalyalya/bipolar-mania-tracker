import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DateProvider } from "@/contexts/DateContext";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ResetPassword from "./pages/ResetPassword";
import PatientHome from "./pages/PatientHome";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import GlobalHeader from "./components/GlobalHeader";
import DateSelector from "./components/DateSelector";
import BottomNav from "./components/BottomNav";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  // Logged in but no role → onboarding
  if (!role) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // Patient layout
  if (role === 'patient') {
    return (
      <>
        <GlobalHeader />
        <DateSelector />
        <main className="min-h-[calc(100vh-120px)]">
          <Routes>
            <Route path="/" element={<PatientHome />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </>
    );
  }

  // Doctor layout (placeholder for now)
  return (
    <>
      <GlobalHeader />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<div className="p-4"><p className="text-sm text-muted-foreground">Панель врача (скоро)</p></div>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DateProvider>
            <AppRoutes />
          </DateProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
