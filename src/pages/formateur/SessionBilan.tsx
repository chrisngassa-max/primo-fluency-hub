import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle2, ArrowRight, ArrowLeft, Printer, Save, BookOpen, Loader2, Sparkles,
  AlertTriangle, Brain, X, ClipboardCheck, Send, Clock, CalendarIcon,
  Pencil, Trash2, Plus, ChevronDown, ChevronUp, Eye, EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;

interface BilanScores {
  CO: number; CE: number; EE: number; EO: number; Structures: number;
}

interface BlockedStudent { nom: string; competence: string; }

const SessionBilan = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualScoreOverride, setManualScoreOverride] = useState(false);

  const [bilanScores, setBilanScores] = useState<BilanScores>({
    CO: 50, CE: 50, EE: 50, EO: 50, Structures: 50,
  });

  // Tronc commun modal state
  const [showTroncCommunModal, setShowTroncCommunModal] = useState(false);
  const [troncCommunSelected, setTroncCommunSelected] = useState<Set<string>>(new Set());
  const [blockedStudents, setBlockedStudents] = useState<BlockedStudent[]>([]);
  const [newBlockedName, setNewBlockedName] = useState("");
  const [newBlockedCompetence, setNewBlockedCompetence] = useState("CO");
  const [bilanNotes, setBilanNotes] = useState("");

  // Adaptation IA
  const [adapting, setAdapting] = useState(false);
  const [adaptationResult, setAdaptationResult] = useState<any>(null);
  const [showAdaptation, setShowAdaptation] = useState(false);

  // Bilan test generation (MAILLON 1)
  const [generatingTest, setGeneratingTest] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<any>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [devoirDeadline, setDevoirDeadline] = useState<Date | undefined>(undefined);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState<{ eleve_id: string; nom: string; prenom: string }[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);

  const { data: formateurParams } = useQuery({
    queryKey: ["formateur-parametres-bilan", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("parametres").select("*").eq("formateur_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isAutoAdapt = (formateurParams as any)?.auto_adapt ?? false;
  const defaultDeadlineDays = (formateurParams as any)?.delai_devoirs_jours ?? 3;
  const defaultDeadline = addDays(new Date(), defaultDeadlineDays);
  const effectiveDeadline = devoirDeadline || defaultDeadline;
  const minDeadline = addDays(new Date(), 1);

  const { data: session } = useQuery({
    queryKey: ["session-info-bilan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*, group:groups(nom, id)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sessionExercices, isLoading } = useQuery({
    queryKey: ["session-bilan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("*, exercice:exercices(*)")
        .eq("session_id", id!)
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: nextSession } = useQuery({
    queryKey: ["next-session-bilan", id],
    queryFn: async () => {
      if (!session) return null;
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("group_id", (session as any).group?.id || session.group_id)
        .gt("date_seance", session.date_seance)
        .order("date_seance")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  const exercises = sessionExercices ?? [];
  const uncheckedExercises = exercises.filter((e) => !checkedIds.has(e.id));

  // Auto-calculate bilan scores from checked exercises
  useEffect(() => {
    if (manualScoreOverride || exercises.length === 0) return;
    const newScores: BilanScores = { CO: 50, CE: 50, EE: 50, EO: 50, Structures: 50 };
    for (const comp of COMPETENCES) {
      const total = exercises.filter((e) => (e as any).exercice?.competence === comp).length;
      if (total === 0) continue;
      const checked = exercises.filter((e) => (e as any).exercice?.competence === comp && checkedIds.has(e.id)).length;
      newScores[comp] = Math.round((checked / total) * 100);
    }
    setBilanScores(newScores);
  }, [checkedIds, exercises, manualScoreOverride]);

  const toggleCheck = (seId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seId)) next.delete(seId); else next.add(seId);
      return next;
    });
  };

  const addBlockedStudent = () => {
    if (!newBlockedName.trim()) return;
    setBlockedStudents((prev) => [...prev, { nom: newBlockedName.trim(), competence: newBlockedCompetence }]);
    setNewBlockedName("");
  };

  const removeBlockedStudent = (index: number) => {
    setBlockedStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleValidate = () => {
    if (checkedIds.size === 0) {
      toast.error("Cochez au moins un exercice traité.");
      return;
    }
    if (uncheckedExercises.length > 0) {
      // Pre-select all unchecked exercises for tronc commun
      setTroncCommunSelected(new Set(uncheckedExercises.map((e) => e.id)));
      setShowTroncCommunModal(true);
    } else {
      saveWithAction("none", []);
    }
  };

  const handleTroncCommunConfirm = async () => {
    setShowTroncCommunModal(false);
    const selectedTronc = uncheckedExercises.filter((e) => troncCommunSelected.has(e.id));
    const nonSelectedUnchecked = uncheckedExercises.filter((e) => !troncCommunSelected.has(e.id));
    // Report non-selected unchecked exercises
    if (nonSelectedUnchecked.length > 0) {
      await supabase
        .from("session_exercices")
        .update({ statut: "reporte" as any, updated_at: new Date().toISOString() })
        .in("id", nonSelectedUnchecked.map((e) => e.id));
    }
    await saveWithAction("tronc_commun", selectedTronc);
  };

  const handleTroncCommunSkip = async () => {
    setShowTroncCommunModal(false);
    setConfirmOpen(true);
  };

  const saveWithAction = async (action: "devoir" | "reporter" | "none" | "tronc_commun", troncExercises: any[] = []) => {
    setSaving(true);
    try {
      if (checkedIds.size > 0) {
        const { error: e1 } = await supabase
          .from("session_exercices")
          .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
          .in("id", Array.from(checkedIds));
        if (e1) throw e1;
      }

      // Section A: Tronc commun devoirs
      if (action === "tronc_commun" && troncExercises.length > 0) {
        // Mark as devoir_remediation in session_exercices
        await supabase
          .from("session_exercices")
          .update({ statut: "devoir_remediation" as any, updated_at: new Date().toISOString() })
          .in("id", troncExercises.map((e) => e.id));

        if (session?.group_id) {
          const { data: members } = await supabase
            .from("group_members").select("eleve_id").eq("group_id", session.group_id);
          if (members && members.length > 0) {
            const devoirs = troncExercises.flatMap((se) =>
              (members ?? []).map((m) => ({
                eleve_id: m.eleve_id,
                exercice_id: (se as any).exercice_id,
                formateur_id: user!.id,
                raison: "consolidation" as const,
                statut: "en_attente" as const,
                date_echeance: effectiveDeadline.toISOString(),
                source_label: "tronc_commun",
              }))
            );
            const { error: e3 } = await supabase.from("devoirs").insert(devoirs as any);
            if (e3) throw e3;
          }
        }
      } else if (uncheckedExercises.length > 0) {
        if (action === "devoir") {
          const { error: e2 } = await supabase
            .from("session_exercices")
            .update({ statut: "devoir_remediation" as any, updated_at: new Date().toISOString() })
            .in("id", uncheckedExercises.map((e) => e.id));
          if (e2) throw e2;

          if (session?.group_id) {
            const { data: members } = await supabase
              .from("group_members").select("eleve_id").eq("group_id", session.group_id);
            if (members && members.length > 0) {
              const devoirs = uncheckedExercises.flatMap((se) =>
                (members ?? []).map((m) => ({
                  eleve_id: m.eleve_id,
                  exercice_id: (se as any).exercice_id,
                  formateur_id: user!.id,
                  raison: "remediation" as const,
                  statut: "en_attente" as const,
                  date_echeance: effectiveDeadline.toISOString(),
                  source_label: "individualise",
                }))
              );
              const { error: e3 } = await supabase.from("devoirs").insert(devoirs as any);
              if (e3) throw e3;
            }
          }
        } else if (action === "reporter") {
          const { error: e2 } = await supabase
            .from("session_exercices")
            .update({ statut: "reporte" as any, updated_at: new Date().toISOString() })
            .in("id", uncheckedExercises.map((e) => e.id));
          if (e2) throw e2;
        }
      }

      await supabase.from("sessions")
        .update({ statut: "terminee" as any, updated_at: new Date().toISOString() })
        .eq("id", id!);

      toast.success("Bilan de séance validé !", {
        description: `${checkedIds.size} traité(s), ${uncheckedExercises.length} ${action === "devoir" ? "en devoirs" : action === "reporter" ? "reporté(s)" : ""}`.trim(),
      });
      setConfirmOpen(false);

      // MAILLON 1: Generate bilan test from checked exercises
      await generateBilanTest();
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const generateBilanTest = async () => {
    setGeneratingTest(true);
    try {
      const checkedExercises = exercises
        .filter((e) => checkedIds.has(e.id))
        .map((e) => (e as any).exercice)
        .filter(Boolean);

      const { data, error } = await supabase.functions.invoke("generate-bilan-test", {
        body: {
          exercices: checkedExercises.map((ex: any) => ({
            titre: ex.titre,
            competence: ex.competence,
            format: ex.format,
            consigne: ex.consigne,
            niveau_vise: ex.niveau_vise,
          })),
          sessionTitle: session?.titre,
          niveauCible: session?.niveau_cible,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGeneratedTest(data);
      setShowTestModal(true);
    } catch (e: any) {
      console.error("Test generation failed:", e);
      toast.error("Génération du test échouée", { description: e.message });
      // Still proceed with adaptation
      if (nextSession) await triggerAdaptation();
      else navigate("/formateur/seances");
    } finally {
      setGeneratingTest(false);
    }
  };

  const handleSendNowClick = async () => {
    if (session?.group_id) {
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, profile:profiles(nom, prenom)")
        .eq("group_id", session.group_id);
      const mapped = (members || []).map((m: any) => ({
        eleve_id: m.eleve_id,
        nom: m.profile?.nom || "",
        prenom: m.profile?.prenom || "",
      }));
      setGroupMembers(mapped);
      setSelectedStudentIds(new Set(mapped.map((m: any) => m.eleve_id)));
    }
    setConfirmSendOpen(true);
  };

  const handleSendTest = async (sendNow: boolean) => {
    if (!generatedTest || !session) return;
    setSendingTest(true);
    setConfirmSendOpen(false);
    try {
      const statut = sendNow ? "envoye" : "pret";
      const { error } = await supabase.from("bilan_tests").insert({
        session_id: id!,
        formateur_id: user!.id,
        statut,
        contenu: generatedTest.questions || [],
        competences_couvertes: generatedTest.competences_couvertes || [],
        nb_questions: generatedTest.questions?.length || 0,
      });
      if (error) throw error;

      if (sendNow) {
        const targetIds = Array.from(selectedStudentIds);
        if (targetIds.length > 0) {
          const notifs = targetIds.map((eleveId) => ({
            user_id: eleveId,
            titre: "Évaluation de séance disponible",
            message: `Une évaluation pour la séance "${session.titre}" est prête. Passez-la pour valider vos acquis.`,
            link: "/eleve",
          }));
          await supabase.from("notifications").insert(notifs);
        }
        toast.success(`Test envoyé à ${targetIds.length} élève(s) !`, { description: `${generatedTest.questions?.length} questions` });
      } else {
        toast.success("Test sauvegardé", { description: "Vous pourrez l'envoyer plus tard depuis le tableau de bord." });
      }

      setShowTestModal(false);

      if (nextSession) await triggerAdaptation();
      else navigate("/formateur/seances");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSkipTest = async () => {
    setShowTestModal(false);
    // Archive the test
    if (generatedTest && session) {
      await supabase.from("bilan_tests").insert({
        session_id: id!,
        formateur_id: user!.id,
        statut: "archive",
        contenu: generatedTest.questions || [],
        competences_couvertes: generatedTest.competences_couvertes || [],
        nb_questions: generatedTest.questions?.length || 0,
      }).then(() => {});
    }
    if (nextSession) await triggerAdaptation();
    else navigate("/formateur/seances");
  };

  const triggerAdaptation = async () => {
    setAdapting(true);
    try {
      const exercicesTraites = exercises.filter((e) => checkedIds.has(e.id)).map((e) => (e as any).exercice?.titre);
      const exercicesNonTraites = uncheckedExercises.map((e) => (e as any).exercice?.titre);

      const { data, error } = await supabase.functions.invoke("adapt-next-session", {
        body: {
          sessionTitle: session?.titre, bilanScores, blockedStudents, exercicesTraites, exercicesNonTraites,
          nextSessionTitle: nextSession?.titre, nextSessionObjectifs: nextSession?.objectifs,
          nextSessionNiveauCible: nextSession?.niveau_cible,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAdaptationResult(data.adaptation);
      if (isAutoAdapt && nextSession) await autoApplyAdaptation(data.adaptation);
      else setShowAdaptation(true);
    } catch (e: any) {
      console.error(e);
      toast.error("L'adaptation IA a échoué", { description: e.message });
      navigate("/formateur/seances");
    } finally {
      setAdapting(false);
    }
  };

  const autoApplyAdaptation = async (adaptation: any) => {
    if (!nextSession) return;
    try {
      await supabase.from("sessions").update({ objectifs: adaptation.objectifs_ajustes, updated_at: new Date().toISOString() }).eq("id", nextSession.id);
      await supabase.from("notifications").insert({ user_id: user!.id, titre: "Séance auto-adaptée par l'IA", message: adaptation.message_formateur, link: `/formateur/seances/${nextSession.id}/pilote` });
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
      toast.success("Pilote automatique — Séance N+1 adaptée !", { description: adaptation.message_formateur });
      navigate("/formateur/seances");
    } catch (e: any) {
      toast.error("Erreur d'auto-adaptation", { description: e.message });
      navigate("/formateur/seances");
    }
  };

  const applyAdaptation = async () => {
    if (!nextSession || !adaptationResult) return;
    setSaving(true);
    try {
      await supabase.from("sessions").update({ objectifs: adaptationResult.objectifs_ajustes, updated_at: new Date().toISOString() }).eq("id", nextSession.id);
      await supabase.from("notifications").insert({ user_id: user!.id, titre: "Séance adaptée par l'IA", message: adaptationResult.message_formateur, link: `/formateur/seances/${nextSession.id}/pilote` });
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
      toast.success("Séance N+1 adaptée !", { description: adaptationResult.message_formateur });
      setShowAdaptation(false);
      navigate("/formateur/seances");
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
    finally { setSaving(false); }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
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
        <div>
          <h1 className="text-2xl font-bold">Bilan de séance</h1>
          <p className="text-sm text-muted-foreground">
            {session?.titre} · {(session as any)?.group?.nom} · {exercises.length} exercices
          </p>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Fiche Séance — CAP TCF</h1>
        <p>{session?.titre} · {new Date().toLocaleDateString("fr-FR")}</p>
      </div>

      {/* Summary bar + select all */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className="gap-1 border-green-500/30 text-green-600">
            <CheckCircle2 className="h-3 w-3" />{checkedIds.size}/{exercises.length}
          </Badge>
        </div>
        <Button
          variant="ghost" size="sm" className="text-xs h-7"
          onClick={() => {
            if (checkedIds.size === exercises.length) setCheckedIds(new Set());
            else setCheckedIds(new Set(exercises.map((e) => e.id)));
          }}
        >
          {checkedIds.size === exercises.length ? "Tout désélectionner" : "Tout cocher"}
        </Button>
      </div>

      {/* Compact exercise list */}
      <div className="border rounded-lg divide-y overflow-hidden overflow-y-auto max-h-[50vh] md:max-h-[400px]">
        {exercises.map((se, i) => {
          const ex = (se as any).exercice;
          const isChecked = checkedIds.has(se.id);
          return (
            <div
              key={se.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                isChecked && "bg-green-50/60 dark:bg-green-950/10"
              )}
              onClick={() => toggleCheck(se.id)}
            >
              <Checkbox checked={isChecked} onCheckedChange={() => toggleCheck(se.id)} className="print:hidden shrink-0" onClick={(e) => e.stopPropagation()} />
              <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
              <span className="text-sm truncate flex-1">{ex?.titre || "Exercice"}</span>
              <Badge variant="secondary" className="text-[9px] shrink-0 hidden sm:inline-flex">{ex?.competence}</Badge>
            </div>
          );
        })}
      </div>

      {exercises.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Aucun exercice rattaché à cette séance.</p>
          </CardContent>
        </Card>
      )}

      {/* Bilan de fin de cours */}
      <Card className="border-primary/20 print:hidden">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />Bilan de fin de cours
          </CardTitle>
          <CardDescription>Évaluez le groupe par compétence et signalez les blocages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Score moyen du groupe par compétence</Label>
            {COMPETENCES.map((comp) => (
              <div key={comp} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{comp}</span>
                  <Badge variant="outline" className={cn("text-xs",
                    bilanScores[comp] >= 80 && "border-green-500/50 text-green-600",
                    bilanScores[comp] >= 60 && bilanScores[comp] < 80 && "border-orange-500/50 text-orange-600",
                    bilanScores[comp] < 60 && "border-red-500/50 text-red-600"
                  )}>{bilanScores[comp]}%</Badge>
                </div>
                <Slider value={[bilanScores[comp]]} onValueChange={([v]) => { setManualScoreOverride(true); setBilanScores((prev) => ({ ...prev, [comp]: v })); }} min={0} max={100} step={5} className="w-full" />
                <p className="text-[10px] text-muted-foreground/70">Calculé depuis les exercices cochés — ajustable</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />Élèves en difficulté
            </Label>
            {blockedStudents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {blockedStudents.map((s, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {s.nom} ({s.competence})
                    <button onClick={() => removeBlockedStudent(i)} className="ml-1 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={newBlockedName} onChange={(e) => setNewBlockedName(e.target.value)} placeholder="Nom de l'élève" className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm flex-1" onKeyDown={(e) => e.key === "Enter" && addBlockedStudent()} />
              <select value={newBlockedCompetence} onChange={(e) => setNewBlockedCompetence(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {COMPETENCES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
              <Button size="sm" variant="outline" onClick={addBlockedStudent}>Ajouter</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notes complémentaires</Label>
            <Textarea value={bilanNotes} onChange={(e) => setBilanNotes(e.target.value)} placeholder="Observations, points positifs, ajustements suggérés..." className="min-h-[80px]" />
          </div>
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="flex gap-2 print:hidden">
        <Button onClick={handleValidate} className="flex-1" disabled={saving || adapting || generatingTest}>
          {(saving || adapting || generatingTest) ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {generatingTest ? "Génération du test IA..." : adapting ? "Adaptation IA en cours..." : "Valider le bilan"}
        </Button>
        <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimer</Button>
      </div>

      {nextSession && (
        <p className="text-xs text-muted-foreground text-center print:hidden">
          <Sparkles className="h-3 w-3 inline mr-1" />
          {isAutoAdapt ? `Pilote auto activé — "${nextSession.titre}" sera adaptée` : `L'IA proposera des suggestions pour "${nextSession.titre}"`}
        </p>
      )}

      {/* Tronc commun modal — Section A */}
      <Dialog open={showTroncCommunModal} onOpenChange={setShowTroncCommunModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />Devoirs tronc commun
            </DialogTitle>
            <DialogDescription>
              {uncheckedExercises.length} exercice(s) non traité(s). Sélectionnez ceux à envoyer en devoir à tout le groupe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2 max-h-60 overflow-y-auto">
            {uncheckedExercises.map((se) => {
              const ex = (se as any).exercice;
              return (
                <label key={se.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={troncCommunSelected.has(se.id)}
                    onCheckedChange={(checked) => {
                      setTroncCommunSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(se.id); else next.delete(se.id);
                        return next;
                      });
                    }}
                  />
                  <span className="text-sm flex-1 truncate">{ex?.titre || "Exercice"}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{ex?.competence}</Badge>
                </label>
              );
            })}
          </div>
          <div className="space-y-2 border-t pt-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />Date limite
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !devoirDeadline && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(effectiveDeadline, "EEEE d MMMM yyyy", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={effectiveDeadline} onSelect={(d) => d && setDevoirDeadline(d)} disabled={(date) => date < minDeadline} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={handleTroncCommunConfirm} disabled={saving || troncCommunSelected.size === 0} className="flex-1 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer ({troncCommunSelected.size}) en devoirs
            </Button>
            <Button variant="outline" onClick={handleTroncCommunSkip} className="flex-1">
              Reporter les exercices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for unchecked exercises */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exercices non traités</DialogTitle>
            <DialogDescription>{uncheckedExercises.length} exercice(s) n'ont pas été traité(s).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            {uncheckedExercises.map((se, i) => (
              <div key={se.id} className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{(se as any).exercice?.titre || `Exercice ${i + 1}`}</span>
              </div>
            ))}
          </div>
          {/* Date picker for homework deadline */}
          <div className="space-y-2 border-t pt-4">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />Date limite de rendu
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !devoirDeadline && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(effectiveDeadline, "EEEE d MMMM yyyy", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={effectiveDeadline}
                  onSelect={(d) => d && setDevoirDeadline(d)}
                  disabled={(date) => date < minDeadline}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Par défaut : J+{defaultDeadlineDays} — modifiable dans Paramètres
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="default" onClick={() => saveWithAction("devoir", [])} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BookOpen className="h-4 w-4 mr-2" />}Envoyer en devoirs
            </Button>
            <Button variant="outline" onClick={() => saveWithAction("reporter", [])} disabled={saving} className="flex-1">
              <ArrowRight className="h-4 w-4 mr-2" />Reporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MAILLON 1: Test de bilan généré — modal de confirmation */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span className="inline-flex items-center gap-1">✨ Test de bilan — {generatedTest?.questions?.length || 0} questions</span>
            </DialogTitle>
            <DialogDescription>
              Vous pouvez modifier, supprimer ou ajouter des questions avant d'envoyer.
            </DialogDescription>
          </DialogHeader>
          {generatedTest && (
            <div className="py-3 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Compétences :</span>
                {(generatedTest.competences_couvertes || []).map((c: string) => (
                  <Badge key={c} variant="secondary">{c}</Badge>
                ))}
              </div>

              {/* Editable questions list */}
              <div className="space-y-3">
                {(generatedTest.questions || []).map((q: any, i: number) => (
                  <Card key={i} className="border">
                    <CardContent className="py-3 px-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-bold text-primary shrink-0">Q{i + 1}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{q.competence}</Badge>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{q.format?.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => {
                              setEditingQuestionIdx(editingQuestionIdx === i ? null : i);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              const updated = { ...generatedTest };
                              updated.questions = updated.questions.filter((_: any, idx: number) => idx !== i);
                              if (editingQuestionIdx === i) setEditingQuestionIdx(null);
                              else if (editingQuestionIdx !== null && editingQuestionIdx > i) setEditingQuestionIdx(editingQuestionIdx - 1);
                              setGeneratedTest(updated);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {editingQuestionIdx === i ? (
                        <div className="space-y-2 border-t pt-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Question</Label>
                            <Textarea
                              value={q.question}
                              onChange={(e) => {
                                const updated = { ...generatedTest };
                                updated.questions = [...updated.questions];
                                updated.questions[i] = { ...updated.questions[i], question: e.target.value };
                                setGeneratedTest(updated);
                              }}
                              className="min-h-[50px] text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Compétence</Label>
                              <Select
                                value={q.competence}
                                onValueChange={(v) => {
                                  const updated = { ...generatedTest };
                                  updated.questions = [...updated.questions];
                                  updated.questions[i] = { ...updated.questions[i], competence: v };
                                  setGeneratedTest(updated);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["CO", "CE", "EE", "EO", "Structures"].map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Format</Label>
                              <Select
                                value={q.format}
                                onValueChange={(v) => {
                                  const updated = { ...generatedTest };
                                  updated.questions = [...updated.questions];
                                  updated.questions[i] = { ...updated.questions[i], format: v };
                                  setGeneratedTest(updated);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["qcm", "vrai_faux", "texte_lacunaire"].map((f) => (
                                    <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {(q.options?.length > 0) && (
                            <div className="space-y-1">
                              <Label className="text-xs">Options</Label>
                              {q.options.map((opt: string, oi: number) => (
                                <div key={oi} className="flex gap-1 items-center">
                                  <Input
                                    value={opt}
                                    onChange={(e) => {
                                      const updated = { ...generatedTest };
                                      updated.questions = [...updated.questions];
                                      const newOpts = [...updated.questions[i].options];
                                      newOpts[oi] = e.target.value;
                                      updated.questions[i] = { ...updated.questions[i], options: newOpts };
                                      setGeneratedTest(updated);
                                    }}
                                    className={cn("h-7 text-xs", opt === q.bonne_reponse && "border-green-500 bg-green-50/50 dark:bg-green-950/20")}
                                  />
                                  {opt === q.bonne_reponse && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs">Bonne réponse</Label>
                            <Input
                              value={q.bonne_reponse}
                              onChange={(e) => {
                                const updated = { ...generatedTest };
                                updated.questions = [...updated.questions];
                                updated.questions[i] = { ...updated.questions[i], bonne_reponse: e.target.value };
                                setGeneratedTest(updated);
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Explication</Label>
                            <Textarea
                              value={q.explication || ""}
                              onChange={(e) => {
                                const updated = { ...generatedTest };
                                updated.questions = [...updated.questions];
                                updated.questions[i] = { ...updated.questions[i], explication: e.target.value };
                                setGeneratedTest(updated);
                              }}
                              className="min-h-[40px] text-xs"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm">{q.question}</p>
                          {q.options?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {q.options.map((opt: string, oi: number) => (
                                <Badge key={oi} variant={opt === q.bonne_reponse ? "default" : "outline"} className="text-[10px]">{opt}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Add question button */}
              <Button
                variant="outline" size="sm" className="w-full gap-2"
                onClick={() => {
                  const updated = { ...generatedTest };
                  updated.questions = [...(updated.questions || []), {
                    question: "", competence: "CE", format: "qcm",
                    options: ["", "", "", ""], bonne_reponse: "", explication: "",
                  }];
                  setGeneratedTest(updated);
                  setEditingQuestionIdx(updated.questions.length - 1);
                }}
              >
                <Plus className="h-4 w-4" />Ajouter une question
              </Button>
            </div>
          )}
          <DialogFooter className="flex-col gap-2">
            <Button onClick={handleSendNowClick} disabled={sendingTest || !generatedTest?.questions?.length} className="w-full gap-2">
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer maintenant aux élèves
            </Button>
            <Button variant="outline" onClick={() => handleSendTest(false)} disabled={sendingTest || !generatedTest?.questions?.length} className="w-full gap-2">
              <Clock className="h-4 w-4" />Envoyer plus tard
            </Button>
            <Button variant="ghost" onClick={handleSkipTest} disabled={sendingTest} className="w-full text-muted-foreground">
              Ne pas envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for sending test */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Envoyer le test</DialogTitle>
            <DialogDescription>
              Sélectionnez les élèves à qui envoyer le test.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedStudentIds.size === groupMembers.length) {
                    setSelectedStudentIds(new Set());
                  } else {
                    setSelectedStudentIds(new Set(groupMembers.map((m) => m.eleve_id)));
                  }
                }}
                className="text-xs"
              >
                {selectedStudentIds.size === groupMembers.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
              <span className="text-xs text-muted-foreground">{selectedStudentIds.size}/{groupMembers.length}</span>
            </div>
            {groupMembers.map((m) => (
              <label key={m.eleve_id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={selectedStudentIds.has(m.eleve_id)}
                  onCheckedChange={(checked) => {
                    setSelectedStudentIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(m.eleve_id); else next.delete(m.eleve_id);
                      return next;
                    });
                  }}
                />
                <span className="text-sm">{m.prenom} {m.nom}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>Annuler</Button>
            <Button onClick={() => handleSendTest(true)} disabled={sendingTest || selectedStudentIds.size === 0} className="gap-1.5">
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer ({selectedStudentIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Adaptation result dialog */}
      <Dialog open={showAdaptation} onOpenChange={setShowAdaptation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />Adaptation IA — Séance N+1
            </DialogTitle>
            <DialogDescription>Suggestions basées sur le bilan d'aujourd'hui</DialogDescription>
          </DialogHeader>
          {adaptationResult && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">Focus compétence</Label>
                <Badge className="ml-2">{adaptationResult.competence_focus}</Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Analyse</Label>
                <p className="text-sm mt-1">{adaptationResult.analyse_bilan}</p>
              </div>
              {adaptationResult.exercices_remediation?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Exercices de remédiation suggérés</Label>
                  <div className="space-y-2 mt-2">
                    {adaptationResult.exercices_remediation.map((ex: any, i: number) => (
                      <div key={i} className="p-3 rounded-md border bg-muted/30 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{ex.titre}</span>
                          <Badge variant="outline" className="text-[10px]">{ex.competence}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{ex.format}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{ex.description}</p>
                        <span className="text-xs text-muted-foreground">~{ex.duree_minutes} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Objectifs ajustés</Label>
                <p className="text-sm mt-1">{adaptationResult.objectifs_ajustes}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={applyAdaptation} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Appliquer les suggestions
            </Button>
            <Button variant="outline" onClick={() => { setShowAdaptation(false); navigate("/formateur/seances"); }} className="flex-1">
              Ignorer et continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`@media print { nav, header, .print\\:hidden { display: none !important; } body { font-size: 12pt; } }`}</style>
    </div>
  );
};

export default SessionBilan;
