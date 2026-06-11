import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SandboxProvider } from "@/contexts/SandboxContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AIConsentRequiredRoute from "@/components/AIConsentRequiredRoute";
import SandboxEmbedBootstrap from "@/components/sandbox/SandboxEmbedBootstrap";
import { isSandboxEmbed } from "@/integrations/supabase/sandboxEmbed";
import AccesLimite from "@/pages/eleve/AccesLimite";

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
import FormateurDashboardV2 from "@/pages/formateur/DashboardV2";
import MonitoringPage from "@/pages/formateur/MonitoringPage";
import GroupesPage from "@/pages/formateur/Groupes";
import SeancesPage from "@/pages/formateur/Seances";
import SessionPilot from "@/pages/formateur/SessionPilot";
import SessionBilan from "@/pages/formateur/SessionBilan";
import SequenceBuilder from "@/pages/formateur/SequenceBuilder";
import ExercicesPage from "@/pages/formateur/ExercicesPage";
import InterventionRapidePage from "@/pages/formateur/InterventionRapidePage";
import SuiviDirectClasse from "@/pages/formateur/SuiviDirectClasse";
import BibliothequeInterventions from "@/pages/formateur/BibliothequeInterventions";

import EleveLayout from "@/layouts/EleveLayout";
import EleveDashboard from "@/pages/eleve/Dashboard";
import EleveDevoirs from "@/pages/eleve/Devoirs";
import DevoirPassation from "@/pages/eleve/DevoirPassation";
import CarnetMots from "@/pages/eleve/CarnetMots";
import EleveProgression from "@/pages/eleve/Progression";
import EleveProfil from "@/pages/eleve/Profil";

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
import SignalementsPage from "@/pages/formateur/SignalementsPage";
import DevoirsFormateur from "@/pages/formateur/DevoirsFormateur";
import AccessRequests from "@/pages/formateur/AccessRequests";
import TestResultats from "@/pages/formateur/TestResultats";
import TestResultatDetail from "@/pages/formateur/TestResultatDetail";
import TestResultatGroupes from "@/pages/formateur/TestResultatGroupes";
import TestPositionnement from "@/pages/eleve/TestPositionnement";
import PositionnementPassation from "@/pages/eleve/PositionnementPassation";
import PositionnementResultat from "@/pages/eleve/PositionnementResultat";
import RessourcesPage from "@/pages/formateur/RessourcesPage";
import BanqueActivites from "@/pages/formateur/BanqueActivites";
import BilansAtelierPage from "@/pages/formateur/BilansAtelierPage";
import PositionnementPage from "@/pages/formateur/PositionnementPage";
import PlayExercise from "@/pages/PlayExercise";
import AnalyticsErreursPage from "@/pages/formateur/AnalyticsErreursPage";
import AuthRelayReset from "@/pages/AuthRelayReset";
import SandboxControlPanel from "@/pages/formateur/SandboxControlPanel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SandboxProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          {isSandboxEmbed() ? (
            <SandboxEmbedBootstrap>
              <Routes>
                <Route
                  path="/eleve"
                  element={
                    <ProtectedRoute requiredRole="eleve">
                      <EleveLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="acces-limite" element={<AccesLimite />} />
                  <Route path="profil" element={<EleveProfil />} />
                  <Route index element={<AIConsentRequiredRoute><EleveDashboard /></AIConsentRequiredRoute>} />
                  <Route path="test-positionnement" element={<AIConsentRequiredRoute><TestPositionnement /></AIConsentRequiredRoute>} />
                  <Route path="test-positionnement/passer/:token" element={<PositionnementPassation />} />
                  <Route path="test-positionnement/resultat/:attemptId" element={<PositionnementResultat />} />
                  <Route path="devoirs" element={<AIConsentRequiredRoute><EleveDevoirs /></AIConsentRequiredRoute>} />
                  <Route path="carnet" element={<AIConsentRequiredRoute><CarnetMots /></AIConsentRequiredRoute>} />
                  <Route path="bilan/:sessionId" element={<AIConsentRequiredRoute><BilanSeance /></AIConsentRequiredRoute>} />
                  <Route path="exercices-seance/:sessionId" element={<AIConsentRequiredRoute><BilanSeance /></AIConsentRequiredRoute>} />
                  <Route path="bilan-test/:testId" element={<AIConsentRequiredRoute><BilanTestPassation /></AIConsentRequiredRoute>} />
                  <Route path="bilan-devoirs/:bilanId" element={<AIConsentRequiredRoute><BilanDevoirs /></AIConsentRequiredRoute>} />
                  <Route path="devoirs/:devoirId" element={<AIConsentRequiredRoute><DevoirPassation /></AIConsentRequiredRoute>} />
                  <Route path="progression" element={<AIConsentRequiredRoute><EleveProgression /></AIConsentRequiredRoute>} />
                </Route>
                <Route path="*" element={<Navigate to="/eleve" replace />} />
              </Routes>
            </SandboxEmbedBootstrap>
          ) : (
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/eleve/login" element={<LoginEleve />} />
            <Route path="/formateur/login" element={<LoginFormateur />} />
            {/* Admin route intentionally omitted until a dashboard exists */}
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/play/:token" element={<PlayExercise />} />
            <Route path="/auth/relay-reset" element={<AuthRelayReset />} />
            <Route path="/sandbox" element={<Navigate to="/formateur/sandbox" replace />} />

            {/* Formateur routes */}
            <Route
              path="/formateur"
              element={
                <ProtectedRoute requiredRole="formateur">
                  <FormateurLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<FormateurDashboardV2 />} />
              <Route path="dashboard-legacy" element={<FormateurDashboard />} />

              <Route path="groupes" element={<GroupesPage />} />
              <Route path="seances" element={<SeancesPage />} />
              <Route path="seances/:id/pilote" element={<SessionPilot />} />
              <Route path="seances/:id/bilan" element={<SessionBilan />} />
              <Route path="sequences/new" element={<SequenceBuilder />} />
              <Route path="eleves/:eleveId" element={<EleveDetail />} />
              <Route path="exercices" element={<ExercicesPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="suivi-direct" element={<SuiviDirectClasse />} />
              <Route path="tests" element={<TestsEntreePage />} />
              <Route path="import-programme" element={<ImportProgramme />} />
              <Route path="parcours" element={<ParcoursPage />} />
              <Route path="parcours/:parcoursId" element={<ParcoursDetail />} />
              <Route path="rapports" element={<RapportsPage />} />
              <Route path="suivi-devoirs" element={<SuiviDevoirsPage />} />
              <Route path="signalements" element={<SignalementsPage />} />
              <Route path="devoirs" element={<DevoirsFormateur />} />
              <Route path="session-builder" element={<SessionSupermarket />} />
              <Route path="demandes" element={<AccessRequests />} />
              <Route path="test-resultats" element={<TestResultats />} />
              <Route path="test-resultats/groupes" element={<TestResultatGroupes />} />
              <Route path="test-resultats/:apprenantId" element={<TestResultatDetail />} />
              <Route path="ressources" element={<RessourcesPage />} />
              <Route path="intervention" element={<InterventionRapidePage />} />
              <Route path="bibliotheque-interventions" element={<BibliothequeInterventions />} />
              <Route path="banque-activites" element={<BanqueActivites />} />
              <Route path="bilans-atelier" element={<BilansAtelierPage />} />
              <Route path="positionnement" element={<PositionnementPage />} />
              <Route path="analytics-erreurs" element={<AnalyticsErreursPage />} />
              <Route path="parametres" element={<Parametres />} />
              <Route path="sandbox" element={<SandboxControlPanel />} />
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
              {/* Routes accessibles sans double consentement IA + voix */}
              <Route path="acces-limite" element={<AccesLimite />} />
              <Route path="profil" element={<EleveProfil />} />

              {/* Routes pédagogiques : double consentement requis */}
              <Route index element={<AIConsentRequiredRoute><EleveDashboard /></AIConsentRequiredRoute>} />
              <Route path="test-positionnement" element={<AIConsentRequiredRoute><TestPositionnement /></AIConsentRequiredRoute>} />
              <Route path="test-positionnement/passer/:token" element={<PositionnementPassation />} />
              <Route path="test-positionnement/resultat/:attemptId" element={<PositionnementResultat />} />
              <Route path="devoirs" element={<AIConsentRequiredRoute><EleveDevoirs /></AIConsentRequiredRoute>} />
              <Route path="carnet" element={<AIConsentRequiredRoute><CarnetMots /></AIConsentRequiredRoute>} />
              <Route path="bilan/:sessionId" element={<AIConsentRequiredRoute><BilanSeance /></AIConsentRequiredRoute>} />
              <Route path="exercices-seance/:sessionId" element={<AIConsentRequiredRoute><BilanSeance /></AIConsentRequiredRoute>} />
              <Route path="bilan-test/:testId" element={<AIConsentRequiredRoute><BilanTestPassation /></AIConsentRequiredRoute>} />
              <Route path="bilan-devoirs/:bilanId" element={<AIConsentRequiredRoute><BilanDevoirs /></AIConsentRequiredRoute>} />
              <Route path="devoirs/:devoirId" element={<AIConsentRequiredRoute><DevoirPassation /></AIConsentRequiredRoute>} />
              <Route path="progression" element={<AIConsentRequiredRoute><EleveProgression /></AIConsentRequiredRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          )}
        </HashRouter>
        </TooltipProvider>
      </SandboxProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
