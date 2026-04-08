import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  CheckCircle2, Clock, ArrowRight, Printer, ArrowLeft,
  BookOpen, Minus, Plus, Loader2, Sparkles, Pencil, Trash2, CirclePlus, Circle,
  AlertTriangle, RotateCcw, ClipboardCheck, FileText, Users, Brain, Target,
  Eye, Volume2, ChevronDown, ChevronLeft, ChevronRight, Drama, Package, MessageCircle, Wand2,
  Rocket, Copy, Send, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadge, mapDifficultyToScale10 } from "@/components/DifficultyBadge";
import FeuilleAppel from "@/components/FeuilleAppel";
import LivePilotingSection from "@/components/LivePilotingSection";
import { COMPETENCE_COLORS, resolveSessionCompetences, sortCompetences } from "@/lib/competences";
import GenerateDailyHomeworkDialog from "@/components/GenerateDailyHomeworkDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExerciseStatus = "traite_en_classe" | "reporte" | "planifie";

const statusConfig: Record<ExerciseStatus, { label: string; color: string; icon: React.ElementType }> = {
  traite_en_classe: { label: "Traité", color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800", icon: CheckCircle2 },
  reporte: { label: "Reporté", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", icon: ArrowRight },
  planifie: { label: "Planifié", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

const SessionPilot = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(5);
  const [selectedGenCompetences, setSelectedGenCompetences] = useState<string[]>([]);
  const [generatingHomework, setGeneratingHomework] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteSeId, setDeleteSeId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [dailyHomeworkOpen, setDailyHomeworkOpen] = useState(false);
  const [purgingHomework, setPurgingHomework] = useState(false);
  const [rappelChecked, setRappelChecked] = useState<Record<string, boolean>>({});
  const [rappelDismissed, setRappelDismissed] = useState(false);
  const [validatingRappel, setValidatingRappel] = useState(false);

  // Editor state
  const [editingExercise, setEditingExercise] = useState<any>(null);
  const [editForm, setEditForm] = useState<{ titre: string; consigne: string; contenu: any }>({ titre: "", consigne: "", contenu: { items: [] } });
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<any>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [animationGuide, setAnimationGuide] = useState<any>(null);

  // Duplicate & send to individual students
  const [duplicateExercise, setDuplicateExercise] = useState<any>(null);
  const [duplicateStudentIds, setDuplicateStudentIds] = useState<string[]>([]);
  const [duplicating, setDuplicating] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session-info", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom, id, type_demarche)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sessionExercices, isLoading } = useQuery({
    queryKey: ["session-exercices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, difficulte, niveau_vise, point_a_maitriser_id, animation_guide)")
        .eq("session_id", id!)
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // Fetch reported exercises from previous session
  const { data: reportedExercises } = useQuery({
    queryKey: ["reported-exercises", session?.group_id, id],
    queryFn: async () => {
      if (!session) return [];
      const groupId = (session as any)?.group?.id || session.group_id;
      // Find previous session for this group
      const { data: prevSessions } = await supabase
        .from("sessions")
        .select("id")
        .eq("group_id", groupId)
        .lt("date_seance", session.date_seance)
        .order("date_seance", { ascending: false })
        .limit(1);

      if (!prevSessions || prevSessions.length === 0) return [];

      const prevId = prevSessions[0].id;
      const { data, error } = await supabase
        .from("session_exercices")
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, difficulte, niveau_vise, point_a_maitriser_id, animation_guide)")
        .eq("session_id", prevId)
        .eq("statut", "reporte")
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session,
  });

  // Fetch homework completion stats from previous session (debriefing)
  const { data: homeworkStats } = useQuery({
    queryKey: ["homework-debriefing", session?.group_id, id],
    queryFn: async () => {
      if (!session) return null;
      const groupId = (session as any)?.group?.id || session.group_id;
      // Find previous session
      const { data: prevSessions } = await supabase
        .from("sessions")
        .select("id")
        .eq("group_id", groupId)
        .lt("date_seance", session.date_seance)
        .order("date_seance", { ascending: false })
        .limit(1);

      if (!prevSessions || prevSessions.length === 0) return null;

      const prevSessionId = prevSessions[0].id;
      // Get devoirs linked to previous session
      const { data: devoirs } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(titre, competence), eleve:profiles(nom, prenom)")
        .eq("session_id", prevSessionId);

      if (!devoirs || devoirs.length === 0) return null;

      const total = devoirs.length;
      const done = devoirs.filter((d: any) => d.statut === "fait" || d.statut === "arrete").length;
      const expired = devoirs.filter((d: any) => d.statut === "expire").length;
      const pending = devoirs.filter((d: any) => d.statut === "en_attente").length;

      // Get scores for completed devoirs
      const devoirIds = devoirs.filter((d: any) => d.statut === "fait").map((d: any) => d.id);
      let avgScore = 0;
      let lowScoreItems: { eleve: string; exercice: string; score: number }[] = [];
      if (devoirIds.length > 0) {
        const { data: resultats } = await supabase
          .from("resultats")
          .select("score, eleve_id, exercice_id")
          .in("devoir_id", devoirIds);

        if (resultats && resultats.length > 0) {
          avgScore = Math.round(resultats.reduce((s: number, r: any) => s + Number(r.score), 0) / resultats.length);
          lowScoreItems = resultats
            .filter((r: any) => Number(r.score) < 60)
            .map((r: any) => {
              const devoir = devoirs.find((d: any) => d.exercice_id === r.exercice_id && d.eleve_id === r.eleve_id);
              return {
                eleve: devoir ? `${(devoir as any).eleve?.prenom} ${(devoir as any).eleve?.nom}` : "Élève",
                exercice: (devoir as any)?.exercice?.titre || "Exercice",
                score: Number(r.score),
              };
            });
        }
      }

      return { total, done, expired, pending, avgScore, lowScoreItems, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 };
    },
    enabled: !!session,
  });

  const { data: parcoursSeance } = useQuery({
    queryKey: ["parcours-seance-for-session", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcours_seances")
        .select("*, parcours:parcours(niveau_depart, niveau_cible)")
        .eq("session_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch next session for preview
  const { data: nextSession } = useQuery({
    queryKey: ["next-session-preview", session?.group_id, session?.date_seance],
    queryFn: async () => {
      if (!session) return null;
      const groupId = (session as any)?.group?.id || session.group_id;
      const { data } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, duree_minutes, objectifs, statut")
        .eq("group_id", groupId)
        .gt("date_seance", session.date_seance)
        .order("date_seance", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!session,
  });

  // Fetch next session exercise count
  const { data: nextSessionExCount } = useQuery({
    queryKey: ["next-session-ex-count", nextSession?.id],
    queryFn: async () => {
      if (!nextSession) return 0;
      const { count } = await supabase
        .from("session_exercices")
        .select("id", { count: "exact", head: true })
        .eq("session_id", nextSession.id);
      return count || 0;
    },
    enabled: !!nextSession,
  });

  // Fetch all future sessions for daily homework dialog
  const { data: futureSessions } = useQuery({
    queryKey: ["future-sessions", session?.group_id, session?.date_seance],
    queryFn: async () => {
      if (!session) return [];
      const groupId = (session as any)?.group?.id || session.group_id;
      const { data } = await supabase
        .from("sessions")
        .select("id, titre, date_seance")
        .eq("group_id", groupId)
        .gt("date_seance", session.date_seance)
        .order("date_seance", { ascending: true })
        .limit(10);
      return data ?? [];
    },
    enabled: !!session,
  });

  // Fetch group members for duplicate & send
  const { data: groupMembers } = useQuery({
    queryKey: ["group-members-for-dup", session?.group_id],
    queryFn: async () => {
      const groupId = (session as any)?.group?.id || session!.group_id;
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id, eleve:profiles(id, nom, prenom)")
        .eq("group_id", groupId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!session,
  });

  // === Reconciliation: auto-link parcours_seance → session if exercises are missing ===
  const [reconciling, setReconciling] = useState(false);
  const [reconciled, setReconciled] = useState(false);

  const reconcile = useCallback(async () => {
    if (!session || !id || reconciled || reconciling) return;
    if ((sessionExercices ?? []).length > 0) return; // already has exercises
    if (isLoading) return; // still loading

    setReconciling(true);
    try {
      const groupId = (session as any)?.group?.id || session.group_id;

      // Step 1: Check if parcours_seances already linked to this session but exercises missing
      const { data: linkedPS } = await supabase
        .from("parcours_seances")
        .select("id, parcours_id")
        .eq("session_id", id)
        .maybeSingle();

      if (linkedPS) {
        // parcours_seance linked but no exercises — nothing more to reconcile
        setReconciled(true);
        setReconciling(false);
        return;
      }

      // Step 2: Find parcours for this group, then match by title pattern
      const { data: parcours } = await supabase
        .from("parcours")
        .select("id")
        .eq("group_id", groupId)
        .limit(1)
        .maybeSingle();

      if (!parcours) { setReconciled(true); setReconciling(false); return; }

      // Try to find a parcours_seance with no session_id whose title appears in the session title
      const { data: candidates } = await supabase
        .from("parcours_seances")
        .select("id, titre, ordre, session_id")
        .eq("parcours_id", parcours.id)
        .is("session_id", null)
        .order("ordre");

      if (!candidates || candidates.length === 0) { setReconciled(true); setReconciling(false); return; }

      // Match: session.titre typically is "S{ordre} : {titre}"
      const match = candidates.find((c) => {
        const pattern = `S${c.ordre}`;
        return session.titre?.includes(pattern) && session.titre?.includes(c.titre);
      });

      if (match) {
        // Link it
        await supabase
          .from("parcours_seances")
          .update({ session_id: id })
          .eq("id", match.id);

        // Refetch
        qc.invalidateQueries({ queryKey: ["session-exercices", id] });
        qc.invalidateQueries({ queryKey: ["parcours-seance-for-session", id] });
        toast.success("Séance reliée au parcours automatiquement.");
      }
    } catch (err) {
      console.error("Reconciliation error:", err);
    } finally {
      setReconciled(true);
      setReconciling(false);
    }
  }, [session, id, sessionExercices, isLoading, reconciled, reconciling, qc]);

  // Trigger reconciliation when data is ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (session && !isLoading && (sessionExercices ?? []).length === 0 && !reconciled) {
      reconcile();
    }
  }, [session, isLoading, sessionExercices, reconciled, reconcile]);

  const exercises = sessionExercices ?? [];
  const reported = reportedExercises ?? [];

  const checkedCount = useMemo(
    () => exercises.filter((ex) => checked[ex.id]).length,
    [checked, exercises]
  );

  const toggleExercise = useCallback((exerciseId: string) => {
    setChecked((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  }, []);

  const checkAll = useCallback(() => {
    const allChecked = exercises.every((ex) => checked[ex.id]);
    const newState: Record<string, boolean> = {};
    exercises.forEach((ex) => { newState[ex.id] = !allChecked; });
    setChecked(newState);
  }, [checked, exercises]);

  const checkUpTo = useCallback((index: number) => {
    const newState: Record<string, boolean> = {};
    exercises.forEach((ex, i) => { newState[ex.id] = i <= index; });
    setChecked(newState);
  }, [exercises]);

  const getStatus = (exerciseId: string): ExerciseStatus => {
    if (checked[exerciseId]) return "traite_en_classe";
    if (checkedCount > 0) return "reporte";
    return "planifie";
  };

  // ─── Send checked exercises to students ───
  const handleSendToStudents = async () => {
    const checkedIds = exercises.filter((ex) => checked[ex.id]).map((ex) => ex.id);
    if (checkedIds.length === 0) {
      toast.warning("Cochez au moins un exercice à envoyer.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase
        .from("session_exercices")
        .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
        .in("id", checkedIds);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["session-exercices", id] });
      toast.success(`${checkedIds.length} exercice(s) envoyé(s) aux élèves du groupe !`);
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  // ─── Reported exercise actions ───
  const handleKeepReported = async (se: any) => {
    // Transfer to current session
    try {
      const maxOrdre = exercises.length;
      const { error } = await supabase
        .from("session_exercices")
        .update({ session_id: id!, ordre: maxOrdre + 1, statut: "planifie" as any, updated_at: new Date().toISOString() })
        .eq("id", se.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["session-exercices", id] });
      qc.invalidateQueries({ queryKey: ["reported-exercises"] });
      toast.success("Exercice transféré à cette séance.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleToHomework = async (se: any) => {
    if (!session || !user) return;
    try {
      const groupId = (session as any)?.group?.id || session.group_id;
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id")
        .eq("group_id", groupId);

      if (members && members.length > 0) {
        const devoirs = members.map((m: any) => ({
          eleve_id: m.eleve_id,
          exercice_id: (se as any).exercice_id,
          formateur_id: user.id,
          raison: "remediation" as const,
          statut: "en_attente" as const,
          session_id: id,
        }));
        const { error } = await supabase.from("devoirs").insert(devoirs as any);
        if (error) throw error;
      }
      // Mark as devoir_remediation
      await supabase
        .from("session_exercices")
        .update({ statut: "devoir_remediation" as any, updated_at: new Date().toISOString() })
        .eq("id", se.id);

      qc.invalidateQueries({ queryKey: ["reported-exercises"] });
      toast.success("Exercice basculé en devoirs pour tous les élèves.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleDeleteReported = async (seId: string) => {
    try {
      const { error } = await supabase.from("session_exercices").delete().eq("id", seId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["reported-exercises"] });
      setDeleteConfirm(null);
      toast.success("Exercice reporté supprimé.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // ─── AI Generation ───
  const handleGenerateExercises = async () => {
    if (!session || !user) return;
    setGenerating(true);
    try {
      const niveauVise = session.niveau_cible || (parcoursSeance as any)?.parcours?.niveau_cible || "A1";
      // Use explicitly selected competences, or fallback to session/parcours/CE
      const sessionComps = (session as any)?.competences_cibles;
      const parcoursComps = (parcoursSeance as any)?.competences_cibles;
      const fallbackComps = (sessionComps && sessionComps.length > 0)
        ? sessionComps
        : (parcoursComps && parcoursComps.length > 0)
          ? parcoursComps
          : ["CE"];
      const competences: string[] = selectedGenCompetences.length > 0
        ? selectedGenCompetences
        : fallbackComps;

      const objectif = (parcoursSeance as any)?.objectif_principal || session.objectifs || "Exercice de séance";
      const count = generateCount;

      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();

      if (!defaultPoint) {
        toast.error("Aucun point à maîtriser trouvé. Importez d'abord un programme.");
        return;
      }

      // Distribute count across selected competences
      const perComp = Math.max(1, Math.floor(count / competences.length));
      const remainder = count - perComp * competences.length;

      let allInserted: any[] = [];
      for (let ci = 0; ci < competences.length; ci++) {
        const comp = competences[ci];
        const compCount = perComp + (ci < remainder ? 1 : 0);
        if (compCount <= 0) continue;

        const { data, error } = await supabase.functions.invoke("generate-exercises", {
          body: { pointName: objectif, competence: comp, niveauVise, count: compCount, type_demarche: (session as any)?.group?.type_demarche || "titre_sejour", groupId: (session as any)?.group_id },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const generated = data?.exercises ?? [];
        if (generated.length === 0) continue;

        const exercisesToInsert = generated.map((ex: any) => ({
          titre: ex.titre,
          consigne: ex.consigne,
          competence: comp as any,
          format: (ex.format || "qcm") as any,
          difficulte: ex.difficulte || 3,
          contenu: ex.contenu || {},
          animation_guide: ex.animation_guide || null,
          niveau_vise: niveauVise,
          formateur_id: user.id,
          point_a_maitriser_id: defaultPoint.id,
          is_ai_generated: true,
          is_template: false,
          is_devoir: false,
        }));

        const { data: inserted, error: insertErr } = await supabase
          .from("exercices")
          .insert(exercisesToInsert)
          .select("id");
        if (insertErr) throw insertErr;
        allInserted.push(...(inserted ?? []));
      }

      if (allInserted.length === 0) {
        toast.warning("Aucun exercice généré.");
        return;
      }

      const currentMax = exercises.length;
      const sessionExLinks = allInserted.map((ex: any, i: number) => ({
        session_id: id!,
        exercice_id: ex.id,
        ordre: currentMax + i + 1,
        statut: "planifie" as any,
      }));

      const { error: linkErr } = await supabase.from("session_exercices").insert(sessionExLinks);
      if (linkErr) throw linkErr;

      qc.invalidateQueries({ queryKey: ["session-exercices", id] });
      const compLabel = competences.length === 1 ? competences[0] : competences.join(", ");
      toast.success(`${allInserted.length} exercice(s) généré(s) (${compLabel}) !`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Individualized Homework Generator ───
  const handleGenerateHomework = async () => {
    if (!session || !user) return;
    setGeneratingHomework(true);
    try {
      const groupId = (session as any)?.group?.id || session.group_id;
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id")
        .eq("group_id", groupId);

      if (!members || members.length === 0) {
        toast.warning("Aucun élève dans ce groupe.");
        return;
      }

      const eleveIds = members.map((m: any) => m.eleve_id);

      // Fetch individual student competency levels
      const { data: studentLevels } = await supabase
        .from("student_competency_levels")
        .select("eleve_id, competence, niveau_actuel")
        .in("eleve_id", eleveIds);

      // Build level map: eleve_id -> { CO: 3, CE: 5, ... }
      const levelMap = new Map<string, Record<string, number>>();
      (studentLevels ?? []).forEach((sl: any) => {
        const existing = levelMap.get(sl.eleve_id) || {};
        existing[sl.competence] = sl.niveau_actuel;
        levelMap.set(sl.eleve_id, existing);
      });

      // Collect exercises from this session
      const sessionExs = exercises.map((se: any) => se.exercice).filter(Boolean);
      if (sessionExs.length === 0) {
        toast.warning("Aucun exercice dans la séance.");
        return;
      }

      // Group exercises by competence for AI generation per student level
      const competences = [...new Set(sessionExs.map((ex: any) => ex.competence))];
      
      // For students with different levels, generate individualized exercises via AI
      let totalDevoirs = 0;
      const defaultPoint = sessionExs[0]?.point_a_maitriser_id;

      for (const eleve_id of eleveIds) {
        const studentLevel = levelMap.get(eleve_id) || {};
        
        for (const comp of competences) {
          const level = studentLevel[comp] ?? 5; // Default to middle level
          const sessionExsForComp = sessionExs.filter((ex: any) => ex.competence === comp);
          
          if (sessionExsForComp.length === 0) continue;

          // If student level matches exercise difficulty (±1), assign the session exercise directly
          const matchingExs = sessionExsForComp.filter((ex: any) => {
            const exLevel = ex.difficulte <= 5 ? ex.difficulte * 2 : ex.difficulte;
            return Math.abs(exLevel - level) <= 2;
          });

          const exercisesToAssign = matchingExs.length > 0 ? matchingExs : sessionExsForComp;

          const devoirs = exercisesToAssign.map((ex: any) => ({
            eleve_id,
            exercice_id: ex.id,
            formateur_id: user.id,
            raison: "consolidation" as const,
            statut: "en_attente" as const,
            session_id: id,
          }));

          if (devoirs.length > 0) {
            const { error } = await supabase.from("devoirs").insert(devoirs as any);
            if (error) throw error;
            totalDevoirs += devoirs.length;
          }
        }
      }

      toast.success(`${totalDevoirs} devoir(s) individualisé(s) pour ${members.length} élève(s) !`, {
        description: "Calibrés sur le niveau validé de chaque élève.",
      });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setGeneratingHomework(false);
    }
  };

  // ─── Purge pending homework for this session ───
  const handlePurgeHomework = async () => {
    setPurgingHomework(true);
    try {
      const { error } = await supabase
        .from("devoirs")
        .delete()
        .eq("session_id", id!)
        .eq("statut", "en_attente");
      if (error) throw error;
      toast.success("Devoirs en attente purgés pour cette séance.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setPurgingHomework(false);
    }
  };

  // ─── Generate Daily Homework via AI ───
  const handleGenerateDailyHomework = async (params: {
    targetSessionId: string;
    dailyDuration: number;
    targetDays: number;
    targetWeaknesses: boolean;
  }) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("generate-daily-homework", {
        body: {
          sessionId: id,
          dailyDuration: params.dailyDuration,
          targetDays: params.targetDays,
          targetWeaknesses: params.targetWeaknesses,
          formateurId: user.id,
          type_demarche: (session as any)?.group?.type_demarche || "titre_sejour",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `${data.totalExercices} exercice(s) répartis sur ${data.totalJours} jour(s) !`,
        { description: `${data.totalDevoirs} devoirs créés au total.` }
      );
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
      throw e;
    }
  };

  // ─── Duplicate exercise & send to individual students ───
  const handleDuplicateAndSend = async () => {
    if (!duplicateExercise || duplicateStudentIds.length === 0 || !user || !session) return;
    setDuplicating(true);
    try {
      const ex = duplicateExercise;
      // Generate new exercise with same params but fresh items
      const { data: genData, error: genError } = await supabase.functions.invoke("generate-exercises", {
        body: {
          pointName: ex.titre || "Exercice individuel",
          competence: ex.competence,
          niveauVise: ex.niveau_vise || session.niveau_cible || "A1",
          count: 1,
          type_demarche: (session as any)?.group?.type_demarche || "titre_sejour",
        },
      });
      if (genError) throw genError;
      if (genData?.error) throw new Error(genData.error);

      const generated = genData?.exercises?.[0];
      if (!generated) throw new Error("Aucun exercice généré");

      // Create one exercise per student with fresh items
      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();

      for (const studentId of duplicateStudentIds) {
        // Insert a new exercise specifically for this student
        const { data: newEx, error: exErr } = await supabase
          .from("exercices")
          .insert({
            titre: `${generated.titre || ex.titre} (individuel)`,
            consigne: generated.consigne || ex.consigne,
            competence: ex.competence,
            format: (generated.format || ex.format || "qcm") as any,
            difficulte: generated.difficulte || ex.difficulte || 3,
            contenu: generated.contenu || {},
            animation_guide: generated.animation_guide || null,
            niveau_vise: ex.niveau_vise || session.niveau_cible || "A1",
            formateur_id: user.id,
            point_a_maitriser_id: ex.point_a_maitriser_id || defaultPoint?.id,
            is_ai_generated: true,
            is_template: false,
            is_devoir: true,
            eleve_id: studentId,
          })
          .select("id")
          .single();
        if (exErr) throw exErr;

        // Create a devoir for this student
        const { error: devErr } = await supabase.from("devoirs").insert({
          eleve_id: studentId,
          exercice_id: newEx!.id,
          formateur_id: user.id,
          raison: "consolidation" as const,
          statut: "en_attente" as const,
          session_id: id,
        });
        if (devErr) throw devErr;
      }

      toast.success(`Exercice dupliqué et envoyé à ${duplicateStudentIds.length} élève(s) !`);
      setDuplicateExercise(null);
      setDuplicateStudentIds([]);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de duplication", { description: e.message });
    } finally {
      setDuplicating(false);
    }
  };

  // ─── Inline Editor ───
  const openEditor = (se: any) => {
    const ex = se.exercice;
    if (!ex) return;
    setEditingExercise(ex);
    const contenu = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
    setEditForm({
      titre: ex.titre || "",
      consigne: ex.consigne || "",
      contenu: { items: Array.isArray((contenu as any).items) ? (contenu as any).items : [] },
    });
  };

  const updateEditItem = (idx: number, field: string, value: any) => {
    setEditForm((prev) => {
      const items = [...prev.contenu.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, contenu: { items } };
    });
  };

  const updateEditItemOption = (itemIdx: number, optIdx: number, value: string) => {
    setEditForm((prev) => {
      const items = [...prev.contenu.items];
      const options = [...(items[itemIdx].options || [])];
      options[optIdx] = value;
      items[itemIdx] = { ...items[itemIdx], options };
      return { ...prev, contenu: { items } };
    });
  };

  const addEditItemOption = (itemIdx: number) => {
    setEditForm((prev) => {
      const items = [...prev.contenu.items];
      const options = [...(items[itemIdx].options || []), ""];
      items[itemIdx] = { ...items[itemIdx], options };
      return { ...prev, contenu: { items } };
    });
  };

  const removeEditItemOption = (itemIdx: number, optIdx: number) => {
    setEditForm((prev) => {
      const items = [...prev.contenu.items];
      const options = [...(items[itemIdx].options || [])];
      options.splice(optIdx, 1);
      items[itemIdx] = { ...items[itemIdx], options };
      return { ...prev, contenu: { items } };
    });
  };

  const addEditItem = () => {
    setEditForm((prev) => ({
      ...prev,
      contenu: { items: [...prev.contenu.items, { question: "", options: ["", ""], bonne_reponse: "", explication: "" }] },
    }));
  };

  const removeEditItem = (idx: number) => {
    setEditForm((prev) => {
      const items = [...prev.contenu.items];
      items.splice(idx, 1);
      return { ...prev, contenu: { items } };
    });
  };

  const saveEdit = async () => {
    if (!editingExercise) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("exercices")
        .update({
          titre: editForm.titre,
          consigne: editForm.consigne,
          contenu: editForm.contenu as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingExercise.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["session-exercices", id] });
      toast.success("Exercice mis à jour !");
      setEditingExercise(null);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSavingEdit(false);
    }
  };

  // ─── Save Bilan ───
  const handleSave = async () => {
    if (checkedCount === 0) {
      toast.error("Cochez au moins un exercice traité.");
      return;
    }
    setSaving(true);
    try {
      const checkedIdsArr = exercises.filter((e) => checked[e.id]).map((e) => e.id);
      if (checkedIdsArr.length > 0) {
        const { error } = await supabase
          .from("session_exercices")
          .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
          .in("id", checkedIdsArr);
        if (error) throw error;
      }

      const uncheckedIdsArr = exercises.filter((e) => !checked[e.id]).map((e) => e.id);
      if (uncheckedIdsArr.length > 0) {
        const { error } = await supabase
          .from("session_exercices")
          .update({ statut: "reporte" as any, updated_at: new Date().toISOString() })
          .in("id", uncheckedIdsArr);
        if (error) throw error;
      }

      toast.success("Avancement sauvegardé !", {
        description: `${checkedCount} traité(s), ${exercises.length - checkedCount} reporté(s).`,
      });
      navigate(`/formateur/seances/${id}/bilan`);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const handlePrintAll = () => {
    const allExercises = exercises.map((se: any) => se.exercice).filter(Boolean);
    if (allExercises.length === 0) { toast.warning("Aucun exercice à imprimer."); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up bloqué."); return; }
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${session?.titre || "Séance"} — CAP TCF</title>
<style>
body { font-family: 'Segoe UI', sans-serif; padding: 24px; font-size: 13pt; color: #222; }
h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 20px; }
.exercise { page-break-inside: avoid; margin-bottom: 28px; border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
.exercise h2 { font-size: 14pt; margin: 0 0 4px; }
.exercise .meta { font-size: 10pt; color: #666; margin-bottom: 8px; }
.exercise .consigne { font-style: italic; margin-bottom: 12px; font-size: 12pt; }
.question { margin-bottom: 14px; }
.question p { font-weight: 600; margin-bottom: 6px; }
.option { padding: 4px 0 4px 20px; position: relative; }
.option::before { content: "☐"; position: absolute; left: 0; }
.write-zone { border: 1px dashed #aaa; height: 60px; border-radius: 4px; margin-top: 6px; }
@media print { body { padding: 0; } }
</style></head><body>
<h1>📝 ${session?.titre || "Séance"} — ${allExercises.length} exercice(s)</h1>
<p style="font-size:10pt;color:#666;">${(session as any)?.group?.nom || ""} · ${new Date().toLocaleDateString("fr-FR")} — CAP TCF</p>
${allExercises.map((ex: any, i: number) => {
      const c = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
      const its: any[] = Array.isArray((c as any).items) ? (c as any).items : [];
      return `<div class="exercise">
<h2>${i + 1}. ${ex.titre}</h2>
<div class="meta">${ex.competence} · ${ex.format?.replace(/_/g, " ")} · Niveau ${ex.niveau_vise} · Difficulté ${ex.difficulte}/5</div>
<div class="consigne">${ex.consigne}</div>
${its.map((item: any, qi: number) => `<div class="question">
<p>Q${qi + 1}. ${item.question || ""}</p>
${Array.isArray(item.options) && item.options.length > 0
        ? item.options.map((o: string) => `<div class="option">${o}</div>`).join("")
        : '<div class="write-zone"></div>'}
</div>`).join("")}
</div>`;
    }).join("")}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handlePrint = () => window.print();

  const handlePrintMateriel = () => {
    const allExs = exercises.map((se: any) => se.exercice).filter(Boolean);
    const exsWithDocs = allExs.filter((ex: any) => ex.animation_guide?.documentation_fournie);
    if (exsWithDocs.length === 0) {
      toast.warning("Aucun atelier ludique avec documentation à imprimer.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up bloqué."); return; }
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Matériel Ateliers — ${session?.titre || "Séance"}</title>
<style>
body { font-family: 'Segoe UI', sans-serif; padding: 24px; font-size: 13pt; color: #222; max-width: 210mm; margin: 0 auto; }
h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 20px; }
h2 { font-size: 15pt; margin: 24px 0 8px; color: #333; page-break-before: always; }
h2:first-of-type { page-break-before: auto; }
.guide { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 20px; white-space: pre-line; font-size: 12pt; }
.guide-label { font-weight: 700; color: #92400e; margin-bottom: 8px; display: block; }
.atelier-info { background: #fef3c7; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 11pt; }
.atelier-info strong { display: inline-block; min-width: 120px; }
.fiche { border: 2px solid #333; border-radius: 8px; padding: 20px; margin-bottom: 16px; page-break-before: always; page-break-inside: avoid; }
.fiche h3 { font-size: 16pt; margin: 0 0 12px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
.fiche .contenu { white-space: pre-line; font-size: 14pt; line-height: 1.8; }
.lexique { margin-top: 16px; padding: 12px; background: #f0f9ff; border-radius: 6px; border: 1px solid #bae6fd; }
.lexique span { font-weight: 700; color: #1e40af; }
@media print { body { padding: 0; margin: 0; } .fiche { page-break-before: always; } h2 { page-break-before: always; } h2:first-of-type { page-break-before: auto; } }
</style></head><body>
<h1>📦 Matériel Ateliers — ${session?.titre || "Séance"}</h1>
<p style="font-size:10pt;color:#666;">${(session as any)?.group?.nom || ""} · ${new Date().toLocaleDateString("fr-FR")} — CAP TCF</p>
${exsWithDocs.map((ex: any, i: number) => {
      const ag = ex.animation_guide;
      const doc = ag.documentation_fournie;
      return `
<h2>${i + 1}. ${ex.titre} — Guide Formateur</h2>
<div class="atelier-info">
<strong>🎭 Scénario :</strong> ${ag.scenario || ""}<br/>
<strong>🎲 Jeu :</strong> ${ag.jeu || ""}<br/>
<strong>📦 Matériel :</strong> ${ag.materiel || ""}<br/>
<strong>🗣️ Objectif oral :</strong> ${ag.objectif_oral || ""}
${ag.variante ? `<br/><strong>💡 Variante :</strong> ${ag.variante}` : ""}
</div>
<div class="guide">
<span class="guide-label">📋 Guide formateur détaillé :</span>
${doc.guide_formateur || ""}
</div>
${Array.isArray(doc.fiches_eleves) ? doc.fiches_eleves.map((fiche: any, fi: number) => `
<div class="fiche">
<h3>📄 Fiche Élève ${fi + 1} — ${fiche.titre_fiche || ""}</h3>
<div class="contenu">${fiche.contenu_fiche || ""}</div>
${Array.isArray(fiche.lexique_cles) && fiche.lexique_cles.length > 0 ? `
<div class="lexique"><span>📝 Lexique clé :</span> ${fiche.lexique_cles.join(" · ")}</div>` : ""}
</div>`).join("") : ""}`;
    }).join("")}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  // ─── Delete single exercise from session ───
  const handleDeleteExercise = async (seId: string) => {
    try {
      const { error } = await supabase.from("session_exercices").delete().eq("id", seId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["session-exercices", id] });
      setDeleteSeId(null);
      toast.success("Exercice retiré de la séance.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // ─── Clear all exercises from session ───
  const handleClearExercises = async () => {
    try {
      const { error } = await supabase.from("session_exercices").delete().eq("session_id", id!);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["session-exercices", id] });
      setClearConfirm(false);
      setChecked({});
      toast.success("Tous les exercices ont été retirés de la séance.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Pilote de séance</h1>
          <p className="text-sm text-muted-foreground">
            {session?.titre || "Séance"} · {(session as any)?.group?.nom} · {exercises.length} exercice(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSendToStudents}
            disabled={sending || checkedCount === 0}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Envoyer aux élèves ({checkedCount})
          </Button>
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex items-center gap-0.5">
              {(["CO","CE","EE","EO","Structures"] as const).map((comp) => {
                const sessionComps = (session as any)?.competences_cibles ?? [];
                const isSessionComp = sessionComps.includes(comp);
                const isSelected = selectedGenCompetences.includes(comp);
                return (
                  <Button
                    key={comp}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "h-7 px-2 text-xs font-medium",
                      !isSelected && isSessionComp && "border-primary/50 text-primary",
                      !isSelected && !isSessionComp && "opacity-50"
                    )}
                    onClick={() => setSelectedGenCompetences((prev) =>
                      prev.includes(comp) ? prev.filter((c) => c !== comp) : [...prev, comp]
                    )}
                  >
                    {comp}
                  </Button>
                );
              })}
            </div>
            <Select value={String(generateCount)} onValueChange={(v) => setGenerateCount(Number(v))}>
              <SelectTrigger className="w-[70px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,5,8,10,15,20].map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerateExercises} disabled={generating} variant="outline" className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              ✨ Générer IA
            </Button>
          </div>
          <Button onClick={() => setDailyHomeworkOpen(true)} disabled={generatingHomework || exercises.length === 0} variant="outline" className="gap-2">
            {generatingHomework ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Générer devoirs
          </Button>
          <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={purgingHomework} onClick={handlePurgeHomework}>
            {purgingHomework ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Purger devoirs
          </Button>
          <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={exercises.length === 0} onClick={() => setClearConfirm(true)}>
            <Trash2 className="h-4 w-4" />
            Vider
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">Fiche Séance — CAP TCF</h1>
        <p className="text-muted-foreground">
          {session?.titre} · {exercises.length} exercices · {new Date().toLocaleDateString("fr-FR")}
        </p>
      </div>

      {/* ─── Competence Coverage Synthesis ─── */}
      {(() => {
        const cibles = resolveSessionCompetences(
          (session as any)?.competences_cibles,
          []
        );
        const exerciseComps = sortCompetences(
          [...new Set(exercises.map((ex: any) => ex.exercice?.competence).filter(Boolean))]
        );
        // Count exercises per competence
        const compCounts: Record<string, number> = {};
        exercises.forEach((ex: any) => {
          const c = ex.exercice?.competence;
          if (c) compCounts[c] = (compCounts[c] || 0) + 1;
        });
        const hasCibles = cibles.length > 0;
        const uncovered = cibles.filter((c) => !exerciseComps.includes(c));

        return (
          <Card className="print:hidden border-primary/20">
            <CardContent className="py-4">
              <div className="space-y-3">
                {/* Cibles */}
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Compétences ciblées</p>
                    {hasCibles ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {cibles.map((c) => (
                          <span key={c} className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${COMPETENCE_COLORS[c] || ""}`}>
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Aucune compétence ciblée déclarée</p>
                    )}
                  </div>
                </div>

                {/* Couverture */}
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Couverture réelle</p>
                    {exerciseComps.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {exerciseComps.map((c) => (
                          <span key={c} className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${COMPETENCE_COLORS[c] || ""}`}>
                            {c} <span className="ml-1 opacity-70">({compCounts[c] || 0})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Aucun exercice rattaché</p>
                    )}
                  </div>
                </div>

                {/* Écart */}
                {uncovered.length > 0 && (
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/30">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                        {uncovered.length === 1 ? "Compétence ciblée non couverte" : `${uncovered.length} compétences ciblées non couvertes`}
                      </p>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {uncovered.map((c) => (
                          <span key={c} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ─── Session Summary Card ─── */}
      <Card className="print:hidden">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">{exercises.length}</p>
              <p className="text-[11px] text-muted-foreground">Exercices prévus</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-green-600">{checkedCount}</p>
              <p className="text-[11px] text-muted-foreground">Réalisés</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{session?.duree_minutes || 180} min</p>
              <p className="text-[11px] text-muted-foreground">Durée prévue</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">~{exercises.length > 0 ? Math.round((session?.duree_minutes || 180) / exercises.length) : 0} min</p>
              <p className="text-[11px] text-muted-foreground">Par exercice</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={handlePrintAll}>
              <Printer className="h-4 w-4" />Tout imprimer pour la classe
            </Button>
            {exercises.some((se: any) => se.exercice?.animation_guide?.documentation_fournie) && (
              <Button variant="outline" className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950" onClick={handlePrintMateriel}>
                <Drama className="h-4 w-4" />🖨️ Imprimer matériel ateliers
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {homeworkStats && homeworkStats.total > 0 && (
        <Card className="border-primary/20 print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Bilan des devoirs (séance précédente)
            </CardTitle>
            <CardDescription>Débriefing de début de cours — 5 à 10 minutes suggérées</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">{homeworkStats.completionRate}%</p>
                <p className="text-[11px] text-muted-foreground">Complétion</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-green-600">{homeworkStats.done}</p>
                <p className="text-[11px] text-muted-foreground">Faits</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-orange-600">{homeworkStats.pending}</p>
                <p className="text-[11px] text-muted-foreground">En attente</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{homeworkStats.avgScore > 0 ? `${homeworkStats.avgScore}%` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Score moyen</p>
              </div>
            </div>
            <Progress value={homeworkStats.completionRate} className="h-2" />
            {homeworkStats.lowScoreItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Points de blocage détectés
                </p>
                <div className="space-y-1">
                  {homeworkStats.lowScoreItems.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded-md bg-destructive/5 border border-destructive/10">
                      <span className="font-medium">{item.eleve}</span>
                      <span className="text-muted-foreground">{item.exercice}</span>
                      <Badge variant="destructive" className="text-[10px]">{item.score}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Feuille d'appel ─── */}
      {session && (
        <div className="print:hidden">
          <FeuilleAppel sessionId={id!} session={session as any} />
        </div>
      )}

      {/* ─── Pilotage en direct ─── */}
      {session && user && (
        <LivePilotingSection
          sessionId={id!}
          session={session}
          exercises={exercises}
          groupMembers={groupMembers ?? []}
          userId={user.id}
        />
      )}

      {/* ─── Bloc 0: Rappel — Exercices reportés (séance N-1) ─── */}
      {reported.length > 0 && !rappelDismissed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800 p-3 mb-4 print:hidden">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5"/>Révision — séance précédente
          </h3>
          <div className="space-y-1">
            {reported.map((se: any) => {
              const ex = se.exercice;
              return (
                <label key={se.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors">
                  <Checkbox
                    checked={!!rappelChecked[se.id]}
                    onCheckedChange={() => setRappelChecked((prev) => ({ ...prev, [se.id]: !prev[se.id] }))}
                  />
                  <span className="text-sm flex-1 truncate font-medium">{ex?.titre || "Exercice"}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{ex?.competence}</Badge>
                </label>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 gap-2"
              disabled={validatingRappel || !Object.values(rappelChecked).some(Boolean)}
              onClick={async () => {
                setValidatingRappel(true);
                try {
                  const toValidate = reported.filter((se: any) => rappelChecked[se.id]).map((se: any) => se.id);
                  if (toValidate.length > 0) {
                    const { error } = await supabase
                      .from("session_exercices")
                      .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
                      .in("id", toValidate);
                    if (error) throw error;
                    qc.invalidateQueries({ queryKey: ["reported-exercises"] });
                    toast.success(`${toValidate.length} exercice(s) validé(s) !`);
                    setRappelChecked({});
                  }
                } catch (e: any) {
                  toast.error("Erreur", { description: e.message });
                } finally {
                  setValidatingRappel(false);
                }
              }}
            >
              {validatingRappel ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Valider le rappel
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={() => setRappelDismissed(true)}>
              <ArrowRight className="h-4 w-4" />Garder en devoirs
            </Button>
          </div>
        </div>
      )}

      {/* ─── Couverture des épreuves ─── */}
      {exercises.length > 0 && (() => {
        const compCounts: Record<string, number> = { CO: 0, CE: 0, EE: 0, EO: 0 };
        exercises.forEach((se: any) => {
          const comp = se.exercice?.competence;
          if (comp && comp in compCounts) compCounts[comp]++;
        });
        return (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-1">Couverture :</span>
            {Object.entries(compCounts).map(([comp, count]) => (
              <Badge
                key={comp}
                variant="outline"
                className={cn(
                  "text-xs font-medium",
                  count >= 3
                    ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                    : count > 0
                    ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {comp} ({count})
              </Badge>
            ))}
          </div>
        );
      })()}

      {/* ─── Séance du jour label ─── */}
      {exercises.length > 0 && (
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
          📅 Séance du jour
        </h3>
      )}

      {exercises.length === 0 && reported.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun exercice rattaché</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              Générez des exercices IA ou rattachez-en depuis la page Séances.
            </p>
            <div className="flex items-center gap-1 mb-3 justify-center flex-wrap">
              {(["CO","CE","EE","EO","Structures"] as const).map((comp) => {
                const sessionComps = (session as any)?.competences_cibles ?? [];
                const isSessionComp = sessionComps.includes(comp);
                const isSelected = selectedGenCompetences.includes(comp);
                return (
                  <Button
                    key={comp}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "h-7 px-2 text-xs font-medium",
                      !isSelected && isSessionComp && "border-primary/50 text-primary",
                      !isSelected && !isSessionComp && "opacity-50"
                    )}
                    onClick={() => setSelectedGenCompetences((prev) =>
                      prev.includes(comp) ? prev.filter((c) => c !== comp) : [...prev, comp]
                    )}
                  >
                    {comp}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 justify-center">
              <Select value={String(generateCount)} onValueChange={(v) => setGenerateCount(Number(v))}>
                <SelectTrigger className="w-[70px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,5,8,10,15,20].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateExercises} disabled={generating} variant="outline" className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Générer des exercices IA
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : exercises.length > 0 && (
        <>
          {/* Quick Controls */}
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Avancement de la séance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Curseur rapide :</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => {
                      const firstUnchecked = exercises.findIndex((ex) => !checked[ex.id]);
                      if (firstUnchecked > 0) checkUpTo(firstUnchecked - 2);
                      else if (firstUnchecked === -1) checkUpTo(exercises.length - 2);
                      else setChecked({});
                    }}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1 flex-wrap">
                    {exercises.map((ex, i) => (
                      <button key={ex.id} onClick={() => checkUpTo(i)}
                        className={cn(
                          "h-8 w-8 rounded-md text-xs font-semibold border transition-colors",
                          checked[ex.id]
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-accent"
                        )}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => {
                      const firstUnchecked = exercises.findIndex((ex) => !checked[ex.id]);
                      if (firstUnchecked >= 0) checkUpTo(firstUnchecked);
                    }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 text-sm flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 text-xs font-medium dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                  <CheckCircle2 className="h-3 w-3" />{checkedCount} traité(s)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-xs font-medium dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
                  <ArrowRight className="h-3 w-3" />{checkedCount > 0 ? exercises.length - checkedCount : 0} reporté(s)
                </span>
                <button onClick={checkAll} className="text-xs text-primary hover:underline ml-auto">
                  {exercises.every((ex) => checked[ex.id]) ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Valider et passer au bilan
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />Imprimer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Exercise List — Accordion */}
          <Accordion type="multiple" className="space-y-2">
            {exercises.map((se, i) => {
              const ex = (se as any).exercice;
              const status = getStatus(se.id);
              const config = statusConfig[status];
              const StatusIcon = config.icon;
              const isChecked = !!checked[se.id];
              const contenu = typeof ex?.contenu === "object" && ex?.contenu !== null ? ex.contenu : { items: [] };
              const items: any[] = Array.isArray((contenu as any).items) ? (contenu as any).items : [];

              return (
                <AccordionItem key={se.id} value={se.id} className={cn(
                  "border rounded-lg transition-all print:break-inside-avoid",
                  isChecked && "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30",
                  !isChecked && checkedCount > 0 && "opacity-60"
                )}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="pt-0.5 print:hidden">
                      <Checkbox checked={isChecked} onCheckedChange={() => toggleExercise(se.id)}
                        className="h-5 w-5" />
                    </div>
                    <div className={cn("flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold shrink-0 border", config.color)}>
                      {i + 1}
                    </div>
                    <AccordionTrigger className="flex-1 min-w-0 py-0 hover:no-underline">
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <h3 className="font-semibold text-sm">{ex?.titre || "Exercice"}</h3>
                        <Badge variant="secondary" className="text-[10px]">{ex?.competence}</Badge>
                        <Badge variant="outline" className="text-[10px]">{ex?.format?.replace(/_/g, " ")}</Badge>
                        <DifficultyBadge level={mapDifficultyToScale10(ex?.difficulte || 3)} />
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border print:hidden", config.color)}>
                          <StatusIcon className="h-3 w-3" />{config.label}
                        </span>
                        {ex?.is_ai_generated && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 px-2 py-0.5 text-[10px] font-semibold print:hidden">
                            ✨ IA
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold print:hidden">
                          <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                          En ligne
                        </span>
                      </div>
                    </AccordionTrigger>
                    <div className="flex gap-1 shrink-0 print:hidden">
                      {ex?.animation_guide && (
                        <Button variant="outline" size="icon" className="h-8 w-8 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950"
                          onClick={(e) => { e.stopPropagation(); setAnimationGuide({ ...ex.animation_guide, titre: ex.titre }); }}>
                          <Drama className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="icon" className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setPreviewExercise(ex); setPreviewPage(0); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); openEditor(se); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="px-4 pb-4 pt-0">
                    <div className="space-y-3 border-t pt-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Consigne</p>
                        <p className="text-sm">{ex?.consigne}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Niveau</span>
                          <p className="font-medium">{ex?.niveau_vise}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Difficulté</span>
                          <p className="font-medium">{ex?.difficulte}/5</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Questions</span>
                          <p className="font-medium">{items.length}</p>
                        </div>
                      </div>
                      {items.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Aperçu rapide ({items.length} items)</p>
                          {items.slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} className="text-xs p-2 rounded-md bg-muted/50 border">
                              <span className="font-semibold text-primary">Q{idx + 1}.</span>{" "}
                              <span>{item.question}</span>
                              {Array.isArray(item.options) && (
                                <span className="text-muted-foreground ml-1">({item.options.length} choix)</span>
                              )}
                            </div>
                          ))}
                          {items.length > 3 && (
                            <p className="text-[11px] text-muted-foreground">+ {items.length - 3} autre(s) question(s)…</p>
                          )}
                        </div>
                      )}
                      {/* 📦 Matériel Pédagogique & Jeux — inline in accordion */}
                      {ex?.animation_guide?.documentation_fournie && (
                        <div className="mt-3 p-4 rounded-lg bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 space-y-3">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            <p className="text-sm font-bold text-sky-800 dark:text-sky-300">📦 Matériel Pédagogique & Jeux</p>
                          </div>
                          <div className="p-3 rounded-md bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                            <p className="font-bold text-amber-800 dark:text-amber-300">📋 Guide formateur</p>
                            <p className="whitespace-pre-line text-sm leading-relaxed">{ex.animation_guide.documentation_fournie.guide_formateur}</p>
                          </div>
                          {Array.isArray(ex.animation_guide.documentation_fournie.fiches_eleves) && ex.animation_guide.documentation_fournie.fiches_eleves.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {ex.animation_guide.documentation_fournie.fiches_eleves.map((fiche: any, fi: number) => (
                                <Card key={fi} className="border bg-white dark:bg-card shadow-sm">
                                  <CardContent className="p-3 space-y-2">
                                    <p className="font-bold text-sm text-primary">{fiche.titre_fiche}</p>
                                    <p className="text-sm whitespace-pre-line leading-relaxed">{fiche.contenu_fiche}</p>
                                    {Array.isArray(fiche.lexique_cles) && fiche.lexique_cles.length > 0 && (
                                      <div className="p-2 rounded bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-800">
                                        <span className="font-bold text-sky-700 dark:text-sky-400 text-xs">📝 Lexique : </span>
                                        <span className="text-xs">{fiche.lexique_cles.join(" · ")}</span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                          <Button variant="outline" size="sm" className="gap-1 text-sky-700 border-sky-300 hover:bg-sky-50 dark:text-sky-400 dark:border-sky-700"
                            onClick={() => {
                              const ag = ex.animation_guide;
                              const doc = ag.documentation_fournie;
                              const printWindow = window.open("", "_blank");
                              if (!printWindow) { toast.error("Pop-up bloqué."); return; }
                              const ficheHtml = Array.isArray(doc.fiches_eleves) ? doc.fiches_eleves.map((f: any, fi: number) => `
<div class="fiche"><h3>📄 Fiche Élève ${fi + 1} — ${f.titre_fiche || ""}</h3>
<div class="contenu">${f.contenu_fiche || ""}</div>
${Array.isArray(f.lexique_cles) && f.lexique_cles.length > 0 ? `<div class="lexique"><span>📝 Lexique :</span> ${f.lexique_cles.join(" · ")}</div>` : ""}
</div>`).join("") : "";
                              const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Matériel — ${ex.titre}</title>
<style>
body{font-family:'Segoe UI',sans-serif;padding:24px;font-size:13pt;color:#222;max-width:210mm;margin:0 auto}
h1{font-size:18pt;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px}
.guide{background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin-bottom:20px;white-space:pre-line;font-size:12pt}
.guide-label{font-weight:700;color:#92400e;margin-bottom:8px;display:block}
.atelier-info{background:#fef3c7;border-radius:6px;padding:12px;margin-bottom:16px;font-size:11pt}
.atelier-info strong{display:inline-block;min-width:120px}
.fiche{border:2px solid #333;border-radius:8px;padding:20px;margin-bottom:16px;page-break-before:always;page-break-inside:avoid}
.fiche h3{font-size:16pt;margin:0 0 12px;border-bottom:1px solid #ccc;padding-bottom:8px}
.fiche .contenu{white-space:pre-line;font-size:14pt;line-height:1.8}
.lexique{margin-top:16px;padding:12px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd}
.lexique span{font-weight:700;color:#1e40af}
@media print{body{padding:0;margin:0}.fiche{page-break-before:always}}
</style></head><body>
<h1>📦 ${ex.titre}</h1>
<div class="atelier-info"><strong>🎭 Scénario :</strong> ${ag.scenario || ""}<br/><strong>🎲 Jeu :</strong> ${ag.jeu || ""}<br/><strong>📦 Matériel :</strong> ${ag.materiel || ""}<br/><strong>🗣️ Objectif :</strong> ${ag.objectif_oral || ""}</div>
<div class="guide"><span class="guide-label">📋 Guide formateur :</span>${doc.guide_formateur || ""}</div>
${ficheHtml}</body></html>`;
                              printWindow.document.write(html);
                              printWindow.document.close();
                              printWindow.focus();
                              setTimeout(() => printWindow.print(), 300);
                            }}>
                            <Printer className="h-3.5 w-3.5" />🖨️ Imprimer ce matériel
                          </Button>
                        </div>
                      )}
                      <div className="flex gap-2 print:hidden">
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => { setPreviewExercise(ex); setPreviewPage(0); }}>
                          <Eye className="h-3.5 w-3.5" />Aperçu Élève
                        </Button>
                        {ex?.animation_guide && (
                          <Button variant="outline" size="sm" className="gap-1 text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800"
                            onClick={() => setAnimationGuide({ ...ex.animation_guide, titre: ex.titre })}>
                            <Drama className="h-3.5 w-3.5" />Atelier Ludique
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditor(se)}>
                          <Pencil className="h-3.5 w-3.5" />Modifier
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeleteSeId(se.id)}>
                          <Trash2 className="h-3.5 w-3.5" />Supprimer
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-primary border-primary/30 hover:bg-primary/10"
                          onClick={() => { setDuplicateExercise(ex); setDuplicateStudentIds([]); }}>
                          <Copy className="h-3.5 w-3.5" />Dupliquer & Envoyer
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </>
      )}

      {/* ─── Student Preview Dialog with Navigation ─── */}
      <Dialog open={!!previewExercise} onOpenChange={(open) => { if (!open) setPreviewExercise(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Aperçu Élève — {previewExercise?.titre}
            </DialogTitle>
            <DialogDescription>
              Voici l'exercice tel que l'élève le verra sur son espace.
            </DialogDescription>
          </DialogHeader>

          {previewExercise && (() => {
            const pc = typeof previewExercise.contenu === "object" && previewExercise.contenu !== null
              ? previewExercise.contenu : { items: [] };
            const pitems: any[] = Array.isArray((pc as any).items) ? (pc as any).items : [];
            const totalPages = pitems.length;
            const currentItem = pitems[previewPage];

            return (
              <div className="space-y-5 pt-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Consigne</CardTitle>
                    <CardDescription>{previewExercise.consigne}</CardDescription>
                  </CardHeader>
                </Card>

                {/* Image support */}
                {(() => {
                  const imgUrl = (pc as any)?.image_url || (pc as any)?.image || (pc as any)?.visual || (pc as any)?.support_visuel;
                  return imgUrl && typeof imgUrl === "string" && imgUrl.startsWith("http") ? (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">🖼️ Document visuel</p>
                        <img src={imgUrl} alt="Support visuel" className="max-w-full rounded-lg mx-auto" />
                      </CardContent>
                    </Card>
                  ) : null;
                })()}

                {/* Text support for CE */}
                {previewExercise.competence === "CE" && (pc as any)?.texte && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">📄 Document à lire</p>
                      <p className="text-sm whitespace-pre-wrap">{(pc as any).texte}</p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Badge>{previewExercise.competence}</Badge>
                  <Badge variant="outline">{previewExercise.format?.replace(/_/g, " ")}</Badge>
                  <Badge variant="secondary">Niveau {previewExercise.niveau_vise}</Badge>
                </div>

                {totalPages > 0 ? (
                  <>
                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" disabled={previewPage === 0}
                        onClick={() => setPreviewPage(p => p - 1)} className="gap-1">
                        <ChevronLeft className="h-4 w-4" />Précédent
                      </Button>
                      <span className="text-sm font-medium text-muted-foreground">
                        Question {previewPage + 1} / {totalPages}
                      </span>
                      <Button variant="outline" size="sm" disabled={previewPage >= totalPages - 1}
                        onClick={() => setPreviewPage(p => p + 1)} className="gap-1">
                        Suivant<ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {currentItem && (
                      <Card>
                        <CardContent className="pt-4 space-y-3">
                          <p className="font-medium text-sm">
                            <span className="text-primary font-bold mr-2">Q{previewPage + 1}.</span>
                            {currentItem.question}
                          </p>
                          {previewExercise.competence === "CO" && (
                            <Button variant="outline" size="sm" className="gap-2" disabled>
                              <Volume2 className="h-4 w-4" />Écouter l'audio
                            </Button>
                          )}
                          {Array.isArray(currentItem.options) && currentItem.options.length > 0 ? (
                            <RadioGroup disabled className="space-y-1">
                              {currentItem.options.map((opt: string, oi: number) => (
                                <div key={oi} className="flex items-center space-x-2 p-2 rounded-lg bg-muted/30 border">
                                  <RadioGroupItem value={opt} id={`prev-q${previewPage}-o${oi}`} disabled />
                                  <Label htmlFor={`prev-q${previewPage}-o${oi}`} className="cursor-default flex-1 text-sm">
                                    {opt}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          ) : (
                            <div className="border rounded-md p-3 bg-muted/20 text-sm text-muted-foreground italic">
                              Zone de saisie libre pour l'élève
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Page dots */}
                    <div className="flex justify-center gap-1">
                      {pitems.map((_, i) => (
                        <button key={i} onClick={() => setPreviewPage(i)}
                          className={cn(
                            "h-2.5 w-2.5 rounded-full transition-colors",
                            i === previewPage ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                          )} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune question dans cet exercice.
                  </div>
                )}

                <Button variant="outline" className="w-full" disabled>
                  Soumettre mes réponses
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Animation Guide Dialog (Formateur only) ─── */}
      <Dialog open={!!animationGuide} onOpenChange={(open) => { if (!open) setAnimationGuide(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Drama className="h-5 w-5 text-amber-600" />
              Atelier Ludique / Mise en situation
            </DialogTitle>
            <DialogDescription>
              {animationGuide?.titre} — Guide d'animation réservé au formateur
            </DialogDescription>
          </DialogHeader>
          {animationGuide && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/60 shrink-0">
                    <Drama className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Scénario</p>
                    <p className="text-sm mt-1">{animationGuide.scenario}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/60 shrink-0">
                    <Wand2 className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Jeu pédagogique</p>
                    <p className="text-sm mt-1">{animationGuide.jeu}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/60 shrink-0">
                    <Package className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Matériel à préparer</p>
                    <p className="text-sm mt-1">{animationGuide.materiel}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/60 shrink-0">
                    <MessageCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Objectif oral</p>
                    <p className="text-sm mt-1 font-medium italic">« {animationGuide.objectif_oral} »</p>
                  </div>
                </div>
               </div>

              {animationGuide.documentation_fournie && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide">📋 Documentation fournie</p>
                  <div className="p-3 rounded-md bg-muted/60 text-xs whitespace-pre-line">
                    <span className="font-semibold block mb-1">Guide formateur :</span>
                    {animationGuide.documentation_fournie.guide_formateur}
                  </div>
                  {Array.isArray(animationGuide.documentation_fournie.fiches_eleves) && animationGuide.documentation_fournie.fiches_eleves.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">Fiches élèves ({animationGuide.documentation_fournie.fiches_eleves.length})</p>
                      {animationGuide.documentation_fournie.fiches_eleves.map((fiche: any, fi: number) => (
                        <div key={fi} className="p-2 rounded border bg-accent/20 text-xs">
                          <p className="font-semibold">{fiche.titre_fiche}</p>
                          <p className="whitespace-pre-line mt-1">{fiche.contenu_fiche}</p>
                          {Array.isArray(fiche.lexique_cles) && fiche.lexique_cles.length > 0 && (
                            <p className="mt-1 text-primary font-medium">📝 {fiche.lexique_cles.join(" · ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button className="w-full gap-2" variant="outline" onClick={() => {
                    const ex = exercises.find((se: any) => se.exercice?.titre === animationGuide.titre)?.exercice;
                    if (!ex) { handlePrintMateriel(); return; }
                    const ag = ex.animation_guide as any;
                    const doc = (ag as any).documentation_fournie;
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) { toast.error("Pop-up bloqué."); return; }
                    const ficheHtml = Array.isArray(doc.fiches_eleves) ? doc.fiches_eleves.map((f: any, fi: number) => `
<div class="fiche"><h3>📄 Fiche Élève ${fi + 1} — ${f.titre_fiche || ""}</h3>
<div class="contenu">${f.contenu_fiche || ""}</div>
${Array.isArray(f.lexique_cles) && f.lexique_cles.length > 0 ? `<div class="lexique"><span>📝 Lexique :</span> ${f.lexique_cles.join(" · ")}</div>` : ""}
</div>`).join("") : "";
                    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Matériel — ${ex.titre}</title>
<style>body{font-family:'Segoe UI',sans-serif;padding:24px;font-size:13pt;color:#222}h1{font-size:18pt;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px}.guide{background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin-bottom:20px;white-space:pre-line;font-size:12pt}.guide-label{font-weight:700;color:#92400e;margin-bottom:8px;display:block}.atelier-info{background:#fef3c7;border-radius:6px;padding:12px;margin-bottom:16px;font-size:11pt}.atelier-info strong{display:inline-block;min-width:120px}.fiche{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px;page-break-inside:avoid}.fiche h3{font-size:16pt;margin:0 0 8px}.fiche .contenu{white-space:pre-line;font-size:14pt;line-height:1.7}.lexique{margin-top:12px;padding:10px;background:#f0f9ff;border-radius:6px}.lexique span{font-weight:700;color:#1e40af}@media print{body{padding:0}}</style></head><body>
<h1>📦 ${ex.titre}</h1>
<div class="atelier-info"><strong>🎭 Scénario :</strong> ${(ag as any).scenario || ""}<br/><strong>🎲 Jeu :</strong> ${(ag as any).jeu || ""}<br/><strong>📦 Matériel :</strong> ${(ag as any).materiel || ""}<br/><strong>🗣️ Objectif :</strong> ${(ag as any).objectif_oral || ""}</div>
<div class="guide"><span class="guide-label">📋 Guide formateur :</span>${doc.guide_formateur || ""}</div>
${ficheHtml}</body></html>`;
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 300);
                  }}>
                    <Printer className="h-4 w-4" />Imprimer tout le matériel
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Duplicate & Send Dialog ─── */}
      <Dialog open={!!duplicateExercise} onOpenChange={(open) => { if (!open) { setDuplicateExercise(null); setDuplicateStudentIds([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              Dupliquer & Envoyer
            </DialogTitle>
            <DialogDescription>
              L'IA va générer un exercice similaire avec des items différents et l'envoyer comme devoir individuel aux élèves sélectionnés.
            </DialogDescription>
          </DialogHeader>
          {duplicateExercise && (
            <div className="space-y-4 pt-2">
              <Card className="bg-muted/30">
                <CardContent className="pt-3 pb-3">
                  <p className="text-sm font-medium">{duplicateExercise.titre}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{duplicateExercise.competence}</Badge>
                    <Badge variant="outline" className="text-xs">{duplicateExercise.format}</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Sélectionnez les élèves :</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="sm" className="text-xs"
                    onClick={() => {
                      const allIds = (groupMembers ?? []).map((m: any) => m.eleve_id);
                      setDuplicateStudentIds(duplicateStudentIds.length === allIds.length ? [] : allIds);
                    }}>
                    <UserCheck className="h-3 w-3 mr-1" />
                    {duplicateStudentIds.length === (groupMembers ?? []).length ? "Tout désélectionner" : "Tout sélectionner"}
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                  {(groupMembers ?? []).map((m: any) => (
                    <label key={m.eleve_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={duplicateStudentIds.includes(m.eleve_id)}
                        onCheckedChange={(checked) => {
                          setDuplicateStudentIds(prev =>
                            checked ? [...prev, m.eleve_id] : prev.filter(id => id !== m.eleve_id)
                          );
                        }}
                      />
                      <span className="text-sm">{m.eleve?.prenom} {m.eleve?.nom}</span>
                    </label>
                  ))}
                  {(!groupMembers || groupMembers.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun élève dans ce groupe.</p>
                  )}
                </div>
              </div>

              <Button className="w-full gap-2" disabled={duplicateStudentIds.length === 0 || duplicating}
                onClick={handleDuplicateAndSend}>
                {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {duplicating ? "Génération en cours…" : `Envoyer à ${duplicateStudentIds.length} élève(s)`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Editor Sheet */}
      <Sheet open={!!editingExercise} onOpenChange={(open) => { if (!open) setEditingExercise(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Éditer l'exercice
            </SheetTitle>
            <SheetDescription>
              Modifiez le contenu. Les changements sont sauvegardés instantanément en base.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-titre">Titre</Label>
              <Input id="edit-titre" value={editForm.titre}
                onChange={(e) => setEditForm((p) => ({ ...p, titre: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-consigne">Consigne</Label>
              <Textarea id="edit-consigne" value={editForm.consigne} rows={3}
                onChange={(e) => setEditForm((p) => ({ ...p, consigne: e.target.value }))} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Questions / Items</Label>
                <Button variant="outline" size="sm" onClick={addEditItem} className="gap-1">
                  <CirclePlus className="h-3.5 w-3.5" />Ajouter
                </Button>
              </div>

              {editForm.contenu.items.map((item: any, idx: number) => (
                <Card key={idx} className="p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-muted-foreground mt-2">Q{idx + 1}</span>
                    <div className="flex-1 space-y-2">
                      <Input placeholder="Question" value={item.question || ""}
                        onChange={(e) => updateEditItem(idx, "question", e.target.value)} />
                      {Array.isArray(item.options) && (
                        <div className="space-y-1">
                          <span className="text-[11px] text-muted-foreground font-medium">Choix de réponse</span>
                          {item.options.map((opt: string, oi: number) => (
                            <div key={oi} className="flex items-center gap-1">
                              <Input className="h-8 text-xs" value={opt}
                                onChange={(e) => updateEditItemOption(idx, oi, e.target.value)} />
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                onClick={() => removeEditItemOption(idx, oi)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7"
                            onClick={() => addEditItemOption(idx)}>
                            <Plus className="h-3 w-3" />Ajouter un choix
                          </Button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-muted-foreground font-medium">Bonne réponse</span>
                          <Input className="h-8 text-xs" value={item.bonne_reponse || ""}
                            onChange={(e) => updateEditItem(idx, "bonne_reponse", e.target.value)} />
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground font-medium">Explication</span>
                          <Input className="h-8 text-xs" value={item.explication || ""}
                            onChange={(e) => updateEditItem(idx, "explication", e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-1"
                      onClick={() => removeEditItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}

              {editForm.contenu.items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune question. Cliquez "Ajouter" pour en créer une.
                </p>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button onClick={saveEdit} disabled={savingEdit} className="w-full gap-2">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Sauvegarder
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet exercice reporté ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'exercice sera retiré définitivement. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDeleteReported(deleteConfirm)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete single exercise confirmation */}
      <AlertDialog open={!!deleteSeId} onOpenChange={(open) => { if (!open) setDeleteSeId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet exercice ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'exercice sera retiré de cette séance. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSeId && handleDeleteExercise(deleteSeId)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all exercises confirmation */}
      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider tous les exercices ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les exercices seront retirés de cette séance. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearExercises}>
              Vider la séance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Next Session Preview ─── */}
      {nextSession && (
        <Card className="border-dashed print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              Séance suivante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{nextSession.titre}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(nextSession.date_seance).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}{nextSession.duree_minutes} min
                  {" · "}{nextSessionExCount || 0} exercice(s) prévus
                </p>
                {nextSession.objectifs && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{nextSession.objectifs}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/formateur/seances/${nextSession.id}/pilote`)}>
                Ouvrir
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`@media print { nav, header, .print\\:hidden { display: none !important; } body { font-size: 12pt; } }`}</style>

      {/* ─── Generate Daily Homework Dialog ─── */}
      <GenerateDailyHomeworkDialog
        open={dailyHomeworkOpen}
        onOpenChange={setDailyHomeworkOpen}
        currentSessionDate={session?.date_seance || new Date().toISOString()}
        nextSessions={futureSessions ?? []}
        onGenerate={handleGenerateDailyHomework}
      />
    </div>
  );
};

export default SessionPilot;
