import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "@/pages/Index";
import Legal from "@/pages/Legal";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import Unsubscribe from "@/pages/Unsubscribe";

import LoginEleve from "@/pages/auth/LoginEleve";
import LoginFormateur from "@/pages/auth/LoginFormateur";
// LoginAdmin removed — no admin dashboard exists yet

import FormateurLayout from "@/layouts/FormateurLayout";
import FormateurDashboard from "@/pages/formateur/Dashboard";
import MonitoringPage from "@/pages/formateur/MonitoringPage";
import GroupesPage from "@/pages/formateur/Groupes";
import SeancesPage from "@/pages/formateur/Seances";
import SessionPilot from "@/pages/formateur/SessionPilot";
import SessionBilan from "@/pages/formateur/SessionBilan";
import SequenceBuilder from "@/pages/formateur/SequenceBuilder";
import ExercicesPage from "@/pages/formateur/ExercicesPage";

import EleveLayout from "@/layouts/EleveLayout";
import EleveDashboard from "@/pages/eleve/Dashboard";
import EleveDevoirs from "@/pages/eleve/Devoirs";
import DevoirPassation from "@/pages/eleve/DevoirPassation";
import EleveProgression from "@/pages/eleve/Progression";
import EleveProfil from "@/pages/eleve/Profil";
import EleveTestEntree from "@/pages/eleve/TestEntree";
import BilanSeance from "@/pages/eleve/BilanSeance";
import BilanTestPassation from "@/pages/eleve/BilanTestPassation";
import BilanDevoirs from "@/pages/eleve/BilanDevoirs";
import EleveDetail from "@/pages/formateur/EleveDetail";
import TestsEntreePage from "@/pages/formateur/TestsEntree";
import ImportProgramme from "@/pages/formateur/ImportProgramme";
import Parametres from "@/pages/formateur/Parametres";
import ParcoursPage from "@/pages/formateur/ParcoursPage";
import ParcoursDetail from "@/pages/formateur/ParcoursDetail";
import RapportsPage from "@/pages/formateur/RapportsPage";
import SessionSupermarket from "@/pages/formateur/SessionSupermarket";
import SuiviDevoirsPage from "@/pages/formateur/SuiviDevoirsPage";
import AccessRequests from "@/pages/formateur/AccessRequests";

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
            <Route path="/legal" element={<Legal />} />
            <Route path="/eleve/login" element={<LoginEleve />} />
            <Route path="/formateur/login" element={<LoginFormateur />} />
            {/* Admin route removed — no admin dashboard */}
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

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
              <Route path="exercices" element={<ExercicesPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="tests" element={<TestsEntreePage />} />
              <Route path="import-programme" element={<ImportProgramme />} />
              <Route path="parcours" element={<ParcoursPage />} />
              <Route path="parcours/:parcoursId" element={<ParcoursDetail />} />
              <Route path="rapports" element={<RapportsPage />} />
              <Route path="suivi-devoirs" element={<SuiviDevoirsPage />} />
              <Route path="session-builder" element={<SessionSupermarket />} />
              <Route path="demandes" element={<AccessRequests />} />
              <Route path="parametres" element={<Parametres />} />
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
              <Route path="test-entree" element={<EleveTestEntree />} />
              <Route path="devoirs" element={<EleveDevoirs />} />
              <Route path="bilan/:sessionId" element={<BilanSeance />} />
              <Route path="bilan-test/:testId" element={<BilanTestPassation />} />
              <Route path="bilan-devoirs/:bilanId" element={<BilanDevoirs />} />
              <Route path="devoirs/:devoirId" element={<DevoirPassation />} />
              <Route path="progression" element={<EleveProgression />} />
              <Route path="profil" element={<EleveProfil />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
