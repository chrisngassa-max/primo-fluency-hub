import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, TrendingUp, AlertCircle, ArrowRight, Target, ClipboardCheck, Calendar, BarChart2, Pencil, FileText } from "lucide-react";
import CompetenceLabel from "@/components/CompetenceLabel";
import MesFichesTab from "@/components/MesFichesTab";
import EleveOnboarding, { useShowOnboarding } from "@/components/EleveOnboarding";
import JoinGroupCard from "@/components/JoinGroupCard";
import CompetencyGauge from "@/components/CompetencyGauge";
import TrajectoireTCF from "@/components/TrajectoireTCF";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const EleveDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, dismissOnboarding] = useShowOnboarding();
  const [activeTab, setActiveTab] = useState<"dashboard" | "fiches">("dashboard");
  const qc = useQueryClient();
  const autoJoinRef = useRef(false);

  // Auto-join group from persisted invite code (survives email confirmation redirect)
  useEffect(() => {
    const code = sessionStorage.getItem("tcf-invite-code");
    if (!user || !code || autoJoinRef.current) return;
    autoJoinRef.current = true;

    (async () => {
      try {
        const { data: invitation } = await supabase
          .from("group_invitations")
          .select("id, group_id, expires_at, group:groups(nom)")
          .eq("code", code)
          .maybeSingle();
        if (!invitation || new Date(invitation.expires_at) < new Date()) {
          sessionStorage.removeItem("tcf-invite-code");
          return;
        }
        const { data: existing } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", invitation.group_id)
          .eq("eleve_id", user.id)
          .maybeSingle();
        if (existing) {
          sessionStorage.removeItem("tcf-invite-code");
          return;
        }
        await supabase
          .from("group_members")
          .insert({ group_id: invitation.group_id, eleve_id: user.id });
        sessionStorage.removeItem("tcf-invite-code");
        const groupName = (invitation as any).group?.nom || "le groupe";
        toast.success(`Tu as rejoint le groupe « ${groupName} » !`);
        qc.invalidateQueries({ queryKey: ["eleve-memberships"] });
      } catch (e) {
        console.error("Auto-join failed", e);
      }
    })();
  }, [user, qc]);

  // Check if student already passed the positioning test
  const { data: testResultat, isLoading: testLoading } = useQuery({
    queryKey: ["eleve-test-positionnement-result", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_resultats_apprenants")
        .select("*")
        .eq("apprenant_id", user!.id)
        .order("date_test", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const testCompleted = !!testResultat;



  // Identifie la séance du jour (date = aujourd'hui, sinon la plus récente "en_cours")
  const { data: todaySession } = useQuery({
    queryKey: ["eleve-today-session", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("eleve_id", user!.id);
      if (!memberships?.length) return null;
      const groupIds = memberships.map((m) => m.group_id);
      const joinMap = new Map(memberships.map((m) => [m.group_id, m.joined_at]));

      // Bornes du jour (locales)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      // 1) Une séance dont la date est aujourd'hui
      const { data: todays } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, statut, group:groups(nom)")
        .in("group_id", groupIds)
        .gte("date_seance", start.toISOString())
        .lt("date_seance", end.toISOString())
        .order("date_seance", { ascending: true })
        .limit(1);
      if (todays && todays.length > 0) {
        const s = todays[0] as any;
        const jd = joinMap.get(s.group_id);
        if (jd && new Date(s.date_seance) >= new Date(jd)) return s;
      }
      // 2) Sinon, séance "en_cours" la plus récente
      const { data: enCours } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, statut, group:groups(nom)")
        .in("group_id", groupIds)
        .eq("statut", "en_cours")
        .order("date_seance", { ascending: false })
        .limit(1);
      if (enCours && enCours.length > 0) {
        const s = enCours[0] as any;
        const jd = joinMap.get(s.group_id);
        if (jd && new Date(s.date_seance) >= new Date(jd)) return s;
      }
      return null;
    },
    enabled: !!user?.id,
  });

  // Fetch pending bilan tests UNIQUEMENT pour la séance du jour
  const { data: pendingTests } = useQuery({
    queryKey: ["eleve-bilans-tests", user?.id, todaySession?.id],
    queryFn: async () => {
      if (!todaySession?.id) return [];
      const { data: tests, error } = await supabase
        .from("bilan_tests")
        .select("id, nb_questions, competences_couvertes, created_at, session:sessions(titre, date_seance, group_id)")
        .eq("statut", "envoye")
        .eq("session_id", todaySession.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!tests || tests.length === 0) return [];

      const testIds = (tests as any[]).map((t: any) => t.id);
      const { data: done } = await supabase
        .from("bilan_test_results")
        .select("bilan_test_id, score_global")
        .eq("eleve_id", user!.id)
        .in("bilan_test_id", testIds);
      const doneMap = new Map((done ?? []).map((d: any) => [d.bilan_test_id, d.score_global]));
      return (tests as any[]).map((t: any) => ({
        ...t,
        completed: doneMap.has(t.id),
        score: doneMap.get(t.id),
      }));
    },
    enabled: !!user?.id && !!todaySession?.id,
  });

  const uncompletedTests = (pendingTests ?? []).filter((t: any) => !t.completed);

  // Exercices de la séance du jour uniquement
  const { data: sessionExercises, isLoading: loadingSessionEx } = useQuery({
    queryKey: ["eleve-session-exercises", user?.id, todaySession?.id],
    queryFn: async () => {
      if (!todaySession?.id) return [];

      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("session_id, exercice_id, updated_at")
        .eq("session_id", todaySession.id)
        .eq("statut", "traite_en_classe" as any);
      if (!seLinks?.length) return [];

      const exerciceIds = [...new Set(seLinks.map((se: any) => se.exercice_id))];
      const { data: resultats } = await supabase
        .from("resultats")
        .select("exercice_id")
        .eq("eleve_id", user!.id)
        .in("exercice_id", exerciceIds);
      const doneExIds = new Set((resultats ?? []).map((r) => r.exercice_id));

      const total = seLinks.length;
      const done = seLinks.filter((se: any) => doneExIds.has(se.exercice_id)).length;
      const remaining = total - done;
      if (remaining <= 0) return [];

      return [{
        sessionId: todaySession.id,
        titre: (todaySession as any).titre,
        date_seance: (todaySession as any).date_seance,
        group_nom: (todaySession as any).group?.nom || "",
        total,
        done,
        remaining,
      }];
    },
    enabled: !!user?.id && !!todaySession?.id,
  });

  // Fetch profil_eleve for current scores
  const { data: profilEleve } = useQuery({
    queryKey: ["eleve-profil", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profils_eleves")
        .select("taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures")
        .eq("eleve_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch parcours sessions count for the student's group
  const { data: sessionsData } = useQuery({
    queryKey: ["eleve-sessions-count", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("eleve_id", user!.id);
      if (!memberships || memberships.length === 0) return { completed: 0, total: 0 };
      const groupIds = memberships.map((m) => m.group_id);
      const { data: allSessions } = await supabase
        .from("sessions")
        .select("id, statut")
        .in("group_id", groupIds);
      if (!allSessions) return { completed: 0, total: 0 };
      return {
        completed: allSessions.filter((s) => s.statut === "terminee").length,
        total: allSessions.length,
      };
    },
    enabled: !!user?.id,
  });

  // Build progression data from positioning test results
  const progressionData = testCompleted && testResultat ? [
    {
      label: "Compréhension Orale",
      initialScore: Math.round(Number(testResultat.score_co ?? 0)),
      currentScore: Math.round(Number(profilEleve?.taux_reussite_co ?? testResultat.score_co ?? 0)),
      completedSessions: sessionsData?.completed ?? 0,
      totalSessions: Math.max(sessionsData?.total ?? 1, 1),
    },
    {
      label: "Compréhension Écrite",
      initialScore: Math.round(Number(testResultat.score_ce ?? 0)),
      currentScore: Math.round(Number(profilEleve?.taux_reussite_ce ?? testResultat.score_ce ?? 0)),
      completedSessions: sessionsData?.completed ?? 0,
      totalSessions: Math.max(sessionsData?.total ?? 1, 1),
    },
    {
      label: "Expression Orale",
      initialScore: Math.round(Number(testResultat.score_eo ?? 0)),
      currentScore: Math.round(Number(profilEleve?.taux_reussite_eo ?? testResultat.score_eo ?? 0)),
      completedSessions: sessionsData?.completed ?? 0,
      totalSessions: Math.max(sessionsData?.total ?? 1, 1),
    },
    {
      label: "Expression Écrite",
      initialScore: Math.round(Number(testResultat.score_ee ?? 0)),
      currentScore: Math.round(Number(profilEleve?.taux_reussite_ee ?? testResultat.score_ee ?? 0)),
      completedSessions: sessionsData?.completed ?? 0,
      totalSessions: Math.max(sessionsData?.total ?? 1, 1),
    },
  ] : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {showOnboarding && <EleveOnboarding onComplete={dismissOnboarding} />}

      {/* Tab navigation */}
      <div className="flex gap-2 border-b pb-0">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "dashboard"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Mon espace
        </button>
        <button
          onClick={() => setActiveTab("fiches")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "fiches"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Mes fiches
        </button>

      </div>

      {activeTab === "fiches" ? (
        <MesFichesTab />
      ) : (
      <>

      <div>
      <h1 className="text-2xl font-bold text-foreground">
          Bienvenue{user?.user_metadata?.prenom ? `, ${user.user_metadata.prenom}` : ""} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Ton espace de préparation au TCF IRN.</p>
      </div>

      {/* Conditional test banner — shown only if test not completed */}
      {!testLoading && !testCompleted && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                <Target className="h-6 w-6 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-lg">
                  Commence par évaluer ton niveau
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Passe le test de positionnement adaptatif (~20 min · 4 compétences) pour que CAP TCF adapte ton
                  programme à ton niveau réel.
                </p>
                <Button
                  className="mt-3 gap-2"
                  onClick={() => navigate("/eleve/test-positionnement")}
                >
                  Commencer le test de niveau
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {user?.id && <TrajectoireTCF eleveId={user.id} />}

      {uncompletedTests.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Tests de bilan (évaluation de séance)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Ton formateur t'a envoyé un test pour évaluer tes acquis après la séance. Ce test est distinct des exercices.
            </p>
            {uncompletedTests.map((test: any) => (
              <div
                key={test.id}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/eleve/bilan-test/${test.id}`)}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    Test de bilan — {test.session?.titre || "Séance"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {test.session?.date_seance ? format(new Date(test.session.date_seance), "d MMMM yyyy", { locale: fr }) : ""}
                    <span>·</span>
                    <span>{test.nb_questions} questions</span>
                    <span>·</span>
                    <span>{(test.competences_couvertes || []).join(", ")}</span>
                  </div>
                </div>
                <Button size="xl" variant="default" className="gap-1 shrink-0">
                  Commencer le test <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Exercices de séance envoyés par le formateur */}
      {sessionExercises && sessionExercises.length > 0 && (
        <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Pencil className="h-5 w-5 text-green-600" />
              Exercices de séance à faire
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Ton formateur t'a envoyé des exercices à réaliser.
            </p>
            {sessionExercises.map((se: any) => (
              <div
                key={se.sessionId}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/eleve/exercices-seance/${se.sessionId}`)}
              >
                <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Pencil className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{se.titre}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(se.date_seance), "d MMMM yyyy", { locale: fr })}
                    {se.group_nom && <><span>·</span><span>{se.group_nom}</span></>}
                    <span>·</span>
                    <span>{se.remaining <= 0 ? "Aucun exercice restant" : se.remaining === 1 ? "1 exercice restant" : `${se.remaining} exercices restants`}</span>
                  </div>
                </div>
                <Button size="xl" variant="default" className="gap-1 shrink-0">
                  Faire <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ma progression détaillée */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Ma progression détaillée
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : progressionData ? (
            <div className="space-y-5">
              {progressionData.map((comp) => (
                <CompetencyGauge key={comp.label} {...comp} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">
                Bienvenue ! Commencez par réaliser votre Test d'entrée pour initialiser votre suivi de progression.
              </p>
              <Button
                className="mt-4 gap-2"
                variant="outline"
                onClick={() => navigate("/eleve/test-positionnement")}
              >
                Passer le test de niveau
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lien rapide vers les devoirs (la liste se trouve sur la page dédiée) */}
      <Card
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate("/eleve/devoirs")}
      >
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Mes devoirs</p>
              <p className="text-xs text-muted-foreground">
                Retrouve tous tes devoirs sur la page dédiée
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Join group */}
      <JoinGroupCard />
      </>
      )}
    </div>
  );
};

export default EleveDashboard;
