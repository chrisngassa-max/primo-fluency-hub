import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import {
  Users, TrendingUp, Target, AlertTriangle, ChevronRight, Sparkles, Loader2, ArrowLeft,
  Brain, BookOpen, XCircle, GitCompareArrows, Crosshair, Info, Search, LayoutGrid, User,
} from "lucide-react";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;
const COMP_LABELS: Record<string, string> = {
  CO: "Compréhension Orale", CE: "Compréhension Écrite",
  EE: "Expression Écrite", EO: "Expression Orale", Structures: "Structures",
};
const PALETTE = [
  "hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

interface SessionPoint {
  sessionId: string;
  sessionTitre: string;
  sessionDate: string;
  ordre: number;
  cible: number;
  groupe: number;
  competences: string[];
  [key: string]: any;
}

type ViewMode = "hub" | "groupes" | "eleves";

const MonitoringPage = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("hub");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedEleveId, setSelectedEleveId] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [trajectoryAiResult, setTrajectoryAiResult] = useState<string | null>(null);
  const [trajectoryAiLoading, setTrajectoryAiLoading] = useState(false);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<SessionPoint | null>(null);
  const [compareEleves, setCompareEleves] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  // ─── Fetch all groups ───
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["monitoring-groups", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("id, nom, niveau, is_active")
        .eq("formateur_id", user!.id).eq("is_active", true).order("nom");
      return data ?? [];
    },
    enabled: !!user,
  });

  // ─── All students (for search + "Vue Élèves") with fallback score from resultats ───
  const { data: allEleves = [], isLoading: loadingAllEleves } = useQuery({
    queryKey: ["monitoring-all-eleves", user?.id],
    queryFn: async () => {
      const { data: grps } = await supabase.from("groups").select("id").eq("formateur_id", user!.id);
      if (!grps?.length) return [];
      const { data: members } = await supabase.from("group_members")
        .select("eleve_id, group_id").in("group_id", grps.map(g => g.id));
      if (!members?.length) return [];
      const ids = [...new Set(members.map(m => m.eleve_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, nom, prenom").in("id", ids);
      const { data: profils } = await supabase.from("profils_eleves").select("*").in("eleve_id", ids);
      const profilMap = Object.fromEntries((profils ?? []).map(p => [p.eleve_id, p]));

      // Fallback: compute score from resultats if profils_eleves is missing or at 0
      const { data: allResults } = await supabase.from("resultats")
        .select("eleve_id, score, created_at")
        .in("eleve_id", ids)
        .order("created_at", { ascending: false });
      const resultsByEleve: Record<string, { scores: number[]; lastActivity: string | null }> = {};
      (allResults ?? []).forEach(r => {
        if (!resultsByEleve[r.eleve_id]) resultsByEleve[r.eleve_id] = { scores: [], lastActivity: null };
        resultsByEleve[r.eleve_id].scores.push(Number(r.score));
        if (!resultsByEleve[r.eleve_id].lastActivity) resultsByEleve[r.eleve_id].lastActivity = r.created_at;
      });

      // Map eleve to group names
      const groupMap = Object.fromEntries(grps.map(g => [g.id, groups.find(gg => gg.id === g.id)?.nom || ""]));
      const eleveGroups: Record<string, string[]> = {};
      members.forEach(m => {
        (eleveGroups[m.eleve_id] = eleveGroups[m.eleve_id] || []).push(groupMap[m.group_id] || "");
      });
      return (profiles ?? []).map(p => {
        const profil = profilMap[p.id] || null;
        const fallback = resultsByEleve[p.id];
        const fallbackScore = fallback?.scores.length
          ? Math.round(fallback.scores.reduce((a, b) => a + b, 0) / fallback.scores.length)
          : 0;
        return {
          ...p,
          profil,
          groupes: eleveGroups[p.id] || [],
          computedScore: profil && Number(profil.taux_reussite_global) > 0
            ? Math.round(Number(profil.taux_reussite_global))
            : fallbackScore,
          lastActivity: fallback?.lastActivity || null,
        };
      });
    },
    enabled: !!user && groups.length > 0,
  });

  // ─── Group stats ───
  const { data: groupStats = [], isLoading: loadingStats } = useQuery({
    queryKey: ["monitoring-group-stats", user?.id],
    queryFn: async () => {
      const { data: grps } = await supabase.from("groups").select("id, nom").eq("formateur_id", user!.id).eq("is_active", true);
      if (!grps?.length) return [];
      const stats = [];
      for (const g of grps) {
        const { data: members } = await supabase.from("group_members").select("eleve_id").eq("group_id", g.id);
        const eleveIds = members?.map(m => m.eleve_id) ?? [];
        if (!eleveIds.length) { stats.push({ nom: g.nom, id: g.id, scoreMoyen: 0, nbEleves: 0, CO: 0, CE: 0, EE: 0, EO: 0, Structures: 0 }); continue; }
        const { data: profils } = await supabase.from("profils_eleves").select("taux_reussite_global, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures").in("eleve_id", eleveIds);
        if (!profils?.length) { stats.push({ nom: g.nom, id: g.id, scoreMoyen: 0, nbEleves: eleveIds.length, CO: 0, CE: 0, EE: 0, EO: 0, Structures: 0 }); continue; }
        const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        stats.push({
          nom: g.nom, id: g.id, nbEleves: eleveIds.length,
          scoreMoyen: avg(profils.map(p => Number(p.taux_reussite_global))),
          CO: avg(profils.map(p => Number(p.taux_reussite_co))),
          CE: avg(profils.map(p => Number(p.taux_reussite_ce))),
          EE: avg(profils.map(p => Number(p.taux_reussite_ee))),
          EO: avg(profils.map(p => Number(p.taux_reussite_eo))),
          Structures: avg(profils.map(p => Number(p.taux_reussite_structures))),
        });
      }
      return stats;
    },
    enabled: !!user,
  });

  // ─── Students of selected group ───
  const { data: groupEleves = [], isLoading: loadingEleves } = useQuery({
    queryKey: ["monitoring-group-eleves", selectedGroupId],
    queryFn: async () => {
      const { data: members } = await supabase.from("group_members").select("eleve_id").eq("group_id", selectedGroupId!);
      if (!members?.length) return [];
      const ids = members.map(m => m.eleve_id);
      const { data: profiles } = await supabase.from("profiles").select("id, nom, prenom").in("id", ids);
      const { data: profils } = await supabase.from("profils_eleves").select("*").in("eleve_id", ids);
      const { data: levels } = await supabase.from("student_competency_levels").select("*").in("eleve_id", ids);
      const profilMap = Object.fromEntries((profils ?? []).map(p => [p.eleve_id, p]));
      const levelMap: Record<string, any[]> = {};
      (levels ?? []).forEach(l => { (levelMap[l.eleve_id] = levelMap[l.eleve_id] || []).push(l); });
      return (profiles ?? []).map(p => ({ ...p, profil: profilMap[p.id] || null, levels: levelMap[p.id] || [] }));
    },
    enabled: !!selectedGroupId,
  });

  // ─── Trajectory data ───
  const { data: trajectoryData = [], isLoading: loadingTrajectory } = useQuery({
    queryKey: ["monitoring-trajectory", selectedGroupId],
    queryFn: async () => {
      const { data: sessions } = await supabase.from("sessions")
        .select("id, titre, date_seance, objectifs, niveau_cible")
        .eq("group_id", selectedGroupId!).order("date_seance", { ascending: true });
      if (!sessions?.length) return [];
      const { data: members } = await supabase.from("group_members").select("eleve_id").eq("group_id", selectedGroupId!);
      if (!members?.length) return [];
      const eleveIds = members.map(m => m.eleve_id);
      const { data: profiles } = await supabase.from("profiles").select("id, prenom").in("id", eleveIds);
      const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.prenom || p.id.slice(0, 6)]));
      const sessionIds = sessions.map(s => s.id);
      const { data: sessionExercices } = await supabase.from("session_exercices").select("session_id, exercice_id").in("session_id", sessionIds);
      const exerciceIds = [...new Set((sessionExercices ?? []).map(se => se.exercice_id))];
      const { data: exercices } = exerciceIds.length
        ? await supabase.from("exercices").select("id, competence, difficulte").in("id", exerciceIds)
        : { data: [] };
      const exerciceMap = Object.fromEntries((exercices ?? []).map(e => [e.id, e]));
      const sessionExMap: Record<string, string[]> = {};
      (sessionExercices ?? []).forEach(se => { (sessionExMap[se.session_id] = sessionExMap[se.session_id] || []).push(se.exercice_id); });
      const { data: resultats } = await supabase.from("resultats")
        .select("eleve_id, exercice_id, score, created_at")
        .in("eleve_id", eleveIds).in("exercice_id", exerciceIds.length ? exerciceIds : ["__none__"])
        .order("created_at", { ascending: true });
      const resultsByExEleve: Record<string, Record<string, number[]>> = {};
      (resultats ?? []).forEach(r => {
        if (!resultsByExEleve[r.exercice_id]) resultsByExEleve[r.exercice_id] = {};
        if (!resultsByExEleve[r.exercice_id][r.eleve_id]) resultsByExEleve[r.exercice_id][r.eleve_id] = [];
        resultsByExEleve[r.exercice_id][r.eleve_id].push(Number(r.score));
      });
      const totalSessions = sessions.length;
      return sessions.map((s, i) => {
        const cible = totalSessions > 1 ? Math.round((10 / (totalSessions - 1)) * i * 10) / 10 : 10;
        const exIds = sessionExMap[s.id] || [];
        const comps = [...new Set(exIds.map(eid => exerciceMap[eid]?.competence).filter(Boolean))];
        const avgDiffForStudent = (eleveId: string) => {
          const scores: number[] = [];
          exIds.forEach(eid => { const s = resultsByExEleve[eid]?.[eleveId]; if (s?.length) scores.push(...s); });
          if (!scores.length) return null;
          return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length / 10 * 10) / 10;
        };
        const groupScores: number[] = [];
        const point: SessionPoint = { sessionId: s.id, sessionTitre: s.titre, sessionDate: s.date_seance, ordre: i + 1, cible, groupe: 0, competences: comps as string[] };
        eleveIds.forEach(eid => { const val = avgDiffForStudent(eid); const name = nameMap[eid]; if (val !== null) { point[name] = val; groupScores.push(val); } });
        point.groupe = groupScores.length ? Math.round(groupScores.reduce((a, b) => a + b, 0) / groupScores.length * 10) / 10 : 0;
        return point;
      });
    },
    enabled: !!selectedGroupId,
  });

  const trajectoryStudentNames = useMemo(() => {
    if (!trajectoryData.length) return [];
    const skip = new Set(["sessionId", "sessionTitre", "sessionDate", "ordre", "cible", "groupe", "competences"]);
    return Object.keys(trajectoryData[0]).filter(k => !skip.has(k));
  }, [trajectoryData]);

  // ─── Individual student detail ───
  const { data: eleveDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["monitoring-eleve-detail", selectedEleveId],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("id, nom, prenom").eq("id", selectedEleveId!).single();
      const { data: profil } = await supabase.from("profils_eleves").select("*").eq("eleve_id", selectedEleveId!).maybeSingle();
      const { data: levels } = await supabase.from("student_competency_levels").select("*").eq("eleve_id", selectedEleveId!);
      const { data: results } = await supabase.from("resultats").select("*, exercices(titre, competence, difficulte, contenu)").eq("eleve_id", selectedEleveId!).order("created_at", { ascending: false }).limit(30);
      const { data: testEntree } = await supabase.from("tests_entree").select("*").eq("eleve_id", selectedEleveId!).maybeSingle();
      const failures: { titre: string; competence: string; score: number; count: number }[] = [];
      const failMap: Record<string, { titre: string; competence: string; totalScore: number; count: number }> = {};
      (results ?? []).forEach((r: any) => {
        if (Number(r.score) < 60 && r.exercices) {
          const key = r.exercice_id;
          if (!failMap[key]) failMap[key] = { titre: r.exercices.titre, competence: r.exercices.competence, totalScore: 0, count: 0 };
          failMap[key].totalScore += Number(r.score); failMap[key].count++;
        }
      });
      Object.values(failMap).forEach(f => failures.push({ ...f, score: Math.round(f.totalScore / f.count) }));
      failures.sort((a, b) => a.score - b.score);
      return { profile, profil, levels: levels ?? [], results: results ?? [], testEntree, failures: failures.slice(0, 8) };
    },
    enabled: !!selectedEleveId,
  });

  // ─── AI Advice ───
  const handleAiAdvice = async () => {
    if (!selectedEleveId || !eleveDetail) return;
    setAiLoading(true); setAiAdvice(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-student-progress", {
        body: {
          eleveId: selectedEleveId,
          eleveNom: `${eleveDetail.profile?.prenom} ${eleveDetail.profile?.nom}`,
          profil: eleveDetail.profil, levels: eleveDetail.levels,
          recentResults: eleveDetail.results.slice(0, 15).map((r: any) => ({
            score: r.score, competence: r.exercices?.competence, titre: r.exercices?.titre, difficulte: r.exercices?.difficulte,
          })),
          testEntree: eleveDetail.testEntree ? {
            score_global: eleveDetail.testEntree.score_global, score_co: eleveDetail.testEntree.score_co,
            score_ce: eleveDetail.testEntree.score_ce, score_ee: eleveDetail.testEntree.score_ee,
            niveau_estime: eleveDetail.testEntree.niveau_estime,
          } : null,
          failures: eleveDetail.failures,
        },
      });
      if (error) throw error;
      setAiAdvice(data.analysis || "Aucune analyse disponible.");
    } catch (e: any) { toast.error("Erreur IA", { description: e.message }); } finally { setAiLoading(false); }
  };

  // ─── AI Trajectory ───
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const handleTrajectoryAi = async () => {
    if (!trajectoryData.length || !selectedGroupId) return;
    setTrajectoryAiLoading(true); setTrajectoryAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-trajectory", {
        body: {
          groupNom: selectedGroup?.nom || "Groupe",
          trajectoryData: trajectoryData.map(p => ({
            seance: p.ordre, titre: p.sessionTitre, date: p.sessionDate, cible: p.cible, groupe: p.groupe,
            competences: p.competences,
            eleves: Object.fromEntries(trajectoryStudentNames.map(n => [n, p[n] ?? null])),
          })),
          totalSeances: trajectoryData.length,
        },
      });
      if (error) throw error;
      setTrajectoryAiResult(data.analysis || "Analyse indisponible.");
    } catch (e: any) { toast.error("Erreur IA", { description: e.message }); } finally { setTrajectoryAiLoading(false); }
  };

  const groupRadarData = useMemo(() => {
    const g = groupStats.find(s => s.id === selectedGroupId);
    if (!g) return [];
    return COMPETENCES.map(c => ({ competence: c, value: (g as any)[c] || 0 }));
  }, [groupStats, selectedGroupId]);

  const toggleCompareEleve = useCallback((name: string) => {
    setCompareEleves(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= 2) return [prev[1], name];
      return [...prev, name];
    });
  }, []);

  // ─── Search filtering ───
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => g.nom.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const filteredEleves = useMemo(() => {
    if (!searchQuery.trim()) return allEleves;
    const q = searchQuery.toLowerCase();
    return allEleves.filter((e: any) =>
      `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
      e.groupes?.some((g: string) => g.toLowerCase().includes(q))
    );
  }, [allEleves, searchQuery]);

  const TrajectoryTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const point = trajectoryData.find(p => p.ordre === label);
    return (
      <div className="rounded-lg border bg-card p-3 shadow-md text-sm max-w-xs">
        <p className="font-semibold text-foreground">{point?.sessionTitre || `Séance ${label}`}</p>
        {point?.sessionDate && <p className="text-xs text-muted-foreground mb-2">{format(new Date(point.sessionDate), "d MMM yyyy", { locale: fr })}</p>}
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium">{p.value ?? "—"}</span>
          </div>
        ))}
      </div>
    );
  };

  // ─── Navigate helpers ───
  const goToGroupDetail = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedEleveId(null);
    setViewMode("groupes");
    setAiAdvice(null);
    setTrajectoryAiResult(null);
    setCompareMode(false);
    setCompareEleves([]);
  };

  const goToEleveDetail = (eleveId: string) => {
    setSelectedEleveId(eleveId);
    setAiAdvice(null);
  };

  const goBack = () => {
    if (selectedEleveId) {
      setSelectedEleveId(null);
      setAiAdvice(null);
    } else if (selectedGroupId) {
      setSelectedGroupId(null);
      setTrajectoryAiResult(null);
      setCompareMode(false);
      setCompareEleves([]);
    } else {
      setViewMode("hub");
    }
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER: Individual Student View
  // ══════════════════════════════════════════════════════════════
  if (selectedEleveId && eleveDetail) {
    const d = eleveDetail;
    const radarData = COMPETENCES.map(c => {
      const level = d.levels.find((l: any) => l.competence === c);
      return { competence: c, niveau: level?.niveau_actuel ?? 0 };
    });
    // Competence scores from profil (0-100)
    const compScores = d.profil ? [
      { comp: "CO", score: Number(d.profil.taux_reussite_co) },
      { comp: "CE", score: Number(d.profil.taux_reussite_ce) },
      { comp: "EE", score: Number(d.profil.taux_reussite_ee) },
      { comp: "EO", score: Number(d.profil.taux_reussite_eo) },
      { comp: "Structures", score: Number(d.profil.taux_reussite_structures) },
    ] : [];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{d.profile?.prenom} {d.profile?.nom}</h1>
            <p className="text-muted-foreground text-sm">
              Niveau estimé : {d.profil?.niveau_actuel || "—"} · Score moyen : {d.profil ? Math.round(Number(d.profil.taux_reussite_global)) : 0}%
            </p>
          </div>
          {/* Navigation tabs in header */}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSelectedEleveId(null); setViewMode("groupes"); }}>
              <LayoutGrid className="h-4 w-4 mr-1" /> Groupes
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSelectedEleveId(null); setSelectedGroupId(null); setViewMode("eleves"); }}>
              <User className="h-4 w-4 mr-1" /> Élèves
            </Button>
            <Button onClick={handleAiAdvice} disabled={aiLoading} className="gap-2">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Conseil IA
            </Button>
          </div>
        </div>

        <Dialog open={!!aiAdvice} onOpenChange={() => setAiAdvice(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Conseil IA — {d.profile?.prenom}</DialogTitle>
              <DialogDescription>Analyse pédagogique basée sur l'historique complet</DialogDescription>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{aiAdvice}</div>
          </DialogContent>
        </Dialog>

        {/* Competence detail table (0-100) */}
        {compScores.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Compétences détaillées (0-100)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {compScores.map(({ comp, score }) => (
                  <div key={comp} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{COMP_LABELS[comp]}</span>
                      <span className={cn("text-sm font-bold", score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-destructive")}>{Math.round(score)}/100</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Niveaux par compétence (0-10)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="competence" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Radar name="Niveau" dataKey="niveau" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {d.levels.map((l: any) => (
                  <div key={l.competence} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{l.competence}:</span>
                    <DifficultyBadge level={l.niveau_actuel} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" /> Points d'échec récurrents</CardTitle>
            </CardHeader>
            <CardContent>
              {d.failures.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Aucun échec récurrent détecté 🎉</p>
              ) : (
                <div className="space-y-2">
                  {d.failures.map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border bg-destructive/5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{f.titre}</p>
                        <p className="text-xs text-muted-foreground">{COMP_LABELS[f.competence] || f.competence} · {f.count} échec(s)</p>
                      </div>
                      <Badge variant="destructive" className="shrink-0">{f.score}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Derniers résultats</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercice</TableHead>
                  <TableHead>Compétence</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.results.slice(0, 15).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.exercices?.titre || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.exercices?.competence}</Badge></TableCell>
                    <TableCell>
                      <span className={cn("font-semibold", Number(r.score) >= 80 ? "text-emerald-600" : Number(r.score) >= 60 ? "text-amber-600" : "text-destructive")}>
                        {Math.round(Number(r.score))}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: Group Detail View
  // ══════════════════════════════════════════════════════════════
  if (selectedGroupId) {
    const visibleStudents = compareMode && compareEleves.length > 0 ? compareEleves : trajectoryStudentNames;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selectedGroup?.nom || "Groupe"}</h1>
            <p className="text-muted-foreground text-sm">Comparaison inter-élèves · {groupEleves.length} élève(s)</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant={viewMode === "groupes" ? "default" : "outline"} size="sm" onClick={() => { setSelectedGroupId(null); setViewMode("groupes"); }}>
              <LayoutGrid className="h-4 w-4 mr-1" /> Groupes
            </Button>
            <Button variant={viewMode === "eleves" ? "default" : "outline"} size="sm" onClick={() => { setSelectedGroupId(null); setViewMode("eleves"); }}>
              <User className="h-4 w-4 mr-1" /> Élèves
            </Button>
          </div>
        </div>

        {/* Competence scores table (0-100) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Compétences du groupe (0-100)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {COMPETENCES.map(c => {
                const g = groupStats.find(s => s.id === selectedGroupId);
                const val = g ? (g as any)[c] || 0 : 0;
                return (
                  <div key={c} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{COMP_LABELS[c]}</span>
                      <span className={cn("text-sm font-bold", val >= 80 ? "text-emerald-600" : val >= 60 ? "text-amber-600" : "text-destructive")}>{val}/100</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", val >= 80 ? "bg-emerald-500" : val >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="trajectoire">
          <TabsList>
            <TabsTrigger value="trajectoire">📈 Courbe de Trajectoire</TabsTrigger>
            <TabsTrigger value="competences">Radar</TabsTrigger>
            <TabsTrigger value="tableau">Tableau détaillé</TabsTrigger>
          </TabsList>

          {/* Trajectory curve */}
          <TabsContent value="trajectoire" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2"><Crosshair className="h-4 w-4" /> Courbe de Trajectoire Cible</CardTitle>
                    <CardDescription>Progression par séance · Cible = niveau 10 en dernière séance</CardDescription>
                  </div>
                  <Button variant={compareMode ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => { setCompareMode(!compareMode); if (compareMode) setCompareEleves([]); }}>
                    <GitCompareArrows className="h-4 w-4" />
                    {compareMode ? "Mode normal" : "Comparer"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {compareMode && trajectoryStudentNames.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4 p-3 rounded-lg border bg-muted/30">
                    <span className="text-sm text-muted-foreground self-center">Sélectionnez jusqu'à 2 élèves :</span>
                    {trajectoryStudentNames.map(name => (
                      <label key={name} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={compareEleves.includes(name)} onCheckedChange={() => toggleCompareEleve(name)} />
                        <span className="text-sm">{name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {loadingTrajectory ? <Skeleton className="h-80 w-full" /> : trajectoryData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-16">Aucune séance planifiée pour ce groupe.</p>
                ) : (
                  <div className="h-80 cursor-pointer">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trajectoryData} onClick={(e: any) => {
                        if (e?.activePayload?.[0]) {
                          const point = trajectoryData.find(p => p.ordre === e.activeLabel);
                          if (point) setSelectedSessionDetail(point);
                        }
                      }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ordre" tickFormatter={(v) => `S${v}`} label={{ value: "Séances", position: "insideBottom", offset: -5, fontSize: 12 }} />
                        <YAxis domain={[0, 10]} label={{ value: "Niveau (0-10)", angle: -90, position: "insideLeft", fontSize: 12 }} />
                        <RechartsTooltip content={<TrajectoryTooltip />} />
                        <Legend />
                        <Line type="linear" dataKey="cible" name="🎯 Cible" stroke="#94a3b8" strokeWidth={2} strokeDasharray="8 4" dot={false} connectNulls />
                        <Line type="monotone" dataKey="groupe" name="📊 Moyenne groupe" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} connectNulls />
                        {visibleStudents.map((name, i) => (
                          <Line key={name} type="monotone" dataKey={name} name={name} stroke={PALETTE[(i + 2) % PALETTE.length]} strokeWidth={compareMode ? 2.5 : 1.5} strokeOpacity={compareMode ? 1 : 0.6} dot={{ r: compareMode ? 4 : 2 }} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {trajectoryData.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4 text-xs">
                    {trajectoryStudentNames.map(name => {
                      const lastPoint = [...trajectoryData].reverse().find(p => p[name] != null);
                      const lastCible = lastPoint?.cible ?? 0;
                      const lastVal = lastPoint?.[name] as number | undefined;
                      if (lastVal == null) return null;
                      const above = lastVal >= lastCible;
                      return (
                        <span key={name} className={cn("px-2 py-1 rounded-md border", above ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400")}>
                          {above ? "▲" : "▼"} {name}: {lastVal}
                        </span>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={!!selectedSessionDetail} onOpenChange={() => setSelectedSessionDetail(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Détails — {selectedSessionDetail?.sessionTitre}</DialogTitle>
                  <DialogDescription>{selectedSessionDetail?.sessionDate && format(new Date(selectedSessionDetail.sessionDate), "EEEE d MMMM yyyy", { locale: fr })}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Compétences travaillées</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedSessionDetail?.competences || []).length > 0
                        ? selectedSessionDetail!.competences.map(c => <Badge key={c} variant="outline">{c}</Badge>)
                        : <span className="text-sm text-muted-foreground">Aucune compétence enregistrée</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Niveau cible vs réel</p>
                    <div className="flex items-center gap-4">
                      <div className="text-center"><p className="text-2xl font-bold text-muted-foreground">{selectedSessionDetail?.cible ?? "—"}</p><p className="text-xs text-muted-foreground">Cible</p></div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      <div className="text-center"><p className={cn("text-2xl font-bold", (selectedSessionDetail?.groupe ?? 0) >= (selectedSessionDetail?.cible ?? 0) ? "text-emerald-600" : "text-destructive")}>{selectedSessionDetail?.groupe ?? "—"}</p><p className="text-xs text-muted-foreground">Groupe réel</p></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Scores individuels</p>
                    <div className="space-y-1.5">
                      {trajectoryStudentNames.map(name => {
                        const val = selectedSessionDetail?.[name];
                        if (val == null) return null;
                        const above = (val as number) >= (selectedSessionDetail?.cible ?? 0);
                        return (
                          <div key={name} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                            <span className="text-sm font-medium">{name}</span>
                            <span className={cn("font-semibold text-sm", above ? "text-emerald-600" : "text-destructive")}>{above ? "▲" : "▼"} {String(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Hypothèses & Diagnostic IA</p>
                    <p className="text-sm text-muted-foreground">Analyse des inflexions, blocages et projections</p>
                  </div>
                  <Button onClick={handleTrajectoryAi} disabled={trajectoryAiLoading || !trajectoryData.length} className="gap-2">
                    {trajectoryAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Générer Analyse de Progression
                  </Button>
                </div>
                {trajectoryAiResult && (
                  <div className="mt-4 p-4 rounded-lg border bg-muted/30 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{trajectoryAiResult}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="competences">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Moyenne du groupe par compétence</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={groupRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="competence" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Moyenne" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tableau">
            <Card>
              <CardContent className="pt-6">
                {loadingEleves ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : groupEleves.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">Aucun élève dans ce groupe.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élève</TableHead>
                        <TableHead>Niveau</TableHead>
                        <TableHead>Score moyen</TableHead>
                        <TableHead>Risque</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupEleves.map((e: any) => {
                        const p = e.profil;
                        return (
                          <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => goToEleveDetail(e.id)}>
                            <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                            <TableCell>{p?.niveau_actuel || "—"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={p ? Number(p.taux_reussite_global) : 0} className="h-2 w-20" />
                                <span className="text-sm">{p ? Math.round(Number(p.taux_reussite_global)) : 0}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {p && Number(p.score_risque) >= 60
                                ? <Badge variant="destructive">{Math.round(Number(p.score_risque))}</Badge>
                                : <Badge variant="secondary">{p ? Math.round(Number(p.score_risque)) : 0}</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="gap-1">Profil <ChevronRight className="h-3.5 w-3.5" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: Hub (landing) or list views
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Monitoring</h1>
        <p className="text-muted-foreground mt-1">Analyse comparative de vos groupes et élèves</p>
      </div>

      {/* Search bar — always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un groupe ou un élève…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* View mode tabs */}
      <Tabs value={viewMode === "hub" ? "hub" : viewMode} onValueChange={(v) => { setViewMode(v as ViewMode); setSearchQuery(""); }}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="hub" className="gap-1.5"><LayoutGrid className="h-4 w-4" /> Hub</TabsTrigger>
          <TabsTrigger value="groupes" className="gap-1.5"><Users className="h-4 w-4" /> Vue par Groupes</TabsTrigger>
          <TabsTrigger value="eleves" className="gap-1.5"><User className="h-4 w-4" /> Vue par Élèves</TabsTrigger>
        </TabsList>

        {/* ─── HUB ─── */}
        <TabsContent value="hub" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group" onClick={() => setViewMode("groupes")}>
              <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">Vue par Groupes</p>
                  <p className="text-sm text-muted-foreground mt-1">Comparer les dynamiques de classe (G1 vs G2)</p>
                </div>
                <Badge variant="secondary" className="text-sm">{groups.length} groupe(s) actif(s)</Badge>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group" onClick={() => setViewMode("eleves")}>
              <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-accent/50 flex items-center justify-center group-hover:bg-accent transition-colors">
                  <User className="h-8 w-8 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">Vue par Élèves</p>
                  <p className="text-sm text-muted-foreground mt-1">Entrer dans le détail individuel d'un élève</p>
                </div>
                <Badge variant="secondary" className="text-sm">{allEleves.length} élève(s)</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Quick overview charts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Progression moyenne par groupe</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? <Skeleton className="h-64 w-full" /> : groupStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-lg font-semibold text-foreground">Pas encore de données</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Les données de progression s'afficheront ici une fois que vos élèves auront commencé leurs exercices.
                  </p>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="nom" type="category" width={120} tick={{ fontSize: 12 }} />
                      <RechartsTooltip formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="scoreMoyen" name="Score moyen" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── GROUPES LIST ─── */}
        <TabsContent value="groupes" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Scores par compétence TCF</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? <Skeleton className="h-64 w-full" /> : groupStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Target className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-lg font-semibold text-foreground">Pas encore de données</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Les données de progression s'afficheront ici une fois que vos élèves auront commencé leurs exercices.
                  </p>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nom" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} />
                      <RechartsTooltip formatter={(v: number) => `${v}%`} />
                      <Legend />
                      {COMPETENCES.map((c, i) => <Bar key={c} dataKey={c} name={c} fill={PALETTE[i]} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingGroups ? [1, 2, 3].map(i => <Skeleton key={i} className="h-28" />) : filteredGroups.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-8">
                {searchQuery ? `Aucun groupe trouvé pour « ${searchQuery} »` : "Aucun groupe actif"}
              </p>
            ) : filteredGroups.map(g => {
              const stat = groupStats.find(s => s.id === g.id);
              return (
                <Card key={g.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => goToGroupDetail(g.id)}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{g.nom}</p>
                        <p className="text-sm text-muted-foreground">{stat?.nbEleves ?? 0} élève(s) · {g.niveau}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{stat?.scoreMoyen ?? 0}%</p>
                        <p className="text-xs text-muted-foreground">score moyen</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-3">
                      <span className="text-xs text-muted-foreground">Voir détails</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── ELEVES LIST ─── */}
        <TabsContent value="eleves" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {loadingAllEleves ? (
                <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : filteredEleves.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {searchQuery ? `Aucun élève trouvé pour « ${searchQuery} »` : "Aucun élève inscrit"}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead>Groupe(s)</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Score moyen</TableHead>
                      <TableHead>Risque</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEleves.map((e: any) => {
                      const p = e.profil;
                      return (
                        <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => goToEleveDetail(e.id)}>
                          <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {e.groupes?.map((g: string, i: number) => g && <Badge key={i} variant="outline" className="text-xs">{g}</Badge>)}
                            </div>
                          </TableCell>
                          <TableCell>{p?.niveau_actuel || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={p ? Number(p.taux_reussite_global) : 0} className="h-2 w-20" />
                              <span className="text-sm">{p ? Math.round(Number(p.taux_reussite_global)) : 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {p && Number(p.score_risque) >= 60
                              ? <Badge variant="destructive">{Math.round(Number(p.score_risque))}</Badge>
                              : <Badge variant="secondary">{p ? Math.round(Number(p.score_risque)) : 0}</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="gap-1">Profil <ChevronRight className="h-3.5 w-3.5" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringPage;
