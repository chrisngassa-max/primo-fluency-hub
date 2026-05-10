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
          <Button variant="outline" className="hidden md:flex gap-2 bg-white cap-card border-none">
            <Calendar className="h-4 w-4" />
            Mon Planning
          </Button>
          <button className="cap-orange-button px-5 py-2.5 text-sm flex items-center gap-2">
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
                  Séance active: <span className="font-medium opacity-90">{nextSessionMock.titre}</span>
                </h3>
                <p className="text-white/80 font-medium mb-1">Group: <span className="font-normal opacity-90">Groupe A</span></p>
                <p className="text-white/80 font-medium mb-5">Time: <span className="font-normal opacity-90">14:00 - 15:30</span></p>
                
                <button className="w-full cap-orange-button py-3 text-lg tracking-wide">
                  Piloter
                </button>
              </div>

              {/* Liste d'exercices (mock) conforme maquette */}
              <div className="space-y-3 mb-6">
                <div className="cap-card p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white"></div>
                    <span className="font-semibold text-[#0b234a] text-[15px]">Exercice 1: Écoute active</span>
                  </div>
                  <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-none rounded-full px-2.5 font-bold">CO</Badge>
                </div>
                <div className="cap-card p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white"></div>
                    <span className="font-semibold text-[#0b234a] text-[15px]">Exercice 2: Compréhension orale</span>
                  </div>
                  <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-none rounded-full px-2.5 font-bold">CO</Badge>
                </div>
                <div className="cap-card p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white"></div>
                    <span className="font-semibold text-[#0b234a] text-[15px]">Exercice 3: Expression écrite</span>
                  </div>
                  <Badge className="bg-[#a58d60] hover:bg-[#a58d60]/90 text-white border-none rounded-full px-2.5 font-bold">EE</Badge>
                </div>
                <div className="cap-card p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white"></div>
                    <span className="font-semibold text-[#0b234a] text-[15px]">Exercice 4: Expression orale</span>
                  </div>
                  <Badge className="bg-teal-500 hover:bg-teal-600 text-white border-none rounded-full px-2.5 font-bold">EO</Badge>
                </div>
              </div>
              
              <button className="w-full cap-orange-button py-4 text-lg mb-8">
                Générer des devoirs automatiques
              </button>

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
