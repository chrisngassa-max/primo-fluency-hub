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

  // Fetch active devoirs
  const { data: devoirs, isLoading: devoirsLoading } = useQuery({
    queryKey: ["eleve-devoirs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(titre, competence, consigne, format)")
        .eq("eleve_id", user!.id)
        .eq("statut", "en_attente")
        .order("date_echeance", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });


  // Fetch pending bilan tests (AI-generated tests sent by formateur)
  const { data: pendingTests } = useQuery({
    queryKey: ["eleve-bilans-tests", user?.id],
    queryFn: async () => {
      // Get student's group join dates to filter out pre-existing content
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("eleve_id", user!.id);
      if (!memberships?.length) return [];
      const joinMap = new Map(memberships.map((m) => [m.group_id, m.joined_at]));
      const groupIds = memberships.map((m) => m.group_id);

      const { data: tests, error } = await supabase
        .from("bilan_tests")
        .select("id, nb_questions, competences_couvertes, created_at, session:sessions(titre, date_seance, group_id)")
        .eq("statut", "envoye")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!tests || tests.length === 0) return [];

      // Filter: only tests from groups the student belongs to AND created after joining
      const filtered = (tests as any[]).filter((t: any) => {
        const gid = t.session?.group_id;
        if (!gid || !joinMap.has(gid)) return false;
        return new Date(t.created_at) >= new Date(joinMap.get(gid)!);
      });
      if (filtered.length === 0) return [];

      const testIds = filtered.map((t: any) => t.id);
      const { data: done } = await supabase
        .from("bilan_test_results")
        .select("bilan_test_id, score_global")
        .eq("eleve_id", user!.id)
        .in("bilan_test_id", testIds);
      const doneMap = new Map((done ?? []).map((d: any) => [d.bilan_test_id, d.score_global]));
      return filtered.map((t: any) => ({
        ...t,
        completed: doneMap.has(t.id),
        score: doneMap.get(t.id),
      }));
    },
    enabled: !!user?.id,
  });

  const uncompletedTests = (pendingTests ?? []).filter((t: any) => !t.completed);

  // Fetch sessions with exercises sent to students (traite_en_classe) that student hasn't completed
  const { data: sessionExercises, isLoading: loadingSessionEx } = useQuery({
    queryKey: ["eleve-session-exercises", user?.id],
    queryFn: async () => {
      // Get student's groups with join dates
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("eleve_id", user!.id);
      if (!memberships?.length) return [];
      const groupIds = memberships.map((m) => m.group_id);
      const joinMap = new Map(memberships.map((m) => [m.group_id, m.joined_at]));

      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, group:groups(nom)")
        .in("group_id", groupIds)
        .in("statut", ["planifiee", "en_cours", "terminee"])
        .order("date_seance", { ascending: false })
        .limit(20);
      if (!sessions?.length) return [];

      const sessionMap = new Map((sessions as any[]).map((s: any) => [s.id, s]));
      const sessionIds = (sessions as any[]).map((s: any) => s.id);

      // Get sent session exercises and keep only those actually sent after group join
      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("session_id, exercice_id, updated_at")
        .in("session_id", sessionIds)
        .eq("statut", "traite_en_classe" as any);
      if (!seLinks?.length) return [];

      const visibleSessionExercises = (seLinks as any[]).filter((se: any) => {
        const session = sessionMap.get(se.session_id);
        if (!session) return false;

        const joinDate = joinMap.get(session.group_id);
        if (!joinDate) return false;

        return new Date(se.updated_at) >= new Date(joinDate);
      });
      if (!visibleSessionExercises.length) return [];

      // Check which exercises student already completed
      const exerciceIds = [...new Set(visibleSessionExercises.map((se: any) => se.exercice_id))];
      const { data: resultats } = await supabase
        .from("resultats")
        .select("exercice_id")
        .eq("eleve_id", user!.id)
        .in("exercice_id", exerciceIds);
      const doneExIds = new Set((resultats ?? []).map((r) => r.exercice_id));

      // Build per-session summary
      const grouped: Record<string, { total: number; done: number }> = {};
      for (const se of visibleSessionExercises) {
        if (!grouped[se.session_id]) grouped[se.session_id] = { total: 0, done: 0 };
        grouped[se.session_id].total++;
        if (doneExIds.has(se.exercice_id)) grouped[se.session_id].done++;
      }

      return Object.entries(grouped)
        .filter(([, v]) => v.done < v.total) // Only sessions with pending exercises
        .map(([sessionId, v]) => {
          const s = sessionMap.get(sessionId)!;
          return {
            sessionId,
            titre: s.titre,
            date_seance: s.date_seance,
            group_nom: (s.group as any)?.nom || "",
            total: v.total,
            done: v.done,
            remaining: v.total - v.done,
          };
        })
        .sort((a, b) => new Date(b.date_seance).getTime() - new Date(a.date_seance).getTime());
    },
    enabled: !!user?.id,
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
              Tests de bilan à passer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Ton formateur t'a envoyé un test pour valider tes acquis de séance.
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
                onClick={() => navigate(`/eleve/bilan/${se.sessionId}`)}
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

      {/* Devoirs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent-foreground" />
            Mes devoirs du jour
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devoirsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : devoirs && devoirs.length > 0 ? (
            <div className="space-y-3">
              {devoirs.map((d) => {
                const ex = d.exercice as any;
                const isUrgent = d.raison === "remediation";
                const deadline = new Date(d.date_echeance);
                const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
                const isLate = daysLeft < 0;
                const isUrgentTime = daysLeft <= 2 && daysLeft >= 0;
                return (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/eleve/devoirs/${d.id}`)}
                  >
                    <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 shrink-0">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{ex?.titre || "Exercice"}</span>
                        {isUrgent ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="h-3 w-3" />
                            ⚠️ À retravailler
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs border-orange-500/30 text-orange-600"
                          >
                            À renforcer
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{ex?.consigne}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <CompetenceLabel code={ex?.competence} />
                        </Badge>
                      </div>
                      {/* Deadline display */}
                      {isLate ? (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Devoir en retard — attendu le {format(deadline, "d MMMM", { locale: fr })}
                        </p>
                      ) : isUrgentTime ? (
                        <p className="text-sm text-orange-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {daysLeft === 0 ? "À rendre aujourd'hui !" : daysLeft === 1 ? "À rendre demain" : "À rendre dans 2 jours"}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          À rendre avant le : {format(deadline, "EEEE d MMMM yyyy", { locale: fr })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Aucun devoir pour le moment</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Réalisez votre première séance pour recevoir vos devoirs !
              </p>
            </div>
          )}
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
