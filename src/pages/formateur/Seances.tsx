import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Calendar, Loader2, BookOpen, Pencil, Copy, Rocket, Trash2, Route, ArrowRight, Target, Clock, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COMPETENCES_ORDER, COMPETENCE_COLORS, resolveSessionCompetences } from "@/lib/competences";
import { cn } from "@/lib/utils";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

const getSessionBadge = (statut: string, dateSeance: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
  if (statut === "annulee") return { label: "Annulée", variant: "destructive" };
  if (statut === "terminee") return { label: "Terminée", variant: "secondary" };
  if (statut === "en_cours") return { label: "En cours", variant: "default" };

  const now = new Date();
  const seanceDate = new Date(dateSeance);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seanceDay = new Date(seanceDate.getFullYear(), seanceDate.getMonth(), seanceDate.getDate());

  if (seanceDay.getTime() === today.getTime()) return { label: "Aujourd'hui", variant: "default" };
  if (seanceDay < today) return { label: "Terminée", variant: "secondary" };
  return { label: "Planifiée", variant: "outline" };
};

/** Toggle a competence in a Set-like array */
const toggleComp = (comps: string[], comp: string): string[] =>
  comps.includes(comp) ? comps.filter((c) => c !== comp) : [...comps, comp];

type AutomationSettings = {
  enabled: boolean;
  coreCount: number;
  retrospectiveCount: number;
  retrospectiveDuration: number;
  diagnosticCount: number;
  difficulty: number;
  competences: string[];
};

const defaultAutomation: AutomationSettings = {
  enabled: true,
  coreCount: 5,
  retrospectiveCount: 3,
  retrospectiveDuration: 10,
  diagnosticCount: 10,
  difficulty: 5,
  competences: ["CO", "CE"],
};

