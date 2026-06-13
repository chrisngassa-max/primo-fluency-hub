import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SandboxProvider } from "@/contexts/SandboxContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AIConsentRequiredRoute from "@/components/AIConsentRequiredRoute";
import SandboxEmbedBootstrap from "@/components/sandbox/SandboxEmbedBootstrap";
import PasswordRecoveryBridge from "@/components/PasswordRecoveryBridge";
import PendingGroupInvitationBridge from "@/components/PendingGroupInvitationBridge";
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

const FormateurLayout = lazy(() => import("@/layouts/FormateurLayout"));
const FormateurDashboard = lazy(() => import("@/pages/formateur/Dashboard"));
const FormateurDashboardV2 = lazy(() => import("@/pages/formateur/DashboardV2"));
const MonitoringPage = lazy(() => import("@/pages/formateur/MonitoringPage"));
const GroupesPage = lazy(() => import("@/pages/formateur/Groupes"));
const SeancesPage = lazy(() => import("@/pages/formateur/Seances"));
const SessionPilot = lazy(() => import("@/pages/formateur/SessionPilot"));
const SessionBilan = lazy(() => import("@/pages/formateur/SessionBilan"));
const SequenceBuilder = lazy(() => import("@/pages/formateur/SequenceBuilder"));
const ExercicesPage = lazy(() => import("@/pages/formateur/ExercicesPage"));
const InterventionRapidePage = lazy(() => import("@/pages/formateur/InterventionRapidePage"));
const SuiviDirectClasse = lazy(() => import("@/pages/formateur/SuiviDirectClasse"));
const BibliothequeInterventions = lazy(() => import("@/pages/formateur/BibliothequeInterventions"));
const EleveLayout = lazy(() => import("@/layouts/EleveLayout"));
const EleveDashboard = lazy(() => import("@/pages/eleve/Dashboard"));
const EleveDevoirs = lazy(() => import("@/pages/eleve/Devoirs"));
const DevoirPassation = lazy(() => import("@/pages/eleve/DevoirPassation"));
const CarnetMots = lazy(() => import("@/pages/eleve/CarnetMots"));
const EleveProgression = lazy(() => import("@/pages/eleve/Progression"));
const EleveProfil = lazy(() => import("@/pages/eleve/Profil"));
const BilanSeance = lazy(() => import("@/pages/eleve/BilanSeance"));
const BilanTestPassation = lazy(() => import("@/pages/eleve/BilanTestPassation"));
const BilanDevoirs = lazy(() => import("@/pages/eleve/BilanDevoirs"));
const EleveDetail = lazy(() => import("@/pages/formateur/EleveDetail"));
const TestsEntreePage = lazy(() => import("@/pages/formateur/TestsEntree"));
const ImportProgramme = lazy(() => import("@/pages/formateur/ImportProgramme"));
const Parametres = lazy(() => import("@/pages/formateur/Parametres"));
const ParcoursPage = lazy(() => import("@/pages/formateur/ParcoursPage"));
const ParcoursDetail = lazy(() => import("@/pages/formateur/ParcoursDetail"));
const RapportsPage = lazy(() => import("@/pages/formateur/RapportsPage"));
const SessionSupermarket = lazy(() => import("@/pages/formateur/SessionSupermarket"));
const SuiviDevoirsPage = lazy(() => import("@/pages/formateur/SuiviDevoirsPage"));
const SignalementsPage = lazy(() => import("@/pages/formateur/SignalementsPage"));
const DevoirsFormateur = lazy(() => import("@/pages/formateur/DevoirsFormateur"));
const AccessRequests = lazy(() => import("@/pages/formateur/AccessRequests"));
const TestResultats = lazy(() => import("@/pages/formateur/TestResultats"));
const TestResultatDetail = lazy(() => import("@/pages/formateur/TestResultatDetail"));
const TestResultatGroupes = lazy(() => import("@/pages/formateur/TestResultatGroupes"));
const TestPositionnement = lazy(() => import("@/pages/eleve/TestPositionnement"));
const PositionnementPassation = lazy(() => import("@/pages/eleve/PositionnementPassation"));
const PositionnementResultat = lazy(() => import("@/pages/eleve/PositionnementResultat"));
const RessourcesPage = lazy(() => import("@/pages/formateur/RessourcesPage"));
const BanqueActivites = lazy(() => import("@/pages/formateur/BanqueActivites"));
const BilansAtelierPage = lazy(() => import("@/pages/formateur/BilansAtelierPage"));
const PositionnementPage = lazy(() => import("@/pages/formateur/PositionnementPage"));
const PlayExercise = lazy(() => import("@/pages/PlayExercise"));
const AnalyticsErreursPage = lazy(() => import("@/pages/formateur/AnalyticsErreursPage"));
const AuthRelayReset = lazy(() => import("@/pages/AuthRelayReset"));
const SandboxControlPanel = lazy(() => import("@/pages/formateur/SandboxControlPanel"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SandboxProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Suspense
            fallback={
              <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
                <p className="font-semibold text-foreground">Chargement de ton espace…</p>
              </div>
            }
          >
          <PasswordRecoveryBridge />
          <PendingGroupInvitationBridge />
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
          </Suspense>
        </HashRouter>
        </TooltipProvider>
      </SandboxProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
