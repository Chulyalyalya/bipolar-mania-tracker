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
import GlobalHeader from "./components/GlobalHeader";
import DateSelector from "./components/DateSelector";
import BottomNav from "./components/BottomNav";

const queryClient = new QueryClient();

const RedirectWithTrace = ({ to, source }: { to: string; source: string }) => {
  const location = useLocation();
  console.log("REDIRECT TARGET", to);
  console.log("REDIRECT SOURCE", { source, from: location.pathname });
  return <Navigate to={to} replace />;
};

const AppRoutes = () => {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  const hasSession = !!session;

  if (!loading) {
    console.log("BOOTSTRAP AUTH CHECK", {
      session: hasSession,
      role,
      pathname: window.location.pathname,
    });
    console.log("ROUTE DECISION:", { hasSession, role, currentPath: location.pathname });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<RedirectWithTrace to="/auth" source="AppRoutes:no_session_root" />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<RedirectWithTrace to="/auth" source="AppRoutes:no_session_fallback" />} />
      </Routes>
    );
  }

  if (role !== "patient" && role !== "doctor") {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<RedirectWithTrace to="/auth" source="AppRoutes:invalid_role_fallback" />} />
      </Routes>
    );
  }

  if (role === "patient") {
    return (
      <>
        <GlobalHeader />
        <DateSelector />
        <main className="relative isolate min-h-[calc(100vh-120px)]">
          <Routes>
            <Route path="/" element={<RedirectWithTrace to="/dashboard" source="AppRoutes:patient_root" />} />
            <Route path="/dashboard" element={<PatientHome />} />
            <Route path="/block/:blockId" element={<BlockDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth" element={<RedirectWithTrace to="/dashboard" source="AppRoutes:patient_auth_path" />} />
            <Route path="*" element={<RedirectWithTrace to="/dashboard" source="AppRoutes:patient_fallback" />} />
          </Routes>
        </main>
        <BottomNav />
        <DoctorLinkModal />
      </>
    );
  }

  return (
    <>
      <GlobalHeader />
      <DateSelector />
      <main className="relative isolate min-h-[calc(100vh-120px)]">
        <Routes>
          <Route path="/" element={<RedirectWithTrace to="/doctor" source="AppRoutes:doctor_root" />} />
          <Route path="/doctor" element={<DoctorHome />} />
          <Route path="/patient/:patientId" element={<PatientDetailDoctor />} />
          <Route path="/patient/:patientId/block/:blockId" element={<BlockDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/auth" element={<RedirectWithTrace to="/doctor" source="AppRoutes:doctor_auth_path" />} />
          <Route path="*" element={<RedirectWithTrace to="/doctor" source="AppRoutes:doctor_fallback" />} />
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

