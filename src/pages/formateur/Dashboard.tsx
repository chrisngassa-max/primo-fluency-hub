import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, Calendar, Bell, Clock, TrendingUp, CheckCircle2, Pause, ArrowUpCircle, Play, Printer, Eye, UserPlus, AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import PacingTracker from "@/components/PacingTracker";

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

  // ─── All alerts for Centre d'Alertes tab ───
  const { data: allAlerts = [], isLoading: loadingAllAlerts } = useQuery({
    queryKey: ["all-alerts", user?.id],
    queryFn: async () => {
      const { data: alertes } = await supabase
        .from("alertes")
        .select("id, message, eleve_id, type, created_at, is_resolved, is_read")
        .eq("formateur_id", user!.id)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!alertes?.length) return [];
      const eleveIds = [...new Set(alertes.map((a) => a.eleve_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nom, prenom")
        .in("id", eleveIds);
      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, `${p.prenom} ${p.nom}`]));
      return alertes.map((a) => ({
        ...a,
        eleve_nom: nameMap[a.eleve_id] || "Élève",
      }));
    },
    enabled: !!user,
  });

  // ─── Groups list for "Mes Groupes" tab ───
  const { data: groupsList = [], isLoading: loadingGroupsList } = useQuery({
    queryKey: ["dashboard-groups-list", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (!groups?.length) return [];
      const groupIds = groups.map((g) => g.id);
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, group_id")
        .in("group_id", groupIds);
      const eleveIds = [...new Set((members ?? []).map((m) => m.eleve_id))];
      let profilesMap: Record<string, { nom: string; prenom: string }> = {};
      let profilsMap: Record<string, number> = {};
      if (eleveIds.length > 0) {
        const [{ data: profiles }, { data: profils }] = await Promise.all([
          supabase.from("profiles").select("id, nom, prenom").in("id", eleveIds),
          supabase.from("profils_eleves").select("eleve_id, taux_reussite_global").in("eleve_id", eleveIds),
        ]);
        (profiles ?? []).forEach((p) => { profilesMap[p.id] = p; });
        (profils ?? []).forEach((p) => { profilsMap[p.eleve_id] = Number(p.taux_reussite_global) || 0; });
      }
      return groups.map((g) => {
        const gMembers = (members ?? []).filter((m) => m.group_id === g.id);
        return {
          ...g,
          members: gMembers.map((m) => ({
            eleve_id: m.eleve_id,
            nom: profilesMap[m.eleve_id] ? `${profilesMap[m.eleve_id].prenom} ${profilesMap[m.eleve_id].nom}` : "Élève",
            progression: profilsMap[m.eleve_id] ?? 0,
          })),
        };
      });
    },
    enabled: !!user,
  });

  // Session exercises count for next session
  const nextSession = upcomingSessions[0] || null;
  const { data: nextSessionExercises = 0 } = useQuery({
    queryKey: ["next-session-exercises", nextSession?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("session_exercices")
        .select("*", { count: "exact", head: true })
        .eq("session_id", nextSession!.id);
      return count ?? 0;
    },
    enabled: !!nextSession,
  });

  // Progression alerts
  const { data: progressionAlerts = [] } = useQuery({
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
        const parts = (a.message || "").split("|");
        const competence = parts.length >= 2 ? parts[1] : "CE";
        const niveauActuel = parts.length >= 3 ? parseInt(parts[2]) || 3 : 3;
        const niveauPropose = parts.length >= 4 ? parseInt(parts[3]) || 4 : niveauActuel + 1;
        return { id: a.id, eleve_id: a.eleve_id, eleve_nom: nameMap[a.eleve_id] || "Élève", competence, niveau_actuel: niveauActuel, niveau_propose: niveauPropose };
      });
    },
    enabled: !!user,
  });

  const handleValidateProgression = async (alertId: string, eleveId: string, competence: string, niveauPropose: number) => {
    try {
      const { error: levelError } = await supabase
        .from("student_competency_levels")
        .upsert({ eleve_id: eleveId, competence: competence as any, niveau_actuel: niveauPropose, validated_at: new Date().toISOString(), validated_by: user!.id, updated_at: new Date().toISOString() }, { onConflict: "eleve_id,competence" });
      if (levelError) throw levelError;
      const { error: alertError } = await supabase.from("alertes").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", alertId);
      if (alertError) throw alertError;
      qc.invalidateQueries({ queryKey: ["progression-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      toast.success(`Niveau ${niveauPropose} validé en ${COMPETENCE_LABELS[competence] || competence} !`);
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handlePauseProgression = async (alertId: string) => {
    try {
      const { error } = await supabase.from("alertes").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", alertId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["progression-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      toast.info("Progression mise en pause — l'élève reste au niveau actuel.");
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handleMarkRead = async (alertId: string) => {
    try {
      const { error } = await supabase.from("alertes").update({ is_read: true }).eq("id", alertId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      toast.success("Alerte marquée comme lue.");
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase.from("alertes").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", alertId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      toast.success("Alerte résolue.");
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const isLoading = loadingGroups || loadingEleves || loadingSessions || loadingAlertes;

  const ALERT_TYPE_LABELS: Record<string, string> = {
    score_risque: "Score à risque",
    absence: "Absence détectée",
    devoir_expire: "Devoir expiré",
    tendance_baisse: "Tendance en baisse",
    progression: "Progression",
  };

  const ALERT_TYPE_COLORS: Record<string, string> = {
    score_risque: "bg-destructive/10 text-destructive border-destructive/30",
    absence: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800",
    devoir_expire: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
    tendance_baisse: "bg-destructive/10 text-destructive border-destructive/30",
    progression: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
  };

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

      {/* ─── KPI Cards (Clickable) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
          onClick={() => navigate("/formateur/groupes")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Groupes actifs</p>
                {isLoading ? <Skeleton className="h-9 w-16 mt-1" /> : <p className="text-3xl font-bold mt-1">{groupCount}</p>}
              </div>
              <Users className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500"
          onClick={() => navigate("/formateur/groupes")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Élèves inscrits</p>
                {isLoading ? <Skeleton className="h-9 w-16 mt-1" /> : <p className="text-3xl font-bold mt-1">{eleveCount}</p>}
              </div>
              <GraduationCap className="h-8 w-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prochaine séance</p>
                {loadingSessions ? (
                  <Skeleton className="h-5 w-32 mt-1" />
                ) : nextSession ? (
                  <p className="text-sm font-medium mt-1 line-clamp-1">{format(new Date(nextSession.date_seance), "d MMM · HH:mm", { locale: fr })}</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Aucune</p>
                )}
              </div>
              <Calendar className="h-8 w-8 text-accent opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive relative"
          onClick={() => {
            const tabEl = document.querySelector('[data-value="alertes"]') as HTMLElement;
            tabEl?.click();
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertes</p>
                {isLoading ? <Skeleton className="h-9 w-16 mt-1" /> : <p className="text-3xl font-bold mt-1">{alertCount}</p>}
              </div>
              <div className="relative">
                <Bell className="h-8 w-8 text-destructive opacity-80" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Progression Alerts Widget ─── */}
      {progressionAlerts.length > 0 && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
              <ArrowUpCircle className="h-5 w-5" />
              Alertes de Progression ({progressionAlerts.length})
            </CardTitle>
            <CardDescription>Élèves prêts à passer au niveau supérieur — Validation requise</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {progressionAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg border border-green-200 dark:border-green-800 bg-card">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/40 shrink-0">
                  <TrendingUp className="h-4 w-4 text-green-700 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{alert.eleve_nom}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">Prêt pour le</span>
                    <DifficultyBadge level={alert.niveau_propose} />
                    <span className="text-xs text-muted-foreground">en {COMPETENCE_LABELS[alert.competence] || alert.competence}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => handleValidateProgression(alert.id, alert.eleve_id, alert.competence, alert.niveau_propose)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valider
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => handlePauseProgression(alert.id)}>
                    <Pause className="h-3.5 w-3.5" /> Maintenir
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── Pacing Tracker (Interactive) ─── */}
      <PacingTracker />

      {/* ─── 3 Tabs: Ma Prochaine Séance / Mes Groupes / Centre d'Alertes ─── */}
      <Tabs defaultValue="prochaine-seance">
        <TabsList>
          <TabsTrigger value="prochaine-seance">Ma Prochaine Séance</TabsTrigger>
          <TabsTrigger value="groupes">Mes Groupes</TabsTrigger>
          <TabsTrigger value="alertes" data-value="alertes">
            Centre d'Alertes
            {alertCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">{alertCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Ma Prochaine Séance ─── */}
        <TabsContent value="prochaine-seance">
          <Card>
            <CardContent className="pt-6">
              {loadingSessions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !nextSession ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">Aucune séance planifiée</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Commencez par créer un groupe, puis planifiez votre première séance.
                  </p>
                  <Button className="mt-4" onClick={() => navigate("/formateur/seances")}>
                    Planifier une séance
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">{nextSession.titre}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(nextSession.date_seance), "EEEE d MMMM yyyy · HH:mm", { locale: fr })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {nextSession.group_nom}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{nextSession.niveau_cible}</Badge>
                      <Badge variant="secondary">{nextSession.duree_minutes} min</Badge>
                    </div>
                  </div>

                  {nextSession.objectifs && (
                    <div className="p-3 rounded-lg bg-muted/40 border">
                      <p className="text-sm text-muted-foreground font-medium mb-1">Objectifs</p>
                      <p className="text-sm text-foreground">{nextSession.objectifs}</p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-muted/40 border">
                    <p className="text-sm text-muted-foreground">
                      <strong>{nextSessionExercises}</strong> exercice{nextSessionExercises !== 1 ? "s" : ""} prévu{nextSessionExercises !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      size="lg"
                      className="gap-2"
                      onClick={() => navigate(`/formateur/seances/${nextSession.id}/pilote`)}
                    >
                      <Play className="h-4 w-4" />
                      Lancer la séance
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/formateur/seances/${nextSession.id}/pilote`)}
                    >
                      <Printer className="h-4 w-4 mr-1.5" />
                      Imprimer
                    </Button>
                  </div>

                  {/* Other upcoming sessions */}
                  {upcomingSessions.length > 1 && (
                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Séances suivantes</p>
                      <div className="space-y-2">
                        {upcomingSessions.slice(1).map((s: any) => (
                          <div
                            key={s.id}
                            onClick={() => navigate(`/formateur/seances/${s.id}/pilote`)}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium text-foreground">{s.titre}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(s.date_seance), "d MMM · HH:mm", { locale: fr })} · {s.group_nom}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{s.niveau_cible}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Mes Groupes ─── */}
        <TabsContent value="groupes">
          <Card>
            <CardContent className="pt-6">
              {loadingGroupsList ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : groupsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">Aucun groupe actif</p>
                  <Button className="mt-4" onClick={() => navigate("/formateur/groupes")}>
                    Créer un groupe
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupsList.map((g: any) => (
                    <div key={g.id} className="rounded-lg border">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => navigate("/formateur/groupes")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{g.nom}</p>
                            <p className="text-xs text-muted-foreground">Niveau {g.niveau} · {g.members.length} élève{g.members.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); navigate("/formateur/groupes"); }}>
                            <UserPlus className="h-3.5 w-3.5" /> Ajouter
                          </Button>
                        </div>
                      </div>
                      {g.members.length > 0 && (
                        <div className="px-4 pb-3 border-t">
                          <div className="space-y-1.5 pt-2">
                            {g.members.map((m: any) => (
                              <div
                                key={m.eleve_id}
                                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                                onClick={() => navigate(`/formateur/eleves/${m.eleve_id}`)}
                              >
                                <span className="text-sm text-foreground">{m.nom}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all"
                                      style={{ width: `${Math.min(m.progression, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(m.progression)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Centre d'Alertes ─── */}
        <TabsContent value="alertes">
          <Card>
            <CardContent className="pt-6">
              {loadingAllAlerts ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : allAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">Aucune alerte active</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Tous vos élèves progressent normalement. 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allAlerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        alert.is_read ? "bg-muted/20 opacity-70" : "bg-card"
                      }`}
                    >
                      <div className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 ${
                        alert.type === "progression" ? "bg-green-100 dark:bg-green-900/40" :
                        alert.type === "score_risque" || alert.type === "tendance_baisse" ? "bg-destructive/10" :
                        "bg-orange-100 dark:bg-orange-900/40"
                      }`}>
                        <AlertTriangle className={`h-4 w-4 ${
                          alert.type === "progression" ? "text-green-700 dark:text-green-400" :
                          alert.type === "score_risque" || alert.type === "tendance_baisse" ? "text-destructive" :
                          "text-orange-600 dark:text-orange-400"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{alert.eleve_nom}</p>
                          <Badge variant="outline" className={`text-[10px] h-5 ${ALERT_TYPE_COLORS[alert.type] || ""}`}>
                            {ALERT_TYPE_LABELS[alert.type] || alert.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alert.message && alert.message.length > 80 ? alert.message.substring(0, 80) + "…" : alert.message || "Alerte système"}
                          {" · "}
                          {format(new Date(alert.created_at), "d MMM HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => navigate(`/formateur/eleves/${alert.eleve_id}`)}>
                          <Eye className="h-3.5 w-3.5" /> Voir
                        </Button>
                        {!alert.is_read && (
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleMarkRead(alert.id)}>
                            Lu
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 text-xs text-destructive" onClick={() => handleResolveAlert(alert.id)}>
                          Résoudre
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FormateurDashboard;
