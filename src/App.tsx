import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DateProvider } from "@/contexts/DateContext";
import Auth from "./pages/Auth";
import DoctorLinkModal from "./components/DoctorLinkModal";
import ResetPassword from "./pages/ResetPassword";
import PatientHome from "./pages/PatientHome";
import BlockDetail from "./pages/BlockDetail";
import DoctorHome from "./pages/DoctorHome";
import PatientDetailDoctor from "./pages/PatientDetailDoctor";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import GlobalHeader from "./components/GlobalHeader";
import DateSelector from "./components/DateSelector";
import BottomNav from "./components/BottomNav";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  const hasSession = !!session;
  console.log("ROUTE DECISION:", { hasSession, role, currentPath: location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  // Authenticated but role not yet resolved — brief wait, never infinite
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Настройка профиля…</p>
      </div>
    );
  }

  // Patient layout
  if (role === 'patient') {
    return (
      <>
        <GlobalHeader />
        <DateSelector />
        <main className="relative isolate min-h-[calc(100vh-120px)]">
          <Routes>
            <Route path="/dashboard" element={<PatientHome />} />
            <Route path="/block/:blockId" element={<BlockDetail />} />
            <Route path="/settings" element={<Settings />} />
            {/* Redirect root and any unknown path to /dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <BottomNav />
        <DoctorLinkModal />
      </>
    );
  }

  // Doctor layout
  return (
    <>
      <GlobalHeader />
      <DateSelector />
      <main className="relative isolate min-h-[calc(100vh-120px)]">
        <Routes>
          <Route path="/doctor" element={<DoctorHome />} />
          <Route path="/patient/:patientId" element={<PatientDetailDoctor />} />
          <Route path="/patient/:patientId/block/:blockId" element={<BlockDetail />} />
          <Route path="/settings" element={<Settings />} />
          {/* Redirect root and any unknown path to /doctor */}
          <Route path="/" element={<Navigate to="/doctor" replace />} />
          <Route path="/auth" element={<Navigate to="/doctor" replace />} />
          <Route path="*" element={<Navigate to="/doctor" replace />} />
        </Routes>
      </main>
      <BottomNav />
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
