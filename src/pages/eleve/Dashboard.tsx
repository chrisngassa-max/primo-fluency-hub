import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, TrendingUp, AlertCircle, ArrowRight, Target } from "lucide-react";
import CompetenceLabel from "@/components/CompetenceLabel";
import EleveOnboarding, { useShowOnboarding } from "@/components/EleveOnboarding";
import JoinGroupCard from "@/components/JoinGroupCard";

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

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {showOnboarding && <EleveOnboarding onComplete={dismissOnboarding} />}

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bienvenue, {user?.user_metadata?.prenom || "Élève"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Votre espace de préparation au TCF Pro.</p>
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
                const daysLeft = Math.max(
                  0,
                  Math.ceil((new Date(d.date_echeance).getTime() - Date.now()) / 86400000)
                );
                return (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
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
                        <span className="text-sm text-muted-foreground">
                          {daysLeft === 0 ? "Aujourd'hui !" : `${daysLeft} jour(s) restant(s)`}
                        </span>
                      </div>
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
