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
  AlertTriangle, RotateCcw, ClipboardCheck, FileText, Users, Brain,
  Eye, Volume2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [generating, setGenerating] = useState(false);
  const [generatingHomework, setGeneratingHomework] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Editor state
  const [editingExercise, setEditingExercise] = useState<any>(null);
  const [editForm, setEditForm] = useState<{ titre: string; consigne: string; contenu: any }>({ titre: "", consigne: "", contenu: { items: [] } });
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<any>(null);

  const { data: session } = useQuery({
    queryKey: ["session-info", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom, id)")
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
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, difficulte, niveau_vise, point_a_maitriser_id)")
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
        .select("*, exercice:exercices(id, titre, consigne, competence, format, contenu, difficulte, niveau_vise, point_a_maitriser_id)")
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
      const competences = (parcoursSeance as any)?.competences_cibles;
      const competence = competences?.length > 0 ? competences[0] : "CE";
      const objectif = (parcoursSeance as any)?.objectif_principal || session.objectifs || "Exercice de séance";
      const count = (parcoursSeance as any)?.nb_exercices_suggeres || 5;

      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();

      if (!defaultPoint) {
        toast.error("Aucun point à maîtriser trouvé. Importez d'abord un programme.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("generate-exercises", {
        body: { pointName: objectif, competence, niveauVise, count },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generated = data?.exercises ?? [];
      if (generated.length === 0) {
        toast.warning("Aucun exercice généré.");
        return;
      }

      const currentMax = exercises.length;
      const exercisesToInsert = generated.map((ex: any) => ({
        titre: ex.titre,
        consigne: ex.consigne,
        competence: competence as any,
        format: (ex.format || "qcm") as any,
        difficulte: ex.difficulte || 3,
        contenu: ex.contenu || {},
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

      const sessionExLinks = (inserted ?? []).map((ex: any, i: number) => ({
        session_id: id!,
        exercice_id: ex.id,
        ordre: currentMax + i + 1,
        statut: "planifie" as any,
      }));

      const { error: linkErr } = await supabase.from("session_exercices").insert(sessionExLinks);
      if (linkErr) throw linkErr;

      qc.invalidateQueries({ queryKey: ["session-exercices", id] });
      toast.success(`${inserted?.length} exercice(s) généré(s) et publiés !`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Homework Generator ───
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

      // Collect exercises from this session
      const sessionExs = exercises.map((se: any) => se.exercice).filter(Boolean);
      if (sessionExs.length === 0) {
        toast.warning("Aucun exercice dans la séance.");
        return;
      }

      // Create devoirs for each student for each exercise
      const devoirs = members.flatMap((m: any) =>
        sessionExs.map((ex: any) => ({
          eleve_id: m.eleve_id,
          exercice_id: ex.id,
          formateur_id: user.id,
          raison: "consolidation" as const,
          statut: "en_attente" as const,
          session_id: id,
        }))
      );

      const { error } = await supabase.from("devoirs").insert(devoirs as any);
      if (error) throw error;

      toast.success(`${devoirs.length} devoir(s) créé(s) pour ${members.length} élève(s) !`, {
        description: "Liés à cette séance, visibles sur l'espace élève.",
      });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setGeneratingHomework(false);
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

  const handlePrint = () => window.print();

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
        <div className="flex gap-2">
          <Button onClick={handleGenerateExercises} disabled={generating} variant="outline" className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Générer IA
          </Button>
          <Button onClick={handleGenerateHomework} disabled={generatingHomework} className="gap-2">
            {generatingHomework ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Générer devoirs
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">Fiche Séance — TCF Pro</h1>
        <p className="text-muted-foreground">
          {session?.titre} · {exercises.length} exercices · {new Date().toLocaleDateString("fr-FR")}
        </p>
      </div>

      {/* ─── Debriefing Widget (homework stats from previous session) ─── */}
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

      {/* ─── Reported Exercises from Previous Session ─── */}
      {reported.length > 0 && (
        <Card className="border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-950/10 print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <RotateCcw className="h-5 w-5" />
              À terminer — Exercices reportés ({reported.length})
            </CardTitle>
            <CardDescription>Exercices non terminés lors de la séance précédente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reported.map((se: any) => {
              const ex = se.exercice;
              return (
                <div key={se.id} className="flex items-center gap-3 p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-card">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-bold shrink-0">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ex?.titre || "Exercice"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">{ex?.competence}</Badge>
                      <span className="text-[10px] text-muted-foreground">{ex?.format?.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleKeepReported(se)}>
                      <Plus className="h-3 w-3" />Garder
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleToHomework(se)}>
                      <ClipboardCheck className="h-3 w-3" />Devoirs
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(se.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {exercises.length === 0 && reported.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun exercice rattaché</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              Générez des exercices IA ou rattachez-en depuis la page Séances.
            </p>
            <Button onClick={handleGenerateExercises} disabled={generating} variant="outline" className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Générer des exercices IA
            </Button>
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

          {/* Exercise List */}
          <div className="space-y-3">
            {exercises.map((se, i) => {
              const ex = (se as any).exercice;
              const status = getStatus(se.id);
              const config = statusConfig[status];
              const StatusIcon = config.icon;
              const isChecked = !!checked[se.id];

              return (
                <Card key={se.id}
                  className={cn(
                    "transition-all cursor-pointer print:break-inside-avoid print:border print:shadow-none",
                    isChecked && "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30",
                    !isChecked && checkedCount > 0 && "opacity-60"
                  )}
                  onClick={() => toggleExercise(se.id)}>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5 print:hidden">
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleExercise(se.id)}
                          onClick={(e) => e.stopPropagation()} className="h-5 w-5" />
                      </div>
                      <div className={cn("flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold shrink-0 border", config.color)}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{ex?.titre || "Exercice"}</h3>
                          <Badge variant="secondary" className="text-[10px]">{ex?.competence}</Badge>
                          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border print:hidden", config.color)}>
                            <StatusIcon className="h-3 w-3" />{config.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold print:hidden">
                            <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                            En ligne
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{ex?.consigne}</p>
                        <p className="text-[10px] text-muted-foreground/60 print:hidden">Format : {ex?.format?.replace(/_/g, " ")}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 print:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(se);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

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

      <style>{`@media print { nav, header, .print\\:hidden { display: none !important; } body { font-size: 12pt; } }`}</style>
    </div>
  );
};

export default SessionPilot;
