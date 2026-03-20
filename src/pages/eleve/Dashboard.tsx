import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, TrendingUp, AlertCircle, ArrowRight, Target, ClipboardCheck, Calendar, BarChart2 } from "lucide-react";
import CompetenceLabel from "@/components/CompetenceLabel";
import EleveOnboarding, { useShowOnboarding } from "@/components/EleveOnboarding";
import JoinGroupCard from "@/components/JoinGroupCard";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const EleveDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, dismissOnboarding] = useShowOnboarding();

  // Check if student already passed the test
  const { data: testEntree, isLoading: testLoading } = useQuery({
    queryKey: ["eleve-test-entree", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests_entree")
        .select("*")
        .eq("eleve_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const testCompleted = testEntree && !testEntree.en_cours && testEntree.completed_at;

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

  // Fetch completed sessions that have exercises the student hasn't done a bilan on
  const { data: pendingBilans, isLoading: bilansLoading } = useQuery({
    queryKey: ["eleve-bilans", user?.id],
    queryFn: async () => {
      // Get student's groups
      const { data: memberships, error: mErr } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("eleve_id", user!.id);
      if (mErr) throw mErr;
      if (!memberships || memberships.length === 0) return [];

      const groupIds = memberships.map((m) => m.group_id);

      // Get completed sessions from student's groups
      const { data: sessions, error: sErr } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id")
        .in("group_id", groupIds)
        .eq("statut", "terminee")
        .order("date_seance", { ascending: false })
        .limit(10);
      if (sErr) throw sErr;
      if (!sessions || sessions.length === 0) return [];

      // For each session, check if there are exercises traite_en_classe
      const sessionIds = sessions.map((s) => s.id);
      const { data: sessionExercices, error: seErr } = await supabase
        .from("session_exercices")
        .select("session_id, exercice_id")
        .in("session_id", sessionIds)
        .eq("statut", "traite_en_classe" as any);
      if (seErr) throw seErr;

      if (!sessionExercices || sessionExercices.length === 0) return [];

      // Check which exercises the student already has results for
      const allExIds = sessionExercices.map((se) => se.exercice_id);
      const { data: doneResults, error: rErr } = await supabase
        .from("resultats")
        .select("exercice_id")
        .eq("eleve_id", user!.id)
        .in("exercice_id", allExIds);
      if (rErr) throw rErr;

      const doneSet = new Set((doneResults ?? []).map((r) => r.exercice_id));

      // Build pending bilans: sessions that have at least 1 un-done exercise
      const pendingSessions: { id: string; titre: string; date_seance: string; exerciceCount: number }[] = [];
      for (const session of sessions) {
        const exsForSession = sessionExercices.filter((se) => se.session_id === session.id);
        const pendingCount = exsForSession.filter((se) => !doneSet.has(se.exercice_id)).length;
        if (pendingCount > 0) {
          pendingSessions.push({
            id: session.id,
            titre: session.titre,
            date_seance: session.date_seance,
            exerciceCount: pendingCount,
          });
        }
      }

      return pendingSessions;
    },
    enabled: !!user?.id,
  });

  // Fetch pending bilan tests (AI-generated tests sent by formateur)
  const { data: pendingTests } = useQuery({
    queryKey: ["eleve-bilans-tests", user?.id],
    queryFn: async () => {
      const { data: tests, error } = await supabase
        .from("bilan_tests" as any)
        .select("id, nb_questions, competences_couvertes, session:sessions(titre, date_seance)")
        .eq("statut", "envoye")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!tests || tests.length === 0) return [];
      const testIds = (tests as any[]).map((t: any) => t.id);
      const { data: done } = await supabase
        .from("bilan_test_results" as any)
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
    enabled: !!user?.id,
  });

  const uncompletedTests = (pendingTests ?? []).filter((t: any) => !t.completed);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {showOnboarding && <EleveOnboarding onComplete={dismissOnboarding} />}

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenue, {user?.user_metadata?.prenom || "Élève"} 👋
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
                  Commencez par évaluer votre niveau
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Passez le test de positionnement (10 min) pour que TCF Pro adapte votre
                  programme à votre niveau réel.
                </p>
                <Button
                  className="mt-3 gap-2"
                  onClick={() => navigate("/eleve/test-entree")}
                >
                  Commencer le test de niveau
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending AI bilan tests from formateur */}
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
              Votre formateur vous a envoyé un test pour valider vos acquis de séance.
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
                <Button size="sm" variant="default" className="gap-1 shrink-0">
                  Commencer le test <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending session bilans */}
      {!bilansLoading && pendingBilans && pendingBilans.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Bilans de séance à compléter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Validez vos acquis en passant le bilan des exercices réalisés en classe.
            </p>
            {pendingBilans.map((bilan) => (
              <div
                key={bilan.id}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/eleve/bilan/${bilan.id}`)}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{bilan.titre}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(bilan.date_seance), "d MMMM yyyy", { locale: fr })}
                    <span>·</span>
                    <span>{bilan.exerciceCount} exercice(s)</span>
                  </div>
                </div>
                <Button size="sm" variant="default" className="gap-1 shrink-0">
                  Passer le bilan <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Global progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Progression globale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Niveau estimé</span>
              <Badge variant="secondary">
                {testCompleted ? testEntree.niveau_estime || "Non évalué" : "Non évalué"}
              </Badge>
            </div>
            <Progress
              value={testCompleted ? (testEntree.score_global ?? 0) : 0}
              className={`h-3 ${testCompleted ? "" : "[&>div]:bg-muted"}`}
            />
            {!testCompleted && (
              <p className="text-xs text-muted-foreground">
                Passez le test d'entrée pour évaluer votre niveau initial.
              </p>
            )}
          </div>
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
                            Remédiation
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs border-orange-500/30 text-orange-600"
                          >
                            Consolidation
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
              <p className="text-muted-foreground font-medium">Aucun devoir en attente</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Les devoirs apparaîtront ici après vos séances.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Join group */}
      <JoinGroupCard />
    </div>
  );
};

export default EleveDashboard;