const AutomationFields = ({ value, onChange }: {
  value: AutomationSettings;
  onChange: (value: AutomationSettings) => void;
}) => (
  <div className="space-y-3 border-t pt-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <Label>Préparation automatique</Label>
        <p className="text-xs text-muted-foreground">Rétrospective, diagnostic et exercices de séance</p>
      </div>
      <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} />
    </div>
    {value.enabled && (
      <>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Exercices séance", "coreCount", 1, 30],
            ["Exercices rétrospectifs", "retrospectiveCount", 1, 30],
            ["Rétrospective (min)", "retrospectiveDuration", 1, 60],
            ["Questions diagnostic", "diagnosticCount", 5, 30],
          ].map(([label, key, min, max]) => (
            <div className="space-y-1" key={String(key)}>
              <Label className="text-xs">{label}</Label>
              <Input type="number" min={Number(min)} max={Number(max)}
                value={value[key as keyof AutomationSettings] as number}
                onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Difficulté par défaut</Label>
          <Select value={String(value.difficulty)} onValueChange={(difficulty) => onChange({ ...value, difficulty: Number(difficulty) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 10 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}/10</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <CompetenceMultiSelect value={value.competences} onChange={(competences) => onChange({ ...value, competences })} label="Compétences autorisées" />
      </>
    )}
  </div>
);

/** Competence multi-select UI block */
const CompetenceMultiSelect = ({
  value,
  onChange,
  label = "Compétences TCF ciblées",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex flex-wrap gap-2">
      {COMPETENCES_ORDER.map((c) => {
        const selected = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(toggleComp(value, c))}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selected
                ? `${COMPETENCE_COLORS[c]} border-current ring-1 ring-current/30`
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  </div>
);

const SeancesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titre, setTitre] = useState("");
  const [groupId, setGroupId] = useState("");
  const [dateSeance, setDateSeance] = useState("");
  const [niveauCible, setNiveauCible] = useState("A2");
  const [objectifs, setObjectifs] = useState("");
  const [dureeMinutes, setDureeMinutes] = useState("90");
  const [lieu, setLieu] = useState("");
  const [competencesCibles, setCompetencesCibles] = useState<string[]>([]);
  const [automation, setAutomation] = useState<AutomationSettings>(defaultAutomation);

  // Delete state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Sequence attachment
  const [selectedSequenceId, setSelectedSequenceId] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());

  // Fetch groups
  const { data: groups } = useQuery({
    queryKey: ["formateur-groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups").select("id, nom, niveau")
        .eq("formateur_id", user!.id).eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ── Built-in 20-session curriculum for "Séance suivante" ──
  const CURRICULUM: { numero: number; titre: string; objectif: string; competences: string[]; duree: number }[] = [
    { numero: 1, titre: "Séance 1 : Faire connaissance et épeler son nom", objectif: "Se présenter, épeler son nom", competences: ["CO", "EO"], duree: 180 },
    { numero: 2, titre: "Séance 2 : L'identité et les documents officiels", objectif: "Comprendre et remplir un formulaire d'identité", competences: ["CE", "EE"], duree: 180 },
    { numero: 3, titre: "Séance 3 : Les chiffres, les dates et les horaires", objectif: "Maîtriser les nombres, dates et heures", competences: ["CO", "CE"], duree: 180 },
    { numero: 4, titre: "Séance 4 : La famille et l'état civil", objectif: "Parler de sa famille, comprendre un acte d'état civil", competences: ["EO", "CE"], duree: 180 },
    { numero: 5, titre: "Séance 5 : Révision Bloc 1 — Identité et bases", objectif: "Consolider les acquis du bloc 1", competences: ["CO", "CE", "EO", "EE"], duree: 180 },
    { numero: 6, titre: "Séance 6 : Le logement et l'adresse", objectif: "Décrire son logement, comprendre une annonce", competences: ["CE", "EE"], duree: 180 },
    { numero: 7, titre: "Séance 7 : Les courses et les commerces", objectif: "Faire ses courses, comprendre les prix", competences: ["CO", "EO"], duree: 180 },
    { numero: 8, titre: "Séance 8 : Les transports au quotidien", objectif: "Se déplacer, lire un plan de transport", competences: ["CE", "CO"], duree: 180 },
    { numero: 9, titre: "Séance 9 : Le temps et la météo", objectif: "Parler du temps, comprendre une météo", competences: ["CO", "EO"], duree: 180 },
    { numero: 10, titre: "Séance 10 : Révision Bloc 2 — Environnement", objectif: "Consolider les acquis du bloc 2", competences: ["CO", "CE", "EO", "EE"], duree: 180 },
    { numero: 11, titre: "Séance 11 : La santé et le corps", objectif: "Prendre un RDV médical, décrire des symptômes", competences: ["EO", "CE"], duree: 180 },
    { numero: 12, titre: "Séance 12 : La pharmacie et les médicaments", objectif: "Comprendre une ordonnance, acheter en pharmacie", competences: ["CE", "CO"], duree: 180 },
    { numero: 13, titre: "Séance 13 : Les démarches administratives", objectif: "Comprendre un courrier officiel, remplir un formulaire", competences: ["CE", "EE"], duree: 180 },
    { numero: 14, titre: "Séance 14 : La CAF et les aides sociales", objectif: "Comprendre ses droits, remplir une demande", competences: ["CE", "EE"], duree: 180 },
    { numero: 15, titre: "Séance 15 : Révision Bloc 3 — Vie pratique", objectif: "Consolider les acquis du bloc 3", competences: ["CO", "CE", "EO", "EE"], duree: 180 },
    { numero: 16, titre: "Séance 16 : Chercher un emploi", objectif: "Lire une offre d'emploi, rédiger un CV simple", competences: ["CE", "EE"], duree: 180 },
    { numero: 17, titre: "Séance 17 : L'entretien d'embauche", objectif: "Se préparer à un entretien", competences: ["EO", "CO"], duree: 180 },
    { numero: 18, titre: "Séance 18 : La citoyenneté et les valeurs", objectif: "Connaître les valeurs de la République", competences: ["CE", "EO"], duree: 180 },
    { numero: 19, titre: "Séance 19 : Entraînement TCF IRN complet", objectif: "Simulation complète du test", competences: ["CO", "CE", "EO", "EE"], duree: 180 },
    { numero: 20, titre: "Séance 20 : Bilan final et préparation au jour J", objectif: "Révision finale et stratégies d'examen", competences: ["CO", "CE", "EO", "EE"], duree: 180 },
  ];

  // Detect the highest session number already created for this formateur
  const getNextSessionNumber = (): number => {
    if (!sessions || sessions.length === 0) return 1;
    let maxNum = 0;
    for (const s of sessions as any[]) {
      const match = s.titre?.match(/S[ée]ance\s*(\d+)/i);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
    }
    return Math.min(maxNum + 1, 20);
  };

  // State for "next session" dialog
  const [nextSessionOpen, setNextSessionOpen] = useState(false);
  const [selectedCurriculumNum, setSelectedCurriculumNum] = useState<number>(0);
  const [nextGroupId, setNextGroupId] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextLieu, setNextLieu] = useState("");
  const [nextSaving, setNextSaving] = useState(false);

  const openNextSession = (num?: number) => {
    const n = num ?? getNextSessionNumber();
    setSelectedCurriculumNum(n);
    setNextGroupId("");
    setNextDate("");
    setNextLieu("");
    setNextSessionOpen(true);
  };

  const selectedCurriculum = CURRICULUM.find((c) => c.numero === selectedCurriculumNum);

  const handleCreateFromCurriculum = async () => {
    if (!selectedCurriculum) return;
    if (!nextGroupId) { toast.error("Sélectionnez un groupe."); return; }
    if (!nextDate) { toast.error("Choisissez une date."); return; }

    setNextSaving(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .insert({
          titre: selectedCurriculum.titre,
          group_id: nextGroupId,
          date_seance: new Date(nextDate).toISOString(),
          niveau_cible: "A1",
          objectifs: selectedCurriculum.objectif,
          duree_minutes: selectedCurriculum.duree,
          lieu: nextLieu || null,
          competences_cibles: selectedCurriculum.competences,
        } as any);
      if (error) throw error;

      toast.success("Séance créée !", {
        description: `« ${selectedCurriculum.titre} » est prête.`,
      });
      setNextSessionOpen(false);
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setNextSaving(false);
    }
  };


  const { data: sessions, isLoading } = useQuery({
    queryKey: ["formateur-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom, formateur_id)")
        .order("date_seance", { ascending: false });
      if (error) throw error;
      const filtered = (data ?? []).filter((s: any) => s.group?.formateur_id === user!.id);

      // Fetch exercise competences for sessions without competences_cibles
      const sessionIds = filtered.map((s: any) => s.id);
      if (sessionIds.length === 0) return filtered;

      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("session_id, exercice:exercices(competence)")
        .in("session_id", sessionIds);

      const exerciseCompsBySession: Record<string, string[]> = {};
      for (const link of seLinks ?? []) {
        const comp = (link as any).exercice?.competence;
        if (comp) {
          if (!exerciseCompsBySession[link.session_id]) exerciseCompsBySession[link.session_id] = [];
          exerciseCompsBySession[link.session_id].push(comp);
        }
      }

      return filtered.map((s: any) => ({
        ...s,
        _resolvedComps: resolveSessionCompetences(
          (s as any).competences_cibles,
          exerciseCompsBySession[s.id] || []
        ),
      }));
    },
    enabled: !!user,
  });

  // Fetch sequences for attachment
  const { data: sequences } = useQuery({
    queryKey: ["formateur-sequences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequences_pedagogiques").select("id, titre")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && createOpen,
  });

  // Fetch exercises for selected sequence
  const { data: sequenceExercises } = useQuery({
    queryKey: ["sequence-exercises", selectedSequenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices").select("id, titre, competence, format")
        .eq("sequence_id", selectedSequenceId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSequenceId,
  });

  const toggleExercise = (id: string) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllExercises = () => {
    if (!sequenceExercises) return;
    const allSelected = sequenceExercises.every((e) => selectedExerciseIds.has(e.id));
    if (allSelected) {
      setSelectedExerciseIds(new Set());
    } else {
      setSelectedExerciseIds(new Set(sequenceExercises.map((e) => e.id)));
    }
  };

  const handleCreate = async () => {
    if (!titre.trim()) { toast.error("Le titre est obligatoire."); return; }
    if (!groupId) { toast.error("Sélectionnez un groupe."); return; }
    if (!dateSeance) { toast.error("Choisissez une date."); return; }

    setSaving(true);
    try {
      const { data: session, error: sErr } = await supabase
        .from("sessions")
        .insert({
          titre,
          group_id: groupId,
          date_seance: new Date(dateSeance).toISOString(),
          niveau_cible: niveauCible as any,
          objectifs: objectifs || null,
          duree_minutes: parseInt(dureeMinutes) || 90,
          lieu: lieu || null,
          competences_cibles: competencesCibles.length > 0 ? competencesCibles : null,
          nb_exercices_souhaite: automation.coreCount,
          nb_exercices_retrospective: automation.retrospectiveCount,
          duree_retrospective: automation.retrospectiveDuration,
          nb_questions_diagnostic: automation.diagnosticCount,
          difficulte_par_defaut: automation.difficulty,
          competences_autorisees: automation.competences,
          generation_automatique_activee: automation.enabled,
        } as any)
        .select()
        .single();
      if (sErr) throw sErr;

      if (selectedExerciseIds.size > 0) {
        const sessionExercises = Array.from(selectedExerciseIds).map((exId, i) => ({
          session_id: session.id,
          exercice_id: exId,
          ordre: i + 1,
        }));
        const { error: seErr } = await supabase.from("session_exercices").insert(sessionExercises);
        if (seErr) throw seErr;
      }

      toast.success("Séance créée !", {
        description: selectedExerciseIds.size > 0
          ? `${selectedExerciseIds.size} exercice(s) rattaché(s).`
          : "Aucun exercice rattaché.",
      });
      setCreateOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setTitre(""); setGroupId(""); setDateSeance(""); setNiveauCible("A2");
    setObjectifs(""); setDureeMinutes("90"); setLieu("");
    setSelectedSequenceId(""); setSelectedExerciseIds(new Set());
    setCompetencesCibles([]);
    setAutomation(defaultAutomation);
  };

  // ── Edit session state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editGroupId, setEditGroupId] = useState("");
  const [editTitre, setEditTitre] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNiveau, setEditNiveau] = useState("A2");
  const [editDuree, setEditDuree] = useState("90");
  const [editLieu, setEditLieu] = useState("");
  const [editObjectifs, setEditObjectifs] = useState("");
  const [editStatut, setEditStatut] = useState("planifiee");
  const [editCompetences, setEditCompetences] = useState<string[]>([]);
  const [editAutomation, setEditAutomation] = useState<AutomationSettings>(defaultAutomation);

  // ── Duplicate session state ──
  const [dupOpen, setDupOpen] = useState(false);
  const [dupSession, setDupSession] = useState<any>(null);
  const [dupGroupId, setDupGroupId] = useState("");
  const [dupDate, setDupDate] = useState("");
  const [dupSaving, setDupSaving] = useState(false);

  const openDuplicate = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDupSession(s);
    setDupGroupId("");
    setDupDate("");
    setDupOpen(true);
  };

  const handleDuplicate = async () => {
    if (!dupSession || !dupGroupId || !dupDate) {
      toast.error("Choisissez un groupe et une date.");
      return;
    }
    setDupSaving(true);
    try {
      const { data: newSession, error: sErr } = await supabase
        .from("sessions")
        .insert({
          titre: dupSession.titre,
          group_id: dupGroupId,
          date_seance: new Date(dupDate).toISOString(),
          niveau_cible: dupSession.niveau_cible,
          objectifs: dupSession.objectifs,
          duree_minutes: dupSession.duree_minutes,
          lieu: dupSession.lieu,
          competences_cibles: (dupSession as any).competences_cibles || null,
        } as any)
        .select()
        .single();
      if (sErr) throw sErr;

      const { data: srcExercises } = await supabase
        .from("session_exercices")
        .select("exercice_id, ordre")
        .eq("session_id", dupSession.id)
        .order("ordre");

      if (srcExercises && srcExercises.length > 0) {
        const newExercises = srcExercises.map((se: any) => ({
          session_id: newSession.id,
          exercice_id: se.exercice_id,
          ordre: se.ordre,
        }));
        const { error: seErr } = await supabase.from("session_exercices").insert(newExercises);
        if (seErr) throw seErr;
      }

      const targetGroup = (groups ?? []).find((g) => g.id === dupGroupId);
      toast.success("Séance dupliquée !", {
        description: `Pour le groupe ${targetGroup?.nom || ""} avec ${srcExercises?.length || 0} exercice(s).`,
      });
      setDupOpen(false);
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setDupSaving(false);
    }
  };

  const openEdit = (s: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditSession(s);
    setEditGroupId(s.group_id);
    setEditTitre(s.titre);
    setEditDate(new Date(s.date_seance).toISOString().slice(0, 16));
    setEditNiveau(s.niveau_cible);
    setEditDuree(String(s.duree_minutes));
    setEditLieu(s.lieu ?? "");
    setEditObjectifs(s.objectifs ?? "");
    setEditStatut(s.statut);
    setEditCompetences((s as any).competences_cibles || []);
    setEditAutomation({
      enabled: (s as any).generation_automatique_activee ?? true,
      coreCount: (s as any).nb_exercices_souhaite ?? 5,
      retrospectiveCount: (s as any).nb_exercices_retrospective ?? 3,
      retrospectiveDuration: (s as any).duree_retrospective ?? 10,
      diagnosticCount: (s as any).nb_questions_diagnostic ?? 10,
      difficulty: (s as any).difficulte_par_defaut ?? 5,
      competences: (s as any).competences_autorisees ?? ["CO", "CE"],
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTitre.trim()) { toast.error("Le titre est obligatoire."); return; }
    if (!editGroupId) { toast.error("Sélectionnez un groupe."); return; }
    if (!editDate) { toast.error("Choisissez une date."); return; }

    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          titre: editTitre,
          group_id: editGroupId,
          date_seance: new Date(editDate).toISOString(),
          niveau_cible: editNiveau as any,
          duree_minutes: parseInt(editDuree) || 90,
          lieu: editLieu || null,
          objectifs: editObjectifs || null,
          statut: editStatut as any,
          competences_cibles: editCompetences.length > 0 ? editCompetences : null,
          nb_exercices_souhaite: editAutomation.coreCount,
          nb_exercices_retrospective: editAutomation.retrospectiveCount,
          duree_retrospective: editAutomation.retrospectiveDuration,
          nb_questions_diagnostic: editAutomation.diagnosticCount,
          difficulte_par_defaut: editAutomation.difficulty,
          competences_autorisees: editAutomation.competences,
          generation_automatique_activee: editAutomation.enabled,
        } as any)
        .eq("id", editSession.id);
      if (error) throw error;
      toast.success("Séance modifiée !");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setEditSaving(false); }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;
    try {
      await supabase.from("session_exercices").delete().eq("session_id", deleteSessionId);
      const { error } = await supabase.from("sessions").delete().eq("id", deleteSessionId);
      if (error) throw error;
      toast.success("Séance supprimée");
      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setDeleteSessionId(null);
    }
  };

  const openSession = (session: any) => {
    navigate(`/formateur/seances/${session.id}/pilote`);
    if (session.generation_automatique_activee) {
      void supabase.functions.invoke("prepare-session-start", {
        body: { session_id: session.id },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Mes Séances</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 hidden sm:inline-flex"
            onClick={() => openNextSession()}
          >
            <ArrowRight className="h-4 w-4" />
            Séance suivante
          </Button>
          <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full px-5">
                <Plus className="h-4 w-4 mr-2" />Nouvelle séance
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Planifier une séance</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Séance 1 — Vie quotidienne" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Groupe</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {(groups ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Niveau cible</Label>
                  <Select value={niveauCible} onValueChange={setNiveauCible}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Competences TCF */}
              <CompetenceMultiSelect value={competencesCibles} onChange={setCompetencesCibles} />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date et heure</Label>
                  <Input type="datetime-local" value={dateSeance} onChange={(e) => setDateSeance(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Durée (min)</Label>
                  <Input type="number" value={dureeMinutes} onChange={(e) => setDureeMinutes(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lieu (optionnel)</Label>
                <Input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Salle A3 / Lien Zoom" />
              </div>
              <div className="space-y-2">
                <Label>Objectifs (optionnel)</Label>
                <Textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} rows={2} placeholder="Ce que les élèves doivent maîtriser..." />
              </div>
              <AutomationFields value={automation} onChange={setAutomation} />

              {/* Exercise attachment */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Rattacher des exercices
                </Label>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Depuis une séquence existante</Label>
                  <Select value={selectedSequenceId} onValueChange={(v) => {
                    setSelectedSequenceId(v);
                    setSelectedExerciseIds(new Set());
                  }}>
                    <SelectTrigger><SelectValue placeholder="Choisir une séquence..." /></SelectTrigger>
                    <SelectContent>
                      {(sequences ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.titre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {sequenceExercises && sequenceExercises.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{sequenceExercises.length} exercice(s)</span>
                      <button onClick={selectAllExercises} className="text-xs text-primary hover:underline">
                        {sequenceExercises.every((e) => selectedExerciseIds.has(e.id)) ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                      {sequenceExercises.map((ex) => (
                        <label key={ex.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={selectedExerciseIds.has(ex.id)}
                            onCheckedChange={() => toggleExercise(ex.id)}
                          />
                          <span className="text-sm flex-1">{ex.titre}</span>
                          <Badge variant="secondary" className="text-[10px]">{ex.competence}</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer la séance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Edit session dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier la séance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={editTitre} onChange={(e) => setEditTitre(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Groupe</Label>
                <Select value={editGroupId} onValueChange={setEditGroupId}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Niveau cible</Label>
                <Select value={editNiveau} onValueChange={setEditNiveau}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Competences TCF */}
            <CompetenceMultiSelect value={editCompetences} onChange={setEditCompetences} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date et heure</Label>
                <Input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <Input type="number" value={editDuree} onChange={(e) => setEditDuree(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lieu (optionnel)</Label>
              <Input value={editLieu} onChange={(e) => setEditLieu(e.target.value)} placeholder="Salle A3 / Lien Zoom" />
            </div>
            <div className="space-y-2">
              <Label>Objectifs (optionnel)</Label>
              <Textarea value={editObjectifs} onChange={(e) => setEditObjectifs(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editStatut} onValueChange={setEditStatut}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planifiee">Planifiée</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="terminee">Terminée</SelectItem>
                  <SelectItem value="annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AutomationFields value={editAutomation} onChange={setEditAutomation} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate session dialog */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dupliquer la séance</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            « {dupSession?.titre} » — les exercices seront copiés automatiquement.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Groupe cible</Label>
              <Select value={dupGroupId} onValueChange={setDupGroupId}>
                <SelectTrigger><SelectValue placeholder="Choisir un groupe..." /></SelectTrigger>
                <SelectContent>
                  {(groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date et heure</Label>
              <Input type="datetime-local" value={dupDate} onChange={(e) => setDupDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupOpen(false)}>Annuler</Button>
            <Button onClick={handleDuplicate} disabled={dupSaving}>
              {dupSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Dupliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Next session from curriculum dialog */}
      <Dialog open={nextSessionOpen} onOpenChange={setNextSessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Planifier une séance du programme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Session picker */}
            <div className="space-y-2">
              <Label>Séance</Label>
              <Select value={String(selectedCurriculumNum)} onValueChange={(v) => setSelectedCurriculumNum(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Choisir une séance..." /></SelectTrigger>
                <SelectContent>
                  {CURRICULUM.map((c) => (
                    <SelectItem key={c.numero} value={String(c.numero)}>
                      {c.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {selectedCurriculum && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Target className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {selectedCurriculum.objectif}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{selectedCurriculum.duree} min</span>
                  <div className="flex gap-1">
                    {selectedCurriculum.competences.map((c) => (
                      <span key={c} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${COMPETENCE_COLORS[c] || ""}`}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Groupe</Label>
              <Select value={nextGroupId} onValueChange={setNextGroupId}>
                <SelectTrigger><SelectValue placeholder="Choisir un groupe..." /></SelectTrigger>
                <SelectContent>
                  {(groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date et heure</Label>
                <Input type="datetime-local" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Lieu (optionnel)</Label>
                <Input value={nextLieu} onChange={(e) => setNextLieu(e.target.value)} placeholder="Salle A3" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNextSessionOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateFromCurriculum} disabled={nextSaving}>
              {nextSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer la séance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sessions list */}
      {sessions && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <p className="font-semibold text-foreground">Aucune séance planifiée</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre première séance pour commencer.</p>
          <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
            <Plus className="h-4 w-4" /> Créer ma première séance
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {(sessions ?? []).map((s: any) => {
          const badge = getSessionBadge(s.statut, s.date_seance);
          const isToday = badge.label === "Aujourd'hui";
          const isEnCours = s.statut === "en_cours";
          const isDone = s.statut === "terminee" || (badge.label === "Terminée" && s.statut !== "en_cours");
          const isCancelled = s.statut === "annulee";

          const startDate = new Date(s.date_seance);
          const endDate = new Date(startDate.getTime() + (s.duree_minutes || 90) * 60000);
          const timeRange = `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`;

          const today = new Date();
          const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
          const sDay = startDate.toDateString();
          const timeLabel = sDay === today.toDateString()
            ? timeRange
            : sDay === tomorrow.toDateString()
            ? `Demain, ${timeRange}`
            : `${format(startDate, "EEEE d MMMM", { locale: fr })}, ${timeRange}`;

          return (
            <div
              key={s.id}
              className={cn(
                "rounded-2xl border p-5 cursor-pointer transition-colors shadow-md group",
                isEnCours ? "bg-green-50 border-green-200 hover:bg-green-100/70"
                  : isToday ? "bg-blue-50 border-blue-200 hover:bg-blue-100/70"
                  : isDone ? "bg-muted/30 border-border"
                  : isCancelled ? "bg-destructive/5 border-destructive/20"
                  : "bg-white border-border hover:border-primary/30"
              )}
              onClick={() => openSession(s)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Status badge */}
                  <div>
                    {isEnCours ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                        Séance en cours
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      </span>
                    ) : isToday ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                        Aujourd'hui
                      </span>
                    ) : isDone ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                        Terminée
                      </span>
                    ) : isCancelled ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        Annulée
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white text-foreground border border-border">
                        Planifiée
                      </span>
                    )}
                  </div>

                  {/* Session info lines */}
                  <div className="space-y-0.5 text-sm">
                    <p><span className="font-bold">Titre :</span> {s.titre}</p>
                    <p><span className="font-bold">Groupe :</span> {s.group?.nom}</p>
                    <p><span className="font-bold">Horaire :</span> {timeLabel}</p>
                    {isDone && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold">Actions :</span>{" "}
                        <button className="underline hover:text-foreground" onClick={(e) => openEdit(s, e)}>Modifier</button>
                        {" · "}
                        <button className="underline hover:text-foreground" onClick={(e) => openDuplicate(s, e)}>Dupliquer</button>
                        {" · "}
                        <button className="underline text-destructive hover:text-destructive/80" onClick={(e) => { e.stopPropagation(); setDeleteSessionId(s.id); }}>Supprimer</button>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-1">
                  {/* Subtle action buttons for non-done sessions */}
                  {!isDone && (
                    <div className="hidden group-hover:flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(s, e)} title="Modifier">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openDuplicate(s, e)} title="Dupliquer">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteSessionId(s.id); }} title="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(v) => { if (!v) setDeleteSessionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer cette séance ? Les exercices rattachés seront également détachés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SeancesPage;
