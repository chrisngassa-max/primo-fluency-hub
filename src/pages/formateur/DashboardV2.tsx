import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, GraduationCap, Bell, Calendar,
  TrendingUp, AlertTriangle, ChevronRight, CheckCircle2, 
  Send, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { countLearnersWithAlerts, dedupeAlertsByLearner } from "@/lib/activeAlerts";

const formatSessionTimeRange = (session: any) => {
  if (!session?.date_seance) return "À planifier";
  const start = new Date(session.date_seance);
  const end = new Date(start.getTime() + Number(session.duree_minutes || 180) * 60000);
  return `${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function FormateurDashboardV2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("seance-du-jour");

  // --- 1. BRANCHEMENT DES DONNÉES SUPABASE (KPIs réels) ---
  const { data: groupCount = 0 } = useQuery({
    queryKey: ["kpi-groups", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from("groups")
        .select("*", { count: "exact", head: true })
        .eq("formateur_id", user.id)
        .eq("is_active", true);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: eleveCount = 0 } = useQuery({
    queryKey: ["kpi-eleves", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: groups } = await supabase.from("groups").select("id").eq("formateur_id", user.id);
      if (!groups?.length) return 0;
      const { count } = await supabase.from("group_members")
        .select("*", { count: "exact", head: true })
        .in("group_id", groups.map(g => g.id));
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["kpi-alertes", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase.from("alertes")
        .select("id, eleve_id")
        .eq("formateur_id", user.id)
        .eq("is_resolved", false);
      return countLearnersWithAlerts(data ?? []);
    },
    enabled: !!user,
  });

  const { data: sessionCount = 0 } = useQuery({
    queryKey: ["kpi-sessions-total", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: groups } = await supabase.from("groups").select("id").eq("formateur_id", user.id);
      if (!groups?.length) return 0;
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .in("group_id", groups.map((g) => g.id));
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: nextSessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["dashboard-v2-next-sessions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: groups } = await supabase.from("groups").select("id, nom").eq("formateur_id", user.id);
      if (!groups?.length) return [];
      const groupIds = groups.map((g) => g.id);
      const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.nom]));
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, duree_minutes, niveau_cible, objectifs, statut, group_id")
        .in("group_id", groupIds)
        .gte("date_seance", sixHoursAgo)
        .not("statut", "in", "(terminee,annulee)")
        .order("date_seance", { ascending: true })
        .limit(3);
      return (data ?? []).map((session) => ({ ...session, group_nom: groupMap[session.group_id] || "—" }));
    },
    enabled: !!user,
  });

  const nextSession = nextSessions[0] ?? null;
  const canOpenSession = nextSession && !["terminee", "annulee"].includes(nextSession.statut);

  const { data: sessionExercises = [] } = useQuery({
    queryKey: ["dashboard-v2-session-exercises", nextSession?.id],
    queryFn: async () => {
      if (!nextSession) return [];
      const { data: links } = await supabase
        .from("session_exercices")
        .select("id, ordre, statut, exercice_id")
        .eq("session_id", nextSession.id)
        .order("ordre");
      if (!links?.length) return [];
      const { data: exercices } = await supabase
        .from("exercices")
        .select("id, titre, competence")
        .in("id", links.map((link) => link.exercice_id));
      const exerciseMap = Object.fromEntries((exercices ?? []).map((exercise) => [exercise.id, exercise]));
      return links
        .map((link) => ({ sessionExerciceId: link.id, ordre: link.ordre, statut: link.statut, ...exerciseMap[link.exercice_id] }))
        .filter((exercise: any) => exercise.titre);
    },
    enabled: !!nextSession,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-v2-alerts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: alertes } = await supabase
        .from("alertes")
        .select("id, message, eleve_id, type, created_at")
        .eq("formateur_id", user.id)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!alertes?.length) return [];
      const learnerAlerts = dedupeAlertsByLearner(alertes).slice(0, 8);
      const eleveIds = [...new Set(learnerAlerts.map((alert) => alert.eleve_id).filter(Boolean))];
      const { data: profiles } = eleveIds.length
        ? await supabase.from("profiles").select("id, nom, prenom").in("id", eleveIds)
        : { data: [] as any[] };
      const profileMap = Object.fromEntries((profiles ?? []).map((profile: any) => [profile.id, `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim()]));
      return learnerAlerts.map((alert) => ({ ...alert, eleve_nom: profileMap[alert.eleve_id] || "Élève" }));
    },
    enabled: !!user,
  });

  const openSession = () => {
    if (canOpenSession) {
      navigate(`/formateur/seances/${nextSession.id}/pilote`);
      return;
    }
    navigate("/formateur/seances?new=1");
  };

  const handleSendExercises = async () => {
    if (!nextSession) {
      navigate("/formateur/seances?new=1");
      return;
    }
    if (sessionExercises.length === 0) {
      toast.warning("Aucun exercice prêt à envoyer pour cette séance.");
      navigate(`/formateur/seances/${nextSession.id}/pilote`);
      return;
    }
    const ids = sessionExercises.map((exercise: any) => exercise.sessionExerciceId);
    const { error } = await supabase
      .from("session_exercices")
      .update({ statut: "traite_en_classe" as any, is_sent: true, updated_at: new Date().toISOString() } as any)
      .in("id", ids);
    if (error) {
      toast.error("Erreur d'envoi", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["dashboard-v2-session-exercises"] });
    toast.success(`${sessionExercises.length} exercice(s) envoyé(s) aux élèves.`);
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] md:text-3xl font-extrabold tracking-tight text-[#0b234a] flex items-center gap-2">
              Bonjour, {user?.user_metadata?.prenom ?? 'Claire'}
            </h1>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 shadow-none font-medium px-3 rounded-full flex items-center gap-1.5">
              Séance en cours <span className="h-2 w-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
            </Badge>
          </div>
          <p className="text-[#0b234a]/70 font-medium mt-1 capitalize text-lg">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden md:flex gap-2 bg-white cap-card border-none" onClick={() => navigate("/formateur/seances")}>
            <Calendar className="h-4 w-4" />
            Mon Planning
          </Button>
          <button className="cap-orange-button px-5 py-2.5 text-sm flex items-center gap-2" onClick={() => navigate("/formateur/groupes?new=1")}>
            <Users className="h-4 w-4" />
            Nouveau Groupe
          </button>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard 
          title="Groupes Actifs" 
          value={groupCount} 
          icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />} 
          trend="En cours"
          bgClass="bg-blue-50 dark:bg-blue-950/30"
          onClick={() => navigate("/formateur/groupes")}
        />
        <KPICard 
          title="Élèves inscrits" 
          value={eleveCount} 
          icon={<GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />} 
          trend="Total"
          bgClass="bg-indigo-50 dark:bg-indigo-950/30"
          onClick={() => navigate("/formateur/groupes?tab=eleves")}
        />
        <KPICard 
          title="Séances" 
          value={sessionCount} 
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} 
          trend="Total"
          bgClass="bg-emerald-50 dark:bg-emerald-950/30"
          onClick={() => navigate("/formateur/seances")}
        />
        <KPICard 
          title="Élèves à accompagner"
          value={alertCount} 
          icon={<AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />} 
          trend={alertCount > 0 ? "Une priorité par élève" : "Tout va bien"}
          bgClass="bg-rose-50 dark:bg-rose-950/30"
          isAlert={alertCount > 0}
          onClick={() => navigate("/formateur/monitoring")}
        />
      </div>

      {/* MAIN LAYOUT: 2 COLUMNS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Main Content Tabs */}
        <div className="xl:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full justify-start gap-4 p-0 bg-transparent h-auto border-b border-black/5 mb-6">
              <TabsTrigger 
                value="seance-du-jour" 
                className="rounded-none bg-transparent px-1 py-3 text-[16px] font-bold text-slate-500 data-[state=active]:border-b-[3px] data-[state=active]:border-[#0b234a] data-[state=active]:text-[#0b234a] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Séance du jour
              </TabsTrigger>
              <TabsTrigger 
                value="progression" 
                className="rounded-none bg-transparent px-1 py-3 text-[16px] font-bold text-slate-500 data-[state=active]:border-b-[3px] data-[state=active]:border-[#0b234a] data-[state=active]:text-[#0b234a] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Progression
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seance-du-jour" className="mt-6 space-y-6 outline-none">
              
              {/* Next Session Highlight (Conforme Maquette) */}
              <div className="cap-card cap-primary-gradient rounded-2xl p-6 text-white mb-6">
                <h3 className="font-bold text-xl mb-1 flex items-center gap-2">
                  {nextSession ? "Séance active:" : "Séance à planifier"} <span className="font-medium opacity-90">{nextSession?.titre ?? "Aucune séance prévue"}</span>
                </h3>
                <p className="text-white/80 font-medium mb-1">Groupe: <span className="font-normal opacity-90">{nextSession?.group_nom ?? "—"}</span></p>
                <p className="text-white/80 font-medium mb-5">Horaire: <span className="font-normal opacity-90">{formatSessionTimeRange(nextSession)}</span></p>
                
                <button className="w-full cap-orange-button py-3 text-lg tracking-wide" onClick={openSession}>
                  {loadingSessions ? "Chargement…" : nextSession ? "Piloter" : "Planifier une séance"}
                </button>
              </div>

              {/* Liste d'exercices de la séance */}
              <div className="space-y-3 mb-6">
                {sessionExercises.length === 0 ? (
                  <button className="cap-card p-4 w-full text-left hover:border-primary/30 transition-colors" onClick={openSession}>
                    <span className="font-semibold text-[#0b234a] text-[15px]">Aucun exercice rattaché — ouvrir la séance</span>
                    <ChevronRight className="h-4 w-4 float-right text-slate-400" />
                  </button>
                ) : sessionExercises.slice(0, 5).map((exercise: any, index: number) => (
                  <button key={exercise.sessionExerciceId} className="cap-card p-4 w-full flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors text-left" onClick={openSession}>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-5 w-5 rounded border-2 bg-white", exercise.statut === "traite_en_classe" ? "border-emerald-400" : "border-slate-300")}></div>
                      <span className="font-semibold text-[#0b234a] text-[15px]">Exercice {index + 1}: {exercise.titre}</span>
                    </div>
                    <Badge className="bg-primary hover:bg-primary text-primary-foreground border-none rounded-full px-2.5 font-bold">{exercise.competence === "Structures" ? "ST" : exercise.competence}</Badge>
                  </button>
                ))}
              </div>
              
              <button className="w-full cap-orange-button py-4 text-lg mb-8" onClick={openSession}>
                Générer des devoirs automatiques
              </button>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="hover:border-primary/40 transition-colors cursor-pointer group" onClick={handleSendExercises}>
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium">Envoyer les exercices</h4>
                      <p className="text-xs text-slate-500 mt-1">Rendre visible les exercices de la séance aux élèves.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer group" onClick={() => navigate(nextSession ? `/formateur/suivi-direct?session=${nextSession.id}` : "/formateur/suivi-direct")}>
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-medium">Suivi en direct</h4>
                      <p className="text-xs text-slate-500 mt-1">Voir la progression des élèves en temps réel.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="progression" className="mt-6 outline-none">
              <Card>
                <CardHeader>
                  <CardTitle>Aperçu de la progression globale</CardTitle>
                  <CardDescription>Moyenne des compétences par groupe</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Compréhension Orale</span>
                        <span className="text-primary">68%</span>
                      </div>
                      <Progress value={68} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Compréhension Écrite</span>
                        <span className="text-primary">75%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Expression Orale</span>
                        <span className="text-orange-500">42%</span>
                      </div>
                      <Progress value={42} className="h-2 [&>div]:bg-orange-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT COLUMN: Alerts & Notifications */}
        <div className="space-y-6">
          <Card className="border-rose-100 dark:border-rose-900/30">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-rose-500" />
                  Élèves à accompagner
                </CardTitle>
                <Badge variant="destructive" className="rounded-full">{alertCount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                {alerts.length === 0 ? (
                  <button className="w-full text-left bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-lg transition-all hover:shadow-sm" onClick={() => navigate("/formateur/monitoring")}>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Aucune alerte active</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Ouvrir le monitoring pédagogique.</p>
                  </button>
                ) : alerts.map((alert: any) => (
                  <button key={alert.id} className="w-full text-left bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 p-3 rounded-lg flex gap-3 items-start transition-all hover:shadow-sm cursor-pointer" onClick={() => navigate(alert.eleve_id ? `/formateur/eleves/${alert.eleve_id}` : "/formateur/monitoring")}>
                    <div className="mt-0.5 bg-rose-100 dark:bg-rose-900 p-1.5 rounded-md text-rose-600 dark:text-rose-400">
                      {alert.type === "tendance_baisse" ? <TrendingUp className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{alert.eleve_nom}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{alert.message || "Alerte pédagogique"}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function KPICard({ title, value, icon, trend, bgClass, isAlert = false, onClick }: any) {
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 hover:shadow-md",
      onClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : "",
      isAlert ? "border-rose-200 dark:border-rose-900/50" : ""
    )} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={(event) => {
      if (onClick && (event.key === "Enter" || event.key === " ")) onClick();
    }}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
          </div>
          <div className={cn("p-2.5 rounded-xl", bgClass)}>
            {icon}
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs">
          <span className={cn(
            "font-medium",
            isAlert ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {trend}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
