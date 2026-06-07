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
import { BookOpen, TrendingUp, AlertCircle, ArrowRight, Target, ClipboardCheck, Calendar, BarChart2, Pencil, FileText, History } from "lucide-react";
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



  // Identifie toutes les séances accessibles aujourd'hui / en cours pour éviter de masquer un envoi
  const { data: activeSessions } = useQuery({
    queryKey: ["eleve-active-sessions", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("eleve_id", user!.id);
      if (!memberships?.length) return [];
      const groupIds = memberships.map((m) => m.group_id);

      // Bornes du jour (locales)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data: todays } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, statut, group:groups(nom)")
        .in("group_id", groupIds)
        .gte("date_seance", start.toISOString())
        .lt("date_seance", end.toISOString())
        .order("date_seance", { ascending: true });

      const { data: enCours } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, statut, group:groups(nom)")
        .in("group_id", groupIds)
        .eq("statut", "en_cours")
        .order("date_seance", { ascending: false });

      const byId = new Map<string, any>();
      [...(todays ?? []), ...(enCours ?? [])].forEach((s: any) => byId.set(s.id, s));
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.date_seance).getTime() - new Date(a.date_seance).getTime()
      );
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });


  const activeSessionIds = (activeSessions ?? []).map((s: any) => s.id);

  // Fetch pending bilan tests pour toutes les séances visibles aujourd'hui / en cours
  const { data: pendingTests } = useQuery({
    queryKey: ["eleve-bilans-tests", user?.id, activeSessionIds.join(",")],
    queryFn: async () => {
      if (activeSessionIds.length === 0) return [];
      const { data: tests, error } = await supabase
        .from("bilan_tests")
        .select("id, nb_questions, competences_couvertes, created_at, session:sessions(titre, date_seance, group_id)")
        .eq("statut", "envoye")
        .in("session_id", activeSessionIds)
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
    enabled: !!user?.id && activeSessionIds.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });


  const uncompletedTests = (pendingTests ?? []).filter((t: any) => !t.completed);

  // Exercices de toutes les séances visibles aujourd'hui / en cours
  const { data: sessionExercises, isLoading: loadingSessionEx } = useQuery({
    queryKey: ["eleve-session-exercises", user?.id, activeSessionIds.join(",")],
    queryFn: async () => {
      if (activeSessionIds.length === 0) return [];

      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("session_id, exercice_id, updated_at")
        .in("session_id", activeSessionIds)
        .eq("statut", "traite_en_classe" as any)
        .or(`eleve_id.is.null,eleve_id.eq.${user!.id}`);
      if (!seLinks?.length) return [];

      const exerciceIds = [...new Set(seLinks.map((se: any) => se.exercice_id))];
      const { data: resultats } = await supabase
        .from("resultats")
        .select("exercice_id")
        .eq("eleve_id", user!.id)
        .in("exercice_id", exerciceIds);
      const doneExIds = new Set((resultats ?? []).map((r) => r.exercice_id));

      return (activeSessions ?? [])
        .map((session: any) => {
          const links = seLinks.filter((se: any) => se.session_id === session.id);
          const total = links.length;
          const done = links.filter((se: any) => doneExIds.has(se.exercice_id)).length;
          return {
            sessionId: session.id,
            titre: session.titre,
            date_seance: session.date_seance,
            group_nom: session.group?.nom || "",
            total,
            done,
            remaining: total - done,
          };
        })
        .filter((s: any) => s.remaining > 0);
    },
    enabled: !!user?.id && activeSessionIds.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
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

      {/* Greeting — au-dessus des tabs */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0b234a]">
            Bienvenue{user?.user_metadata?.prenom ? `, ${user.user_metadata.prenom}` : ""} 👋
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">Ton espace de préparation au TCF IRN</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await qc.invalidateQueries();
            toast.success("Actualisé !");
          }}
          className="shrink-0"
        >
          🔄 Rafraîchir
        </Button>
      </div>


      {/* Tab navigation — texte seul, sans icônes */}
      <div className="flex gap-2 border-b border-black/5 pb-0">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 text-[15px] font-bold border-b-[3px] transition-colors ${
            activeTab === "dashboard"
              ? "border-[#0b234a] text-[#0b234a]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mon espace
        </button>
        <button
          onClick={() => setActiveTab("fiches")}
          className={`px-4 py-2 text-[15px] font-bold border-b-[3px] transition-colors ${
            activeTab === "fiches"
              ? "border-[#0b234a] text-[#0b234a]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mes fiches
        </button>
      </div>

      {activeTab === "fiches" ? (
        <MesFichesTab />
      ) : (
      <>

      {/* CARTE PRIORITAIRE — test non fait — icône centrée */}
      {!testLoading && !testCompleted && (
        <div className="cap-card cap-primary-gradient rounded-2xl p-6 text-center space-y-5">
          <h3 className="font-bold text-white text-xl leading-tight">
            Évalue ton niveau d'abord
          </h3>
          <div className="flex justify-center py-2">
            <Target className="h-20 w-20 text-[#f47b20]" strokeWidth={2} />
          </div>
          <button
            className="w-full cap-orange-button py-4 text-base"
            onClick={() => navigate("/eleve/test-positionnement")}
          >
            Commencer le test
          </button>
        </div>
      )}

      {user?.id && <TrajectoireTCF eleveId={user.id} />}

      {/* SECTION AUJOURD'HUI — grille 2 colonnes carrées */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
          Aujourd'hui
        </p>
        {(uncompletedTests.length > 0 || (sessionExercises && sessionExercises.length > 0)) ? (
          <div className="grid grid-cols-2 gap-3">
            {uncompletedTests.map((test: any) => (
              <div
                key={test.id}
                className="flex flex-col items-start gap-3 p-5 rounded-2xl bg-[#e5edff] hover:bg-[#d6e3ff] transition-colors cursor-pointer min-h-[120px]"
                onClick={() => navigate(`/eleve/bilan-test/${test.id}`)}
              >
                <div className="h-12 w-12 rounded-full bg-white/60 flex items-center justify-center">
                  <ClipboardCheck className="h-6 w-6 text-[#2b6cb0]" />
                </div>
                <p className="font-bold text-[15px] leading-snug text-[#0b234a]">Test de bilan</p>
              </div>
            ))}
            {sessionExercises && sessionExercises.map((se: any) => (
              <div
                key={se.sessionId}
                className="flex flex-col items-start gap-3 p-5 rounded-2xl bg-[#def5e4] hover:bg-[#cbf0d5] transition-colors cursor-pointer min-h-[120px]"
                onClick={() => navigate(`/eleve/exercices-seance/${se.sessionId}`)}
              >
                <div className="h-12 w-12 rounded-full bg-white/60 flex items-center justify-center">
                  <Pencil className="h-6 w-6 text-[#2f855a]" />
                </div>
                <p className="font-bold text-[15px] leading-snug text-[#0b234a]">Exercices de séance</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Aucune séance aujourd'hui</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ton prochain contenu apparaîtra ici.</p>
          </div>
        )}
      </div>

      {/* SECTION MA PROGRESSION */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
          Ma progression
        </p>
        <Card className="shadow-sm">
          <CardContent className="pt-5">
            {testLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : progressionData ? (
              <div className="space-y-5">
                {progressionData.map((comp) => (
                  <CompetencyGauge key={comp.label} {...comp} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <TrendingUp className="h-8 w-8 text-success" />
                </div>
                <p className="font-semibold text-foreground">Ta progression apparaîtra ici</p>
                <p className="text-sm text-muted-foreground mt-1">Commence par le test de niveau</p>
                <Button
                  className="mt-4 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={() => navigate("/eleve/test-positionnement")}
                >
                  Passer le test →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION MES OUTILS */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
          Mes outils
        </p>
        <Card
          className="cursor-pointer hover:bg-muted/30 transition-colors shadow-sm"
          onClick={() => navigate("/eleve/devoirs")}
        >
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Mes devoirs</p>
                <p className="text-xs text-muted-foreground">Retrouve tous tes devoirs assignés</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-muted/30 transition-colors shadow-sm"
          onClick={() => navigate("/eleve/historique")}
        >
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <History className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Mon historique</p>
                <p className="text-xs text-muted-foreground">Interventions reçues et évolution de niveau</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Join group */}
      <JoinGroupCard />
      </>
      )}
    </div>
  );
};

export default EleveDashboard;
