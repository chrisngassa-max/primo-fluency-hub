import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, GraduationCap, Bell, Calendar, Clock, 
  TrendingUp, AlertTriangle, ChevronRight, CheckCircle2, 
  Play, FileCheck, Send, Activity, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function FormateurDashboardV2() {
  const { user } = useAuth();
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
      const { count } = await supabase.from("alertes")
        .select("*", { count: "exact", head: true })
        .eq("formateur_id", user.id)
        .eq("is_resolved", false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  // (Mock pour la maquette)
  const nextSessionMock = {
    titre: "Groupe Alpha - Niveau A2",
    date: "Aujourd'hui, 14:00",
    duree: "90 minutes",
    eleves: 12,
    objectifs: "Se présenter, parler de ses loisirs et de sa routine quotidienne."
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            Bonjour, {user?.user_metadata?.prenom ?? 'Formateur'} <Sparkles className="h-6 w-6 text-accent" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 capitalize">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden md:flex gap-2 bg-white dark:bg-slate-900">
            <Calendar className="h-4 w-4" />
            Mon Planning
          </Button>
          <Button className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-md">
            <Users className="h-4 w-4" />
            Nouveau Groupe
          </Button>
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
        />
        <KPICard 
          title="Élèves inscrits" 
          value={eleveCount} 
          icon={<GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />} 
          trend="Total"
          bgClass="bg-indigo-50 dark:bg-indigo-950/30"
        />
        <KPICard 
          title="Séances" 
          value="18" 
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} 
          trend="Réalisées"
          bgClass="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KPICard 
          title="Alertes" 
          value={alertCount} 
          icon={<AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />} 
          trend={alertCount > 0 ? "À traiter urgemment" : "Tout va bien"}
          bgClass="bg-rose-50 dark:bg-rose-950/30"
          isAlert={alertCount > 0}
        />
      </div>

      {/* MAIN LAYOUT: 2 COLUMNS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Main Content Tabs */}
        <div className="xl:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <TabsTrigger value="seance-du-jour" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Séance du jour
              </TabsTrigger>
              <TabsTrigger value="progression" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Progression
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seance-du-jour" className="mt-6 space-y-6 outline-none">
              
              {/* Next Session Highlight */}
              <Card className="border-primary/20 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary">
                        {nextSessionMock.date}
                      </Badge>
                      <CardTitle className="text-xl">{nextSessionMock.titre}</CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <Clock className="h-4 w-4" /> {nextSessionMock.duree} • <Users className="h-4 w-4 ml-2" /> {nextSessionMock.eleves} élèves
                      </CardDescription>
                    </div>
                    <Button size="sm" className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Play className="h-4 w-4" /> Démarrer
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div>
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">Objectifs de la séance</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {nextSessionMock.objectifs}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full md:w-auto gap-2">
                      <FileCheck className="h-4 w-4" />
                      Voir les exercices
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="hover:border-primary/40 transition-colors cursor-pointer group">
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
                <Card className="hover:border-primary/40 transition-colors cursor-pointer group">
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
                  Alertes à traiter
                </CardTitle>
                <Badge variant="destructive" className="rounded-full">{alertCount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                {/* Alert Item 1 */}
                <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 p-3 rounded-lg flex gap-3 items-start transition-all hover:shadow-sm cursor-pointer">
                  <div className="mt-0.5 bg-rose-100 dark:bg-rose-900 p-1.5 rounded-md text-rose-600 dark:text-rose-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Baisse de performance</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-medium">Sarah M.</span> a échoué à 3 exercices de suite en Compréhension Orale.
                    </p>
                  </div>
                </div>

                {/* Alert Item 2 */}
                <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50 p-3 rounded-lg flex gap-3 items-start transition-all hover:shadow-sm cursor-pointer">
                  <div className="mt-0.5 bg-orange-100 dark:bg-orange-900 p-1.5 rounded-md text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Absence répétée</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-medium">Ahmed K.</span> est absent pour la 2ème séance consécutive.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function KPICard({ title, value, icon, trend, bgClass, isAlert = false }: any) {
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 hover:shadow-md",
      isAlert ? "border-rose-200 dark:border-rose-900/50" : ""
    )}>
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
