import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "@/pages/Index";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

import LoginEleve from "@/pages/auth/LoginEleve";
import LoginFormateur from "@/pages/auth/LoginFormateur";
import LoginAdmin from "@/pages/auth/LoginAdmin";

import FormateurLayout from "@/layouts/FormateurLayout";
import FormateurDashboard from "@/pages/formateur/Dashboard";
import GroupesPage from "@/pages/formateur/Groupes";
import SeancesPage from "@/pages/formateur/Seances";
import SessionPilot from "@/pages/formateur/SessionPilot";
import SessionBilan from "@/pages/formateur/SessionBilan";
import SequenceBuilder from "@/pages/formateur/SequenceBuilder";

import EleveLayout from "@/layouts/EleveLayout";
import EleveDashboard from "@/pages/eleve/Dashboard";
import EleveProgression from "@/pages/eleve/Progression";
import EleveDetail from "@/pages/formateur/EleveDetail";
import TestsEntreePage from "@/pages/formateur/TestsEntree";
import ImportProgramme from "@/pages/formateur/ImportProgramme";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/eleve/login" element={<LoginEleve />} />
            <Route path="/formateur/login" element={<LoginFormateur />} />
            <Route path="/admin/login" element={<LoginAdmin />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Formateur routes */}
            <Route
              path="/formateur"
              element={
                <ProtectedRoute requiredRole="formateur">
                  <FormateurLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<FormateurDashboard />} />
              <Route path="groupes" element={<GroupesPage />} />
              <Route path="seances" element={<SeancesPage />} />
              <Route path="seances/:id/pilote" element={<SessionPilot />} />
              <Route path="seances/:id/bilan" element={<SessionBilan />} />
              <Route path="sequences/new" element={<SequenceBuilder />} />
              <Route path="eleves/:eleveId" element={<EleveDetail />} />
              <Route path="exercices" element={<FormateurDashboard />} />
              <Route path="monitoring" element={<FormateurDashboard />} />
              <Route path="tests" element={<TestsEntreePage />} />
              <Route path="import-programme" element={<ImportProgramme />} />
              <Route path="rapports" element={<FormateurDashboard />} />
              <Route path="parametres" element={<FormateurDashboard />} />
            </Route>

            {/* Élève routes */}
            <Route
              path="/eleve"
              element={
                <ProtectedRoute requiredRole="eleve">
                  <EleveLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EleveDashboard />} />
              <Route path="test" element={<EleveDashboard />} />
              <Route path="devoirs" element={<EleveDashboard />} />
              <Route path="progression" element={<EleveProgression />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
