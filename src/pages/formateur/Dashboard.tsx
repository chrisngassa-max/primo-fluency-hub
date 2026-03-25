import { useState, useMemo, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CompetencyGauge from "@/components/CompetencyGauge";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Users, GraduationCap, Calendar, Bell, Clock, TrendingUp, CheckCircle2, Pause, ArrowUpCircle, Play, Printer, Eye, UserPlus, AlertTriangle, Send, Gamepad2, BookOpen, ChevronRight, Rocket, ClipboardCheck, ListChecks, FileCheck, Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { DebugSimulationModal } from "@/components/DebugSimulationModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { DifficultyBadge } from "@/components/DifficultyBadge";


const COMPETENCE_LABELS: Record<string, string> = {
  CO: "Compréhension Orale",
  CE: "Compréhension Écrite",
  EE: "Expression Écrite",
  EO: "Expression Orale",
  Structures: "Structures",
};

const competenceColors: Record<string, string> = {
  CO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Structures: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const formatLabels: Record<string, string> = {
  qcm: "QCM",
  vrai_faux: "Vrai/Faux",
  texte_lacunaire: "Texte lacunaire",
  appariement: "Appariement",
  transformation: "Transformation",
  production_ecrite: "Production écrite",
  production_orale: "Production orale",
};

// Track exercise completion & test inclusion state
interface ExerciseTrackingState {
  isCompleted: boolean;
  isIncludedInTest: boolean;
}

const FormateurDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showNextPreview, setShowNextPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [exerciseTracking, setExerciseTracking] = useState<Record<string, ExerciseTrackingState>>({});
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [sessionSubTab, setSessionSubTab] = useState<"exercices" | "test-validation">("exercices");
  const [isEditing, setIsEditing] = useState(false);
  const [editedConsigne, setEditedConsigne] = useState("");
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [progGroupId, setProgGroupId] = useState<string>("");
  const [progViewId, setProgViewId] = useState<string>("moyenne");

  // ─── Progression: fetch real groups with members, test scores, and profiles ───
  const { data: progGroups } = useQuery({
    queryKey: ["prog-groups-detail", user?.id],
    queryFn: async () => {
      // 1. Get formateur's groups
      const { data: groups } = await supabase
        .from("groups")
        .select("id, nom")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (!groups || groups.length === 0) return [];

      // 2. Get all members
      const groupIds = groups.map((g) => g.id);
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, group_id")
        .in("group_id", groupIds);
      if (!members || members.length === 0) return groups.map((g) => ({ ...g, eleves: [] }));

      const eleveIds = [...new Set(members.map((m) => m.eleve_id))];

      // 3. Fetch profiles, tests_entree, profils_eleves, and session counts in parallel
      const [profilesRes, testsRes, profilsRes, sessionsRes] = await Promise.all([
        supabase.from("profiles").select("id, nom, prenom").in("id", eleveIds),
        supabase.from("tests_entree").select("eleve_id, score_co, score_ce, score_ee, score_structures, completed_at, en_cours").in("eleve_id", eleveIds),
        supabase.from("profils_eleves").select("eleve_id, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_structures").in("eleve_id", eleveIds),
        supabase.from("sessions").select("id, statut, group_id").in("group_id", groupIds),
      ]);

      const profilesMap: Record<string, { nom: string; prenom: string }> = {};
      for (const p of profilesRes.data ?? []) profilesMap[p.id] = p;

      const testsMap: Record<string, any> = {};
      for (const t of testsRes.data ?? []) if (t.completed_at && !t.en_cours) testsMap[t.eleve_id] = t;

      const profilsMap: Record<string, any> = {};
      for (const p of profilsRes.data ?? []) profilsMap[p.eleve_id] = p;

      // Session counts per group
      const sessionsByGroup: Record<string, { completed: number; total: number }> = {};
      for (const gid of groupIds) {
        const groupSessions = (sessionsRes.data ?? []).filter((s) => s.group_id === gid);
        sessionsByGroup[gid] = {
          completed: groupSessions.filter((s) => s.statut === "terminee").length,
          total: Math.max(groupSessions.length, 1),
        };
      }

      return groups.map((g) => {
        const groupMembers = members.filter((m) => m.group_id === g.id);
        const sc = sessionsByGroup[g.id] ?? { completed: 0, total: 1 };
        return {
          ...g,
          eleves: groupMembers.map((m) => {
            const profile = profilesMap[m.eleve_id];
            const test = testsMap[m.eleve_id];
            const profil = profilsMap[m.eleve_id];
            return {
              id: m.eleve_id,
              nom: profile ? `${profile.prenom} ${profile.nom}` : "Élève",
              co: { initial: Math.round(Number(test?.score_co ?? 0)), current: Math.round(Number(profil?.taux_reussite_co ?? test?.score_co ?? 0)) },
              ce: { initial: Math.round(Number(test?.score_ce ?? 0)), current: Math.round(Number(profil?.taux_reussite_ce ?? test?.score_ce ?? 0)) },
              ee: { initial: Math.round(Number(test?.score_ee ?? 0)), current: Math.round(Number(profil?.taux_reussite_ee ?? test?.score_ee ?? 0)) },
              structures: { initial: Math.round(Number(test?.score_structures ?? 0)), current: Math.round(Number(profil?.taux_reussite_structures ?? test?.score_structures ?? 0)) },
              completed: sc.completed,
              total: sc.total,
            };
          }),
        };
      });
    },
    enabled: !!user?.id,
  });

  // Auto-select first group
  const progGroupsList = progGroups ?? [];
  if (progGroupId === "" && progGroupsList.length > 0) {
    // Will set on next render
  }
  const effectiveProgGroupId = progGroupId || (progGroupsList.length > 0 ? progGroupsList[0].id : "");

  const selectedProgGroup = useMemo(() => progGroupsList.find((g: any) => g.id === effectiveProgGroupId), [effectiveProgGroupId, progGroupsList]);

  const progGaugeData = useMemo(() => {
    if (!selectedProgGroup || !selectedProgGroup.eleves || selectedProgGroup.eleves.length === 0) return null;
    const eleves = selectedProgGroup.eleves;

    if (progViewId === "moyenne") {
      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      const sc = eleves[0];
      return [
        { label: "Compréhension Orale", initialScore: avg(eleves.map((e: any) => e.co.initial)), currentScore: avg(eleves.map((e: any) => e.co.current)), completedSessions: sc.completed, totalSessions: sc.total },
        { label: "Compréhension Écrite", initialScore: avg(eleves.map((e: any) => e.ce.initial)), currentScore: avg(eleves.map((e: any) => e.ce.current)), completedSessions: sc.completed, totalSessions: sc.total },
        { label: "Expression Écrite", initialScore: avg(eleves.map((e: any) => e.ee.initial)), currentScore: avg(eleves.map((e: any) => e.ee.current)), completedSessions: sc.completed, totalSessions: sc.total },
        { label: "Structures de la langue", initialScore: avg(eleves.map((e: any) => e.structures.initial)), currentScore: avg(eleves.map((e: any) => e.structures.current)), completedSessions: sc.completed, totalSessions: sc.total },
      ];
    }

    const eleve = eleves.find((e: any) => e.id === progViewId);
    if (!eleve) return null;
    return [
      { label: "Compréhension Orale", initialScore: eleve.co.initial, currentScore: eleve.co.current, completedSessions: eleve.completed, totalSessions: eleve.total },
      { label: "Compréhension Écrite", initialScore: eleve.ce.initial, currentScore: eleve.ce.current, completedSessions: eleve.completed, totalSessions: eleve.total },
      { label: "Expression Écrite", initialScore: eleve.ee.initial, currentScore: eleve.ee.current, completedSessions: eleve.completed, totalSessions: eleve.total },
      { label: "Structures de la langue", initialScore: eleve.structures.initial, currentScore: eleve.structures.current, completedSessions: eleve.completed, totalSessions: eleve.total },
    ];
  }, [selectedProgGroup, progViewId]);

  // ─── KPI queries ───
  const { data: groupCount = 0, isLoading: loadingGroups } = useQuery({
    queryKey: ["kpi-groups", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("groups").select("*", { count: "exact", head: true }).eq("formateur_id", user!.id).eq("is_active", true);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: eleveCount = 0, isLoading: loadingEleves } = useQuery({
    queryKey: ["kpi-eleves", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase.from("groups").select("id").eq("formateur_id", user!.id);
      if (!groups?.length) return 0;
      const { count } = await supabase.from("group_members").select("*", { count: "exact", head: true }).in("group_id", groups.map((g) => g.id));
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: alertCount = 0, isLoading: loadingAlertes } = useQuery({
    queryKey: ["kpi-alertes", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("alertes").select("*", { count: "exact", head: true }).eq("formateur_id", user!.id).eq("is_resolved", false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  // ─── Today's session (nearest upcoming or most recent past) ───
  const { data: upcomingSessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["kpi-sessions", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase.from("groups").select("id, nom").eq("formateur_id", user!.id);
      if (!groups?.length) return [];
      const groupIds = groups.map((g) => g.id);
      const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.nom]));
      // Try upcoming first
      const { data: upcoming } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, duree_minutes, niveau_cible, objectifs, statut, group_id")
        .in("group_id", groupIds)
        .gte("date_seance", new Date().toISOString())
        .order("date_seance", { ascending: true })
        .limit(3);
      if (upcoming && upcoming.length > 0) {
        return upcoming.map((s) => ({ ...s, group_nom: groupMap[s.group_id] || "—", isPast: false }));
      }
      // Fallback: most recent past session
      const { data: recent } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, duree_minutes, niveau_cible, objectifs, statut, group_id")
        .in("group_id", groupIds)
        .lt("date_seance", new Date().toISOString())
        .order("date_seance", { ascending: false })
        .limit(1);
      return (recent ?? []).map((s) => ({ ...s, group_nom: groupMap[s.group_id] || "—", isPast: true }));
    },
    enabled: !!user,
  });

  const nextSession = upcomingSessions[0] || null;
  const followingSession = upcomingSessions[1] || null;

  // ─── Exercises for today's session (with full exercise data) ───
  const { data: sessionExercises = [], isLoading: loadingExercises } = useQuery({
    queryKey: ["today-session-exercises", nextSession?.id],
    queryFn: async () => {
      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("id, ordre, statut, exercice_id")
        .eq("session_id", nextSession!.id)
        .order("ordre");
      if (!seLinks?.length) return [];
      const exIds = seLinks.map((se) => se.exercice_id);
      const { data: exercices } = await supabase
        .from("exercices")
        .select("id, titre, consigne, format, competence, difficulte, contenu, animation_guide")
        .in("id", exIds);
      const exMap = Object.fromEntries((exercices ?? []).map((e) => [e.id, e]));
      return seLinks.map((se) => ({
        sessionExerciceId: se.id,
        ordre: se.ordre,
        statut: se.statut,
        ...exMap[se.exercice_id],
      })).filter((e) => e.titre);
    },
    enabled: !!nextSession,
  });

  // ─── Alerts ───
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
      const { data: profiles } = await supabase.from("profiles").select("id, nom, prenom").in("id", eleveIds);
      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, `${p.prenom} ${p.nom}`]));
      return alertes.map((a) => ({ ...a, eleve_nom: nameMap[a.eleve_id] || "Élève" }));
    },
    enabled: !!user,
  });

  // ─── Groups list ───
  const { data: groupsList = [], isLoading: loadingGroupsList } = useQuery({
    queryKey: ["dashboard-groups-list", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase.from("groups").select("id, nom, niveau").eq("formateur_id", user!.id).eq("is_active", true).order("nom");
      if (!groups?.length) return [];
      const groupIds = groups.map((g) => g.id);
      const { data: members } = await supabase.from("group_members").select("eleve_id, group_id").in("group_id", groupIds);
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

  // ─── Progression alerts ───
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
      const { data: profiles } = await supabase.from("profiles").select("id, nom, prenom").in("id", eleveIds);
      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, `${p.prenom} ${p.nom}`]));
      return alertes.map((a) => {
        const parts = (a.message || "").split("|");
        return {
          id: a.id,
          eleve_id: a.eleve_id,
          eleve_nom: nameMap[a.eleve_id] || "Élève",
          competence: parts.length >= 2 ? parts[1] : "CE",
          niveau_actuel: parts.length >= 3 ? parseInt(parts[2]) || 3 : 3,
          niveau_propose: parts.length >= 4 ? parseInt(parts[3]) || 4 : 4,
        };
      });
    },
    enabled: !!user,
  });

  // ─── Actions ───
  const handleValidateProgression = async (alertId: string, eleveId: string, competence: string, niveauPropose: number) => {
    try {
      await supabase.from("student_competency_levels").upsert({ eleve_id: eleveId, competence: competence as any, niveau_actuel: niveauPropose, validated_at: new Date().toISOString(), validated_by: user!.id, updated_at: new Date().toISOString() }, { onConflict: "eleve_id,competence" });
      await supabase.from("alertes").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", alertId);
      qc.invalidateQueries({ queryKey: ["progression-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      toast.success(`Niveau ${niveauPropose} validé en ${COMPETENCE_LABELS[competence] || competence} !`);
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handlePauseProgression = async (alertId: string) => {
    try {
      await supabase.from("alertes").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", alertId);
      qc.invalidateQueries({ queryKey: ["progression-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      toast.info("Progression mise en pause.");
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handleMarkRead = async (alertId: string) => {
    try {
      await supabase.from("alertes").update({ is_read: true }).eq("id", alertId);
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      toast.success("Alerte marquée comme lue.");
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await supabase.from("alertes").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", alertId);
      qc.invalidateQueries({ queryKey: ["all-alerts"] });
      qc.invalidateQueries({ queryKey: ["kpi-alertes"] });
      toast.success("Alerte résolue.");
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  // ─── Send exercises to students (make visible) ───
  const handleSendToStudents = async () => {
    if (!nextSession || sessionExercises.length === 0) return;
    setSending(true);
    try {
      const ids = sessionExercises.map((e: any) => e.sessionExerciceId);
      const { error } = await supabase
        .from("session_exercices")
        .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["today-session-exercises"] });
      toast.success(`${sessionExercises.length} exercice(s) envoyé(s) aux élèves !`, {
        description: "Les ateliers ludiques restent sur votre espace formateur.",
      });
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  // ─── Print session (exercises only) ───
  const handlePrintSession = () => {
    if (sessionExercises.length === 0) {
      toast.error("Aucun exercice à imprimer.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${nextSession?.titre || "Séance"}</title>
<style>
body { font-family: Arial, sans-serif; margin: 2cm; font-size: 16px; color: #333; }
h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }
.header-info { color: #666; font-size: 13px; margin-bottom: 20px; }
.exercise { page-break-inside: avoid; margin-bottom: 28px; border: 1px solid #ddd; padding: 18px; border-radius: 8px; }
.exercise h2 { font-size: 18px; margin: 0 0 6px 0; }
.badge { display: inline-block; background: #eee; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }
.consigne { font-style: italic; margin: 10px 0; font-size: 15px; }
.item { margin: 10px 0 10px 16px; }
.options { margin-left: 16px; }
.option { margin: 4px 0; font-size: 15px; }
.write-zone { border: 1px dashed #ccc; min-height: 80px; margin-top: 10px; border-radius: 4px; }
.nom-zone { border-bottom: 1px solid #333; width: 200px; display: inline-block; margin-left: 8px; }
@media print { body { margin: 1cm; } }
</style></head><body>
<h1>${nextSession?.titre || "Séance du jour"}</h1>
<p class="header-info">Nom : <span class="nom-zone">&nbsp;</span> &nbsp;&nbsp; Date : ${format(new Date(), "d MMMM yyyy", { locale: fr })} &nbsp;&nbsp; Groupe : ${nextSession?.group_nom || ""} &nbsp;&nbsp; Niveau : ${nextSession?.niveau_cible || ""}</p>
${sessionExercises.map((ex: any, i: number) => `
<div class="exercise">
  <h2>${i + 1}. ${ex.titre}</h2>
  <span class="badge">${ex.competence}</span>
  <span class="badge">${formatLabels[ex.format] || ex.format}</span>
  <p class="consigne">${ex.consigne}</p>
  ${(ex.contenu?.items || []).map((item: any, j: number) => `
    <div class="item">
      <strong>${j + 1}.</strong> ${item.question}
      ${item.options?.length
        ? `<div class="options">${item.options.map((o: string) => `<div class="option">☐ ${o}</div>`).join("")}</div>`
        : '<div class="write-zone"></div>'}
    </div>`).join("")}
</div>`).join("")}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // ─── Exercise tracking helpers ───
  const getTracking = (id: string): ExerciseTrackingState => exerciseTracking[id] || { isCompleted: false, isIncludedInTest: false };

  const toggleCompleted = (id: string, checked: boolean) => {
    setExerciseTracking((prev) => ({
      ...prev,
      [id]: { ...getTracking(id), isCompleted: checked, ...(checked ? {} : { isIncludedInTest: false }) },
    }));
  };

  const toggleIncludedInTest = (id: string, checked: boolean) => {
    setExerciseTracking((prev) => ({
      ...prev,
      [id]: { ...getTracking(id), isIncludedInTest: checked },
    }));
  };

  const completedCount = sessionExercises.filter((e: any) => getTracking(e.sessionExerciceId).isCompleted).length;

  const testExercises = useMemo(() =>
    sessionExercises.filter((e: any) => {
      const t = getTracking(e.sessionExerciceId);
      return t.isCompleted && t.isIncludedInTest;
    }),
    [sessionExercises, exerciseTracking]
  );

  const selectedExercise = useMemo(() =>
    selectedExerciseId ? sessionExercises.find((e: any) => e.sessionExerciceId === selectedExerciseId) : null,
    [selectedExerciseId, sessionExercises]
  );

  // ─── Edit mode helpers ───
  const startEditing = useCallback(() => {
    if (!selectedExercise) return;
    setEditedConsigne(selectedExercise.consigne || "");
    setEditedItems(JSON.parse(JSON.stringify((selectedExercise.contenu as any)?.items || [])));
    setIsEditing(true);
  }, [selectedExercise]);

  const cancelEditing = () => { setIsEditing(false); };

  const updateItemQuestion = (index: number, value: string) => {
    setEditedItems(prev => prev.map((item, i) => i === index ? { ...item, question: value } : item));
  };

  const updateItemOption = (itemIndex: number, optIndex: number, value: string) => {
    setEditedItems(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item;
      const newOptions = [...(item.options || [])];
      newOptions[optIndex] = value;
      return { ...item, options: newOptions };
    }));
  };

  const removeItemOption = (itemIndex: number, optIndex: number) => {
    setEditedItems(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item;
      const newOptions = (item.options || []).filter((_: any, k: number) => k !== optIndex);
      return { ...item, options: newOptions };
    }));
  };

  const addItemOption = (itemIndex: number) => {
    setEditedItems(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item;
      return { ...item, options: [...(item.options || []), ""] };
    }));
  };

  const removeItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setEditedItems(prev => [...prev, { question: "", options: ["", ""], correct: 0 }]);
  };

  const handleSaveEdit = async () => {
    if (!selectedExercise) return;
    setSavingEdit(true);
    try {
      const newContenu = { ...((selectedExercise.contenu as any) || {}), items: editedItems };
      const { error } = await supabase
        .from("exercices")
        .update({ consigne: editedConsigne, contenu: newContenu, updated_at: new Date().toISOString() })
        .eq("id", selectedExercise.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["today-session-exercises"] });
      setIsEditing(false);
      toast.success("Exercice mis à jour !");
    } catch (e: any) {
      toast.error("Erreur de sauvegarde", { description: e.message });
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePrintTest = () => {
    if (testExercises.length === 0) {
      toast.error("Aucun exercice dans le test.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const renderItems = (items: any[]) => items.map((item: any, j: number) => {
      const optionsHtml = item.options?.length
        ? '<div class="options">' + item.options.map((o: string) => '<div class="option">☐ ' + o + '</div>').join("") + '</div>'
        : '<div class="write-zone"></div>';
      return '<div class="item"><strong>' + (j + 1) + '.</strong> ' + item.question + optionsHtml + '</div>';
    }).join("");

    const exercisesHtml = testExercises.map((ex: any, i: number) =>
      '<div class="exercise"><h2>' + (i + 1) + '. ' + ex.titre + '</h2>' +
      '<span class="badge">' + ex.competence + '</span>' +
      '<span class="badge">' + (formatLabels[ex.format] || ex.format) + '</span>' +
      '<p class="consigne">' + ex.consigne + '</p>' +
      renderItems(ex.contenu?.items || []) + '</div>'
    ).join("");

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Test de validation</title>' +
      '<style>body{font-family:Arial,sans-serif;margin:2cm;font-size:16px;color:#333}h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}.header-info{color:#666;font-size:13px;margin-bottom:20px}.exercise{page-break-inside:avoid;margin-bottom:28px;border:1px solid #ddd;padding:18px;border-radius:8px}.exercise h2{font-size:18px;margin:0 0 6px 0}.badge{display:inline-block;background:#eee;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px}.consigne{font-style:italic;margin:10px 0;font-size:15px}.item{margin:10px 0 10px 16px}.options{margin-left:16px}.option{margin:4px 0;font-size:15px}.write-zone{border:1px dashed #ccc;min-height:80px;margin-top:10px;border-radius:4px}.nom-zone{border-bottom:1px solid #333;width:200px;display:inline-block;margin-left:8px}@media print{body{margin:1cm}}</style></head><body>' +
      '<h1>Test de validation — ' + (nextSession?.titre || "Séance") + '</h1>' +
      '<p class="header-info">Nom : <span class="nom-zone">&nbsp;</span> &nbsp;&nbsp; Date : ' + format(new Date(), "d MMMM yyyy", { locale: fr }) + ' &nbsp;&nbsp; Niveau : ' + (nextSession?.niveau_cible || "") + '</p>' +
      exercisesHtml + '</body></html>';

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
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
          Voici votre cockpit de séance.
        </p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary" onClick={() => navigate("/formateur/groupes")}>
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
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500" onClick={() => navigate("/formateur/groupes")}>
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
                <p className="text-sm text-muted-foreground">{nextSession?.isPast ? "Dernière séance" : "Prochaine séance"}</p>
                {loadingSessions ? <Skeleton className="h-5 w-32 mt-1" /> : nextSession ? (
                  <p className="text-sm font-medium mt-1 line-clamp-1">{format(new Date(nextSession.date_seance), "d MMM · HH:mm", { locale: fr })}</p>
                ) : <p className="text-sm text-muted-foreground mt-1">Aucune</p>}
              </div>
              <Calendar className="h-8 w-8 text-accent opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive relative" onClick={() => { const el = document.querySelector('[data-value="alertes"]') as HTMLElement; el?.click(); }}>
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




      {/* ─── Suivi de progression détaillée ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Suivi de progression détaillé
          </CardTitle>
          <div className="flex items-center gap-3 mt-3">
            <Select value={effectiveProgGroupId} onValueChange={(v) => { setProgGroupId(v); setProgViewId("moyenne"); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Choisir un groupe" />
              </SelectTrigger>
              <SelectContent>
                {progGroupsList.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProgGroup && (
              <Select value={progViewId} onValueChange={setProgViewId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moyenne">Moyenne du groupe</SelectItem>
                  {(selectedProgGroup.eleves ?? []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProgGroup ? (
            <p className="text-sm text-muted-foreground py-4">Sélectionnez un groupe pour voir la progression.</p>
          ) : selectedProgGroup.eleves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Aucun élève inscrit dans ce groupe pour le moment.</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Invitez des élèves depuis la page Groupes & Élèves.
              </p>
            </div>
          ) : progGaugeData ? (
            <div className="space-y-5">
              {progGaugeData.map((comp) => (
                <CompetencyGauge key={comp.label} {...comp} />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Tabs defaultValue="seance-du-jour">
        <TabsList>
          <TabsTrigger value="seance-du-jour">🎯 Ma Séance du Jour</TabsTrigger>
          <TabsTrigger value="groupes">Mes Groupes</TabsTrigger>
          <TabsTrigger value="alertes" data-value="alertes">
            Centre d'Alertes
            {alertCount > 0 && <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">{alertCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: Séance du Jour (Cockpit) ═══ */}
        <TabsContent value="seance-du-jour">
          {loadingSessions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : !nextSession ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/40 mb-3 mx-auto" />
                <p className="text-muted-foreground font-medium">Aucune séance planifiée</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Planifiez votre première séance ou importez un programme.</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button onClick={() => navigate("/formateur/seances")}>Planifier une séance</Button>
                  <Button variant="outline" onClick={() => navigate("/formateur/import-programme")}>Importer un programme</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Session header */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-5 px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <h2 className="text-xl font-bold text-foreground">{nextSession.titre}</h2>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(new Date(nextSession.date_seance), "EEEE d MMMM · HH:mm", { locale: fr })}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{nextSession.group_nom}</span>
                      </div>
                      {nextSession.objectifs && <p className="text-sm text-muted-foreground mt-1">{nextSession.objectifs}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">{nextSession.niveau_cible}</Badge>
                      <Badge variant="secondary">{nextSession.duree_minutes} min</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <Button size="lg" className="gap-2" onClick={() => navigate(`/formateur/seances/${nextSession.id}/pilote`)} disabled={nextSession.statut === "terminee" || nextSession.statut === "annulee"}>
                      <Play className="h-4 w-4" /> {nextSession.statut === "terminee" ? "Séance terminée" : nextSession.statut === "annulee" ? "Séance annulée" : "Lancer la séance"}
                    </Button>
                    <Button variant="default" className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleSendToStudents} disabled={sending || sessionExercises.length === 0}>
                      {sending ? <Clock className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      Envoyer aux élèves ({sessionExercises.length})
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handlePrintSession} disabled={sessionExercises.length === 0}>
                      <Printer className="h-4 w-4" /> Imprimer la séance
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Progress bar */}
              {sessionExercises.length > 0 && (
                <Card>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ClipboardCheck className="h-4 w-4 text-primary" />
                        Progression de la séance
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {completedCount}/{sessionExercises.length} terminé{completedCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Progress value={(completedCount / sessionExercises.length) * 100} className="h-3" />
                  </CardContent>
                </Card>
              )}

              {/* Sub-tabs: Exercices | Test de validation */}
              <Tabs value={sessionSubTab} onValueChange={(v) => setSessionSubTab(v as any)}>
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="exercices" className="gap-2">
                    <ListChecks className="h-4 w-4" />
                    Exercices
                  </TabsTrigger>
                  <TabsTrigger value="test-validation" className="gap-2">
                    <FileCheck className="h-4 w-4" />
                    Test de validation
                    {testExercises.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{testExercises.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Sub-tab: Exercices */}
                <TabsContent value="exercices">
                  {loadingExercises ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
                    </div>
                  ) : sessionExercises.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-10 text-center">
                        <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">Aucun exercice prévu</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Ajoutez des exercices depuis un plan de formation ou le constructeur de séance.</p>
                        <div className="flex gap-2 justify-center mt-4">
                          <Button variant="outline" onClick={() => navigate("/formateur/import-programme")}>Importer un programme</Button>
                          <Button variant="outline" onClick={() => navigate("/formateur/parcours")}>Plans de formation</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          {sessionExercises.length} exercice{sessionExercises.length !== 1 ? "s" : ""} + ateliers
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {sessionExercises.filter((e: any) => e.statut === "traite_en_classe").length} envoyé(s)
                        </Badge>
                      </div>

                      {sessionExercises.map((ex: any, i: number) => {
                        const guide = ex.animation_guide as any;
                        const isSent = ex.statut === "traite_en_classe";
                        const tracking = getTracking(ex.sessionExerciceId);
                        return (
                          <Card key={ex.sessionExerciceId} className={`transition-all ${tracking.isCompleted ? "border-green-500/40 bg-green-50/30 dark:bg-green-950/15" : isSent ? "border-green-500/30 bg-green-50/20 dark:bg-green-950/10" : ""}`}>
                            <CardContent className="py-4 px-5">
                              <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={tracking.isCompleted}
                                    onCheckedChange={(checked) => toggleCompleted(ex.sessionExerciceId, !!checked)}
                                    className="mt-1 h-5 w-5"
                                  />
                                  <div className="flex-1 cursor-pointer hover:bg-muted/30 rounded-lg p-1 -m-1 transition-colors" onClick={() => setSelectedExerciseId(ex.sessionExerciceId)}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                      <span className={`font-semibold text-sm ${tracking.isCompleted ? "line-through text-muted-foreground" : ""}`}>{i + 1}. {ex.titre}</span>
                                      <Badge className={`text-[10px] ${competenceColors[ex.competence] || ""}`}>{ex.competence}</Badge>
                                      <Badge variant="outline" className="text-[10px]">{formatLabels[ex.format] || ex.format}</Badge>
                                      {tracking.isCompleted && <Badge className="text-[10px] bg-green-600 text-white">✓ Fait</Badge>}
                                      {tracking.isIncludedInTest && <Badge variant="secondary" className="text-[10px]">📝 Test</Badge>}
                                      {isSent && !tracking.isCompleted && <Badge className="text-[10px] bg-green-600 text-white">✓ Envoyé</Badge>}
                                      {ex.is_ai_generated && <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 px-1.5 py-0.5 text-[10px] font-semibold">✨ IA</span>}
                                    </div>
                                    <p className="text-sm text-muted-foreground italic mt-1">{ex.consigne}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{ex.contenu?.items?.length || 0} item(s) · <DifficultyBadge level={ex.difficulte} /></p>
                                  </div>
                                </div>

                                {guide && (
                                  <div className="border-t pt-3 ml-8 space-y-1.5">
                                    <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                                      <Gamepad2 className="h-4 w-4" />
                                      Atelier ludique — formateur uniquement
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                      {guide.scenario && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">🎭 Scénario :</span> {guide.scenario}</div>}
                                      {guide.jeu && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">🎲 Jeu :</span> {guide.jeu}</div>}
                                      {guide.materiel && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">📦 Matériel :</span> {guide.materiel}</div>}
                                      {guide.objectif_oral && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">🗣️ Objectif oral :</span> {guide.objectif_oral}</div>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Sub-tab: Test de validation */}
                <TabsContent value="test-validation">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-primary" />
                        Test de validation de fin de séance
                      </CardTitle>
                      <CardDescription>
                        Questions issues des exercices marqués "Fait" avec le switch "Inclure dans le test" activé.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {testExercises.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <ClipboardCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
                          <p className="text-muted-foreground font-medium">Aucun exercice sélectionné pour le test</p>
                          <p className="text-sm text-muted-foreground/70 mt-1">Cochez des exercices comme "Fait" puis activez "Inclure dans le test" dans le panneau de détail.</p>
                          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSessionSubTab("exercices")}>Retour aux exercices</Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs">
                              {testExercises.reduce((acc: number, ex: any) => acc + (ex.contenu?.items?.length || 0), 0)} question(s)
                            </Badge>
                            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrintTest}>
                              <Printer className="h-4 w-4" /> Imprimer le test
                            </Button>
                          </div>
                          {testExercises.map((ex: any, i: number) => (
                            <Card key={ex.sessionExerciceId} className="border-primary/20">
                              <CardContent className="py-4 px-5">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <span className="font-semibold text-sm">{i + 1}. {ex.titre}</span>
                                  <Badge className={`text-[10px] ${competenceColors[ex.competence] || ""}`}>{ex.competence}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{formatLabels[ex.format] || ex.format}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground italic mb-3">{ex.consigne}</p>
                                <div className="space-y-2">
                                  {(ex.contenu?.items || []).map((item: any, j: number) => (
                                    <div key={j} className="p-3 rounded-lg bg-muted/40 border">
                                      <p className="text-sm font-medium mb-1">{j + 1}. {item.question}</p>
                                      {item.options?.length > 0 && (
                                        <div className="ml-4 space-y-1 mt-2">
                                          {item.options.map((opt: string, k: number) => (
                                            <div key={k} className="flex items-center gap-2 text-sm text-muted-foreground">
                                              <span className="h-5 w-5 rounded border flex items-center justify-center text-xs shrink-0">{String.fromCharCode(65 + k)}</span>
                                              {opt}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Next session preview */}
              {followingSession && (
                <div className="flex justify-end pt-2">
                  {!showNextPreview ? (
                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => setShowNextPreview(true)}>
                      Aperçu de la séance suivante <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Card className="w-full border-dashed bg-muted/20">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{followingSession.titre}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(followingSession.date_seance), "EEEE d MMMM · HH:mm", { locale: fr })} · {followingSession.group_nom} · {followingSession.niveau_cible}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => navigate(`/formateur/seances/${followingSession.id}/pilote`)}>Ouvrir</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Exercise Detail Sheet */}
          <Sheet open={!!selectedExerciseId} onOpenChange={(open) => { if (!open) { setSelectedExerciseId(null); setIsEditing(false); } }}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
              {selectedExercise && (() => {
                const tracking = getTracking(selectedExercise.sessionExerciceId);
                const guide = selectedExercise.animation_guide as any;
                const items = isEditing ? editedItems : ((selectedExercise.contenu as any)?.items || []);
                return (
                  <>
                    <SheetHeader>
                      <SheetTitle className="text-lg">{selectedExercise.titre}</SheetTitle>
                      <SheetDescription>
                        <span className="flex items-center gap-2 flex-wrap mt-1">
                          <Badge className={`text-[10px] ${competenceColors[selectedExercise.competence] || ""}`}>{selectedExercise.competence}</Badge>
                          <Badge variant="outline" className="text-[10px]">{formatLabels[selectedExercise.format] || selectedExercise.format}</Badge>
                          <Badge variant="secondary" className="text-[10px]">Difficulté {selectedExercise.difficulte}/10</Badge>
                        </span>
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 mt-6">
                      {/* Tracking controls */}
                      <div className="space-y-4 p-4 rounded-lg border bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Marquer comme fait</span>
                          </div>
                          <Checkbox checked={tracking.isCompleted} onCheckedChange={(checked) => toggleCompleted(selectedExercise.sessionExerciceId, !!checked)} className="h-5 w-5" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Inclure dans le test de validation</span>
                          </div>
                          <Switch checked={tracking.isIncludedInTest} onCheckedChange={(checked) => toggleIncludedInTest(selectedExercise.sessionExerciceId, checked)} />
                        </div>
                      </div>

                      {/* Edit toggle button */}
                      <div className="flex justify-end">
                        {!isEditing ? (
                          <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
                            <Pencil className="h-3.5 w-3.5" /> Modifier l'exercice
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="gap-2" onClick={cancelEditing}>
                              <X className="h-3.5 w-3.5" /> Annuler
                            </Button>
                            <Button size="sm" className="gap-2" onClick={handleSaveEdit} disabled={savingEdit}>
                              <Save className="h-3.5 w-3.5" /> {savingEdit ? "Enregistrement…" : "Enregistrer"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Consigne */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Consigne</h4>
                        {isEditing ? (
                          <Textarea value={editedConsigne} onChange={(e) => setEditedConsigne(e.target.value)} className="min-h-[60px]" />
                        ) : (
                          <p className="text-sm text-muted-foreground italic">{selectedExercise.consigne}</p>
                        )}
                      </div>

                      {/* Questions */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Questions ({items.length})</h4>
                        <div className="space-y-3">
                          {items.map((item: any, j: number) => (
                            <div key={j} className="p-3 rounded-lg bg-muted/30 border space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-semibold text-muted-foreground mt-1 shrink-0">{j + 1}.</span>
                                {isEditing ? (
                                  <Input value={item.question} onChange={(e) => updateItemQuestion(j, e.target.value)} className="flex-1" placeholder="Énoncé de la question" />
                                ) : (
                                  <p className="text-sm font-medium flex-1">{item.question}</p>
                                )}
                                {isEditing && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => removeItem(j)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                              {(item.options?.length > 0 || isEditing) && (
                                <div className="ml-5 space-y-1.5">
                                  {(item.options || []).map((opt: string, k: number) => (
                                    <div key={k} className="flex items-center gap-2">
                                      <span className="h-5 w-5 rounded border flex items-center justify-center text-xs bg-background shrink-0">{String.fromCharCode(65 + k)}</span>
                                      {isEditing ? (
                                        <>
                                          <Input value={opt} onChange={(e) => updateItemOption(j, k, e.target.value)} className="flex-1 h-8 text-sm" placeholder={`Option ${String.fromCharCode(65 + k)}`} />
                                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeItemOption(j, k)}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">{opt}</span>
                                      )}
                                    </div>
                                  ))}
                                  {isEditing && (
                                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 mt-1" onClick={() => addItemOption(j)}>
                                      <Plus className="h-3 w-3" /> Option
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {isEditing && (
                          <Button variant="outline" size="sm" className="gap-2 mt-4 w-full" onClick={addItem}>
                            <Plus className="h-3.5 w-3.5" /> Ajouter une question
                          </Button>
                        )}
                      </div>

                      {/* Animation guide (read-only) */}
                      {guide && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2"><Gamepad2 className="h-4 w-4 text-orange-500" /> Atelier ludique</h4>
                          <div className="grid gap-2 text-xs">
                            {guide.scenario && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">🎭 Scénario :</span> {guide.scenario}</div>}
                            {guide.jeu && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">🎲 Jeu :</span> {guide.jeu}</div>}
                            {guide.materiel && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">📦 Matériel :</span> {guide.materiel}</div>}
                            {guide.objectif_oral && <div className="p-2 rounded bg-muted/50"><span className="font-semibold">🗣️ Objectif oral :</span> {guide.objectif_oral}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* ═══ Tab 2: Mes Groupes ═══ */}
        <TabsContent value="groupes">
          <Card>
            <CardContent className="pt-6">
              {loadingGroupsList ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : groupsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">Aucun groupe actif</p>
                  <Button className="mt-4" onClick={() => navigate("/formateur/groupes")}>Créer un groupe</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupsList.map((g: any) => (
                    <div key={g.id} className="rounded-lg border">
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/formateur/groupes")}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
                          <div>
                            <p className="font-medium text-foreground">{g.nom}</p>
                            <p className="text-xs text-muted-foreground">Niveau {g.niveau} · {g.members.length} élève{g.members.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); navigate("/formateur/groupes"); }}>
                          <UserPlus className="h-3.5 w-3.5" /> Ajouter
                        </Button>
                      </div>
                      {g.members.length > 0 && (
                        <div className="px-4 pb-3 border-t">
                          <div className="space-y-1.5 pt-2">
                            {g.members.map((m: any) => (
                              <div key={m.eleve_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => navigate(`/formateur/eleves/${m.eleve_id}`)}>
                                <span className="text-sm text-foreground">{m.nom}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(m.progression, 100)}%` }} /></div>
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

        {/* ═══ Tab 3: Centre d'Alertes ═══ */}
        <TabsContent value="alertes">
          <Card>
            <CardContent className="pt-6">
              {loadingAllAlerts ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : allAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">Aucune alerte active</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Tous vos élèves progressent normalement. 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allAlerts.map((alert: any) => (
                    <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${alert.is_read ? "bg-muted/20 opacity-70" : "bg-card"}`}>
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
                          {" · "}{format(new Date(alert.created_at), "d MMM HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => navigate(`/formateur/eleves/${alert.eleve_id}`)}>
                          <Eye className="h-3.5 w-3.5" /> Voir
                        </Button>
                        {!alert.is_read && (
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleMarkRead(alert.id)}>Lu</Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 text-xs text-destructive" onClick={() => handleResolveAlert(alert.id)}>Résoudre</Button>
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

