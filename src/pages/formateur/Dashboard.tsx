import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, Calendar, AlertTriangle, Clock, TrendingUp, CheckCircle2, Pause, ArrowUpCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import SkillTree from "@/components/SkillTree";
import { DifficultyBadge } from "@/components/DifficultyBadge";

const COMPETENCE_LABELS: Record<string, string> = {
  CO: "Compréhension Orale",
  CE: "Compréhension Écrite",
  EE: "Expression Écrite",
  EO: "Expression Orale",
  Structures: "Structures",
};

const FormateurDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: groupCount = 0, isLoading: loadingGroups } = useQuery({
    queryKey: ["kpi-groups", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("groups")
        .select("*", { count: "exact", head: true })
        .eq("formateur_id", user!.id)
        .eq("is_active", true);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: eleveCount = 0, isLoading: loadingEleves } = useQuery({
    queryKey: ["kpi-eleves", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id")
        .eq("formateur_id", user!.id);
      if (!groups?.length) return 0;
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .in("group_id", groups.map((g) => g.id));
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: upcomingSessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["kpi-sessions", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id, nom")
        .eq("formateur_id", user!.id);
      if (!groups?.length) return [];
      const { data } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, duree_minutes, niveau_cible, objectifs, statut, group_id")
        .in("group_id", groups.map((g) => g.id))
        .gte("date_seance", new Date().toISOString())
        .order("date_seance", { ascending: true })
        .limit(4);
      const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.nom]));
      return (data ?? []).map((s) => ({ ...s, group_nom: groupMap[s.group_id] || "—" }));
    },
    enabled: !!user,
  });

  const { data: alertCount = 0, isLoading: loadingAlertes } = useQuery({
    queryKey: ["kpi-alertes", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("alertes")
        .select("*", { count: "exact", head: true })
        .eq("formateur_id", user!.id)
        .eq("is_resolved", false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: risqueEleves = [], isLoading: loadingRisque } = useQuery({
    queryKey: ["kpi-risque", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id")
        .eq("formateur_id", user!.id);
      if (!groups?.length) return [];
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id")
        .in("group_id", groups.map((g) => g.id));
      if (!members?.length) return [];
      const eleveIds = [...new Set(members.map((m) => m.eleve_id))];
      const { data: profils } = await supabase
        .from("profils_eleves")
        .select("eleve_id, score_risque, niveau_actuel, taux_reussite_global")
        .in("eleve_id", eleveIds)
        .gte("score_risque", 50)
        .order("score_risque", { ascending: false })
        .limit(5);
      if (!profils?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nom, prenom")
        .in("id", profils.map((p) => p.eleve_id));
      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, `${p.prenom} ${p.nom}`]));
      return profils.map((p) => ({ ...p, nom: nameMap[p.eleve_id] || "Élève" }));
    },
    enabled: !!user,
  });

  // ─── Progression Alerts ───
  const { data: progressionAlerts = [], isLoading: loadingProgression } = useQuery({
    queryKey: ["progression-alerts", user?.id],
    queryFn: async () => {
      const { data: alertes } = await supabase
        .from("alertes")
        .select("id, message, eleve_id, created_at, is_resolved")
        .eq("formateur_id", user!.id)
        .eq("type", "progression" as any)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!alertes?.length) return [];

      const eleveIds = [...new Set(alertes.map((a) => a.eleve_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nom, prenom")
        .in("id", eleveIds);

      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, `${p.prenom} ${p.nom}`]));

      return alertes.map((a) => {
        // Parse structured message: "PROGRESSION|competence|niveau_actuel|niveau_propose"
        const parts = (a.message || "").split("|");
        const competence = parts.length >= 2 ? parts[1] : "CE";
        const niveauActuel = parts.length >= 3 ? parseInt(parts[2]) || 3 : 3;
        const niveauPropose = parts.length >= 4 ? parseInt(parts[3]) || 4 : niveauActuel + 1;
        return {
          id: a.id,
          eleve_id: a.eleve_id,
          eleve_nom: nameMap[a.eleve_id] || "Élève",
          competence,
          niveau_actuel: niveauActuel,
          niveau_propose: niveauPropose,
        };
      });
    },
    enabled: !!user,
  });

  const handleValidateProgression = async (alertId: string, eleveId: string, competence: string, niveauPropose: number) => {
    try {
      // Update student level
      const { error: levelError } = await supabase
        .from("student_competency_levels")
        .upsert({
          eleve_id: eleveId,
          competence: competence as any,
          niveau_actuel: niveauPropose,
          validated_at: new Date().toISOString(),
          validated_by: user!.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "eleve_id,competence" });
      if (levelError) throw levelError;

      // Resolve alert
      const { error: alertError } = await supabase
        .from("alertes")
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", alertId);
      if (alertError) throw alertError;

      qc.invalidateQueries({ queryKey: ["progression-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      toast.success(`Niveau ${niveauPropose} validé en ${COMPETENCE_LABELS[competence] || competence} !`);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handlePauseProgression = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("alertes")
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["progression-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      toast.info("Progression mise en pause — l'élève reste au niveau actuel.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const isLoading = loadingGroups || loadingEleves || loadingSessions || loadingAlertes;

  const kpis = [
    { label: "Groupes actifs", value: groupCount, icon: Users, color: "text-primary" },
    { label: "Élèves inscrits", value: eleveCount, icon: GraduationCap, color: "text-green-600" },
    { label: "Séances à venir", value: upcomingSessions.length, icon: Calendar, color: "text-accent" },
    { label: "Alertes non résolues", value: alertCount, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bonjour, {user?.user_metadata?.prenom || "Formateur"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre activité pédagogique.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  )}
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Progression Alerts Widget ─── */}
      {progressionAlerts.length > 0 && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
              <ArrowUpCircle className="h-5 w-5" />
              Alertes de Progression ({progressionAlerts.length})
            </CardTitle>
            <CardDescription>
              Élèves prêts à passer au niveau supérieur — Validation requise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {progressionAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800 bg-card">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/40 shrink-0">
                  <TrendingUp className="h-4 w-4 text-green-700 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {alert.eleve_nom}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Prêt pour le
                    </span>
                    <DifficultyBadge level={alert.niveau_propose} />
                    <span className="text-xs text-muted-foreground">
                      en {COMPETENCE_LABELS[alert.competence] || alert.competence}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => handleValidateProgression(alert.id, alert.eleve_id, alert.competence, alert.niveau_propose)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Valider
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => handlePauseProgression(alert.id)}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Maintenir
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="seances">
        <TabsList>
          <TabsTrigger value="seances">Séances à venir</TabsTrigger>
          <TabsTrigger value="risque">Élèves à risque</TabsTrigger>
          <TabsTrigger value="skilltree">Progression détaillée</TabsTrigger>
        </TabsList>

        <TabsContent value="seances">
          <Card>
            <CardContent className="pt-6">
              {loadingSessions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : upcomingSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">Aucune séance planifiée</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Commencez par créer un groupe, puis planifiez votre première séance.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map((s: any) => (
                    <div
                      key={s.id}
                      onClick={() => navigate(`/formateur/seances/${s.id}/pilote`)}
                      className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{s.titre}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(s.date_seance), "d MMM yyyy · HH:mm", { locale: fr })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {s.group_nom}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{s.niveau_cible}</Badge>
                        <Badge variant="secondary">{s.duree_minutes} min</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risque">
          <Card>
            <CardContent className="pt-6">
              {loadingRisque ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : risqueEleves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">Aucun élève à risque</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Tous vos élèves progressent normalement. 🎉
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {risqueEleves.map((e: any) => (
                    <div
                      key={e.eleve_id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <p className="font-medium text-foreground">{e.nom}</p>
                        <p className="text-sm text-muted-foreground">
                          Niveau {e.niveau_actuel} · Réussite globale {Math.round(e.taux_reussite_global)}%
                        </p>
                      </div>
                      <Badge variant={e.score_risque >= 70 ? "destructive" : "secondary"}>
                        Risque {Math.round(e.score_risque)}/100
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skilltree">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Arborescence TCF — Skill Tree</CardTitle>
            </CardHeader>
            <CardContent>
              <SkillTree />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FormateurDashboard;
