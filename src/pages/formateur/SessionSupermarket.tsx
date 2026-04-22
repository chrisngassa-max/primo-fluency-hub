import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Clock,
  Target,
  ShoppingCart,
  Printer,
  CheckSquare,
  Gamepad2,
  BookOpen,
  Send,
  Eye,
  EyeOff,
  ClipboardList,
  X,
  Save,
  Users,
  Timer,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExternalResourcePicker } from "@/components/ExternalResourcePicker";

interface FicheEleve {
  titre_fiche: string;
  contenu_fiche: string;
  lexique_cles: string[];
}

interface DocumentationFournie {
  guide_formateur: string;
  fiches_eleves: FicheEleve[];
}

interface SessionExercice {
  titre: string;
  consigne: string;
  format: string;
  competence: string;
  difficulte: number;
  contenu: any;
  scenario_detaille?: string;
  descriptions_visuelles?: string[];
  atelier_ludique: {
    scenario: string;
    jeu: string;
    materiel: string;
    objectif_oral: string;
    duree_minutes?: number;
    variante?: string;
    documentation_fournie?: DocumentationFournie;
  };
}

interface SessionInfo {
  titre: string;
  objectifs?: string;
  competences_cibles: string[];
  duree_minutes: number;
  niveau_cible: string;
  exercices_suggeres?: string[];
  source: "import" | "parcours";
  groupId?: string;
}

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

const TYPE_ACTIVITE_OPTIONS = [
  { value: "ia_choix", label: "IA choisit le meilleur type" },
  { value: "jeu_de_role", label: "🎭 Jeu de rôle / Simulation" },
  { value: "jeu_plateau_cartes", label: "🃏 Jeu de plateau / Cartes" },
  { value: "activite_physique", label: "🏃 Activité physique / Mouvement" },
  { value: "creation_artistique", label: "🎨 Création artistique" },
  { value: "enquete_mission", label: "🔎 Enquête / Mission" },
  { value: "numerique_interactif", label: "💻 Numérique interactif" },
];

const DUREE_OPTIONS = [
  { value: "15", label: "15 min — Échauffement" },
  { value: "25", label: "25 min — Activité standard" },
  { value: "40", label: "40 min — Activité approfondie" },
  { value: "60", label: "60 min — Séquence complète" },
];

const FORMAT_GROUPE_OPTIONS = [
  { value: "ia_choix", label: "IA choisit" },
  { value: "individuel", label: "👤 Individuel" },
  { value: "binomes", label: "👥 Binômes" },
  { value: "petits_groupes", label: "👥👥 Petits groupes (3-4)" },
  { value: "classe_entiere", label: "🏫 Classe entière" },
];

const SessionSupermarket = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const sessionInfo = location.state as SessionInfo | null;

  const [generating, setGenerating] = useState(false);
  const [exercices, setExercices] = useState<SessionExercice[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState("");
  const [showAteliers, setShowAteliers] = useState(true);
  const [gabaritIgnored, setGabaritIgnored] = useState(false);
  const [saving, setSaving] = useState(false);

  // Configuration selectors state
  const [typeActivite, setTypeActivite] = useState("ia_choix");
  const [activiteDuree, setActiviteDuree] = useState("25");
  const [formatGroupe, setFormatGroupe] = useState("ia_choix");
  const [typeDemarcheSm, setTypeDemarcheSm] = useState((sessionInfo as any)?.type_demarche || "titre_sejour");

  // Fetch today's sessions for dispatch target
  const { data: todaySessions } = useQuery({
    queryKey: ["formateur-today-sessions"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, groups(nom)")
        .gte("date_seance", today.toISOString())
        .lt("date_seance", tomorrow.toISOString())
        .order("date_seance");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Also fetch all upcoming sessions
  const { data: upcomingSessions } = useQuery({
    queryKey: ["formateur-upcoming-sessions-dispatch"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, groups(nom)")
        .gte("date_seance", new Date().toISOString())
        .order("date_seance")
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch first point_a_maitriser for linking exercises
  const { data: defaultPoint } = useQuery({
    queryKey: ["default-point-a-maitriser"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Auto-detect matching gabarit from session title
  const { data: detectedGabarit } = useQuery({
    queryKey: ["detected-gabarit", sessionInfo?.titre],
    queryFn: async () => {
      if (!sessionInfo?.titre) return null;
      const words = sessionInfo.titre.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      if (words.length === 0) return null;
      const keyword = words.reduce((a, b) => a.length > b.length ? a : b);
      const { data, error } = await supabase
        .from("gabarits_pedagogiques")
        .select("*")
        .ilike("titre", `%${keyword}%`)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Gabarit search error:", error);
        return null;
      }
      return data;
    },
    enabled: !!sessionInfo?.titre,
  });

  const handleGenerate = async () => {
    if (!sessionInfo) return;
    setGenerating(true);
    setExercices([]);
    setSelected(new Set());
    try {
      const useGabarit = detectedGabarit && !gabaritIgnored;

      // Load micro-competences config if a target session is selected
      let microComps: any[] | undefined;
      if (targetSessionId && user?.id) {
        const { data: mcData } = await supabase
          .from("formateur_competences_config")
          .select("competences_ordonnees")
          .eq("seance_id", targetSessionId)
          .eq("formateur_id", user.id)
          .maybeSingle();
        if (mcData?.competences_ordonnees && Array.isArray(mcData.competences_ordonnees) && mcData.competences_ordonnees.length > 0) {
          microComps = mcData.competences_ordonnees as any[];
        }
      }

      const body: any = {
        titre: sessionInfo.titre,
        objectifs: sessionInfo.objectifs,
        competences_cibles: sessionInfo.competences_cibles,
        niveau_cible: sessionInfo.niveau_cible,
        duree_minutes: sessionInfo.duree_minutes,
        exercices_suggeres: sessionInfo.exercices_suggeres,
        type_activite: typeActivite,
        activite_duree_minutes: parseInt(activiteDuree),
        format_groupe: formatGroupe,
      };
      if (microComps) body.micro_competences = microComps;
      body.type_demarche = typeDemarcheSm;
      if (useGabarit) {
        body.gabaritNumero = detectedGabarit.numero;
      }
      const { data, error } = await supabase.functions.invoke("generate-session-content", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const exs = data.exercices || [];
      setExercices(exs);
      setSelected(new Set(exs.map((_: any, i: number) => i)));
      toast.success(`${exs.length} exercices + ateliers générés !${useGabarit ? " (gabarit appliqué)" : ""}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === exercices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exercices.map((_, i) => i)));
    }
  };

  const selectedExercices = useMemo(
    () => exercices.filter((_, i) => selected.has(i)),
    [exercices, selected]
  );

  const handleDispatch = async () => {
    if (!targetSessionId || selectedExercices.length === 0) {
      toast.error("Sélectionnez une séance cible et au moins un exercice.");
      return;
    }
    if (!defaultPoint) {
      toast.error("Aucun point à maîtriser trouvé dans la base.");
      return;
    }

    setDispatching(true);
    try {
      const exercicesToInsert = selectedExercices.map((ex) => ({
        formateur_id: user!.id,
        titre: ex.titre,
        consigne: ex.consigne,
        format: ex.format as any,
        competence: ex.competence as any,
        difficulte: ex.difficulte,
        niveau_vise: sessionInfo?.niveau_cible || "A1",
        contenu: ex.contenu,
        animation_guide: ex.atelier_ludique as any,
        point_a_maitriser_id: defaultPoint.id,
        is_ai_generated: true,
        collectif: true,
        mode: "les_deux" as const,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("exercices")
        .insert(exercicesToInsert)
        .select("id");
      if (insErr) throw insErr;

      const sessionExercicesToInsert = (inserted || []).map((ex, i) => ({
        session_id: targetSessionId,
        exercice_id: ex.id,
        ordre: i + 1,
        statut: "planifie" as const,
      }));

      const { error: linkErr } = await supabase
        .from("session_exercices")
        .insert(sessionExercicesToInsert);
      if (linkErr) throw linkErr;

      if (sessionInfo?.competences_cibles && sessionInfo.competences_cibles.length > 0) {
        await supabase
          .from("sessions")
          .update({ competences_cibles: sessionInfo.competences_cibles } as any)
          .eq("id", targetSessionId);
      }

      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
      toast.success(`${selectedExercices.length} exercices ajoutés à la séance !`);
      navigate("/formateur/seances");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e.message });
    } finally {
      setDispatching(false);
    }
  };

  const handleSaveActivite = async (ex: SessionExercice, index: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("activites_sauvegardees").insert({
        formateur_id: user.id,
        titre: ex.titre,
        type_activite: typeActivite,
        niveau: sessionInfo?.niveau_cible || "A1",
        duree_minutes: parseInt(activiteDuree),
        contenu_genere: {
          exercice: { titre: ex.titre, consigne: ex.consigne, format: ex.format, competence: ex.competence, difficulte: ex.difficulte, contenu: ex.contenu },
          atelier_ludique: ex.atelier_ludique,
          scenario_detaille: ex.scenario_detaille,
          descriptions_visuelles: ex.descriptions_visuelles,
        } as any,
      });
      if (error) throw error;
      toast.success(`"${ex.titre}" sauvegardé dans vos activités`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de sauvegarde", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (selectedExercices.length === 0) {
      toast.error("Sélectionnez au moins un exercice.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${sessionInfo?.titre || "Fiche exercices"}</title>
<style>
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 1.5cm; font-size: 16px; color: #222; line-height: 1.6; }
h1 { font-size: 22px; border-bottom: 3px solid #2563eb; padding-bottom: 8px; color: #1e40af; margin-bottom: 16px; }
.meta { color: #666; font-size: 13px; margin-bottom: 24px; }
.exercise { page-break-inside: avoid; margin-bottom: 28px; border: 2px solid #e5e7eb; padding: 20px; border-radius: 12px; background: #fafafa; }
.exercise h2 { font-size: 18px; margin: 0 0 6px 0; color: #1e40af; }
.badges { display: flex; gap: 6px; margin-bottom: 10px; }
.badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
.badge-format { background: #f3e8ff; color: #7c3aed; }
.consigne { font-style: italic; margin: 10px 0; padding: 10px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; font-size: 15px; }
.item { margin: 12px 0 12px 8px; padding: 8px 0; border-bottom: 1px dotted #ddd; }
.item:last-child { border-bottom: none; }
.item strong { color: #1e40af; }
.options { margin-left: 20px; margin-top: 6px; }
.option { margin: 4px 0; font-size: 15px; }
.option::before { content: "☐ "; font-size: 18px; }
.write-zone { border: 2px dashed #94a3b8; min-height: 80px; margin-top: 10px; border-radius: 8px; background: #fff; }
.write-lines { min-height: 80px; margin-top: 10px; background: repeating-linear-gradient(transparent, transparent 28px, #d1d5db 28px, #d1d5db 29px); }
@media print {
  body { margin: 1cm; padding: 0; }
  .exercise { break-inside: avoid; border-color: #ccc; background: #fff; }
  .no-print { display: none !important; }
}
</style></head><body>
<h1>📝 ${sessionInfo?.titre || "Exercices"}</h1>
<div class="meta">Niveau : ${sessionInfo?.niveau_cible || ""} · ${selectedExercices.length} exercice(s) · ${sessionInfo?.duree_minutes || 0} min</div>
${selectedExercices
  .map(
    (ex, i) => `
<div class="exercise">
  <h2>${i + 1}. ${ex.titre}</h2>
  <div class="badges">
    <span class="badge">${ex.competence}</span>
    <span class="badge badge-format">${formatLabels[ex.format] || ex.format}</span>
  </div>
  <div class="consigne">${ex.consigne}</div>
  ${(ex.contenu?.items || [])
    .map(
      (item: any, j: number) => `
    <div class="item">
      <strong>${j + 1}.</strong> ${item.question || item.texte || ""}
      ${
        item.options?.length
          ? `<div class="options">${item.options.map((o: string) => `<div class="option">${o}</div>`).join("")}</div>`
          : '<div class="write-lines"></div>'
      }
    </div>`
    )
    .join("")}
</div>`
  )
  .join("")}
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintMateriel = () => {
    const exsWithDocs = selectedExercices.filter(
      (ex) => ex.atelier_ludique?.documentation_fournie
    );
    if (exsWithDocs.length === 0) {
      toast.error("Aucun matériel pédagogique disponible dans la sélection.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Matériel — ${sessionInfo?.titre || "Séance"}</title>
<style>
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 1.5cm; font-size: 16px; color: #000; background: #fff; line-height: 1.7; }
h1 { font-size: 24px; border-bottom: 3px solid #f59e0b; padding-bottom: 10px; margin-bottom: 24px; color: #92400e; }
h2 { font-size: 20px; margin: 28px 0 12px 0; color: #92400e; border-left: 4px solid #f59e0b; padding-left: 12px; }
.meta { color: #666; font-size: 13px; margin-bottom: 24px; }
.guide { border: 2px solid #fbbf24; padding: 20px; border-radius: 12px; margin-bottom: 20px; page-break-inside: avoid; background: #fffbeb; }
.guide-title { font-weight: bold; font-size: 16px; margin-bottom: 12px; color: #92400e; }
.guide-body { white-space: pre-line; font-size: 15px; line-height: 1.8; }
.fiche { page-break-before: always; border: 3px solid #000; padding: 28px; border-radius: 12px; }
.fiche-titre { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 20px; border-bottom: 3px dashed #666; padding-bottom: 16px; }
.fiche-contenu { font-size: 18px; line-height: 2; white-space: pre-line; margin-bottom: 20px; }
.lexique { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.lexique-mot { border: 2px solid #000; padding: 6px 16px; border-radius: 8px; font-size: 16px; font-weight: bold; background: #fef3c7; }
.lexique-titre { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
.scenario-block { background: #f0fdf4; border: 2px solid #22c55e; padding: 16px; border-radius: 10px; margin-bottom: 16px; page-break-inside: avoid; }
.scenario-block h3 { color: #166534; font-size: 16px; margin: 0 0 8px 0; }
.scenario-body { white-space: pre-line; font-size: 14px; line-height: 1.7; }
@media print {
  body { margin: 1cm; padding: 0; }
  .fiche { break-before: page; }
  .guide { break-inside: avoid; }
}
</style></head><body>
<h1>📦 Matériel Pédagogique — ${sessionInfo?.titre || ""}</h1>
<div class="meta">Niveau : ${sessionInfo?.niveau_cible || ""} · ${exsWithDocs.length} activité(s) avec matériel</div>
${exsWithDocs
  .map(
    (ex, i) => {
      const doc = ex.atelier_ludique.documentation_fournie!;
      return `
<h2>${i + 1}. ${ex.titre}</h2>
${ex.scenario_detaille ? `
<div class="scenario-block">
  <h3>🎬 Scénario détaillé</h3>
  <div class="scenario-body">${ex.scenario_detaille}</div>
</div>` : ""}
<div class="guide">
  <div class="guide-title">📋 Guide Formateur — Instructions pas-à-pas</div>
  <div class="guide-body">${doc.guide_formateur}</div>
</div>
${(doc.fiches_eleves || [])
  .map(
    (fiche) => `
<div class="fiche">
  <div class="fiche-titre">📄 ${fiche.titre_fiche}</div>
  <div class="fiche-contenu">${fiche.contenu_fiche}</div>
  ${fiche.lexique_cles?.length ? `
  <div class="lexique-titre">📝 Lexique clé :</div>
  <div class="lexique">
    ${fiche.lexique_cles.map((m: string) => `<span class="lexique-mot">${m}</span>`).join("")}
  </div>` : ""}
</div>`
  )
  .join("")}`;
    }
  )
  .join("")}
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (!sessionInfo) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Constructeur de Séance</h1>
            <p className="text-sm text-muted-foreground">Aucune séance sélectionnée</p>
          </div>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              Accédez à cette page depuis un plan de formation ou un programme importé
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allSessions = upcomingSessions || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            {sessionInfo.titre}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sessionInfo.niveau_cible} · {sessionInfo.duree_minutes} min ·{" "}
            {sessionInfo.competences_cibles.join(", ")}
          </p>
        </div>
      </div>

      {/* Session info */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="space-y-2">
            {sessionInfo.objectifs && (
              <p className="text-sm"><strong>Objectifs :</strong> {sessionInfo.objectifs}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {sessionInfo.competences_cibles.map((c) => (
                <Badge key={c} className={competenceColors[c] || ""}>{c}</Badge>
              ))}
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" /> {sessionInfo.duree_minutes} min
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Target className="h-3 w-3" /> {sessionInfo.niveau_cible}
              </Badge>
            </div>
            {sessionInfo.exercices_suggeres && sessionInfo.exercices_suggeres.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                <span className="text-xs text-muted-foreground mr-1">Suggestions :</span>
                {sessionInfo.exercices_suggeres.map((ex, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{ex}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration panel + Gabarit + Generate */}
      {exercices.length === 0 && !generating && (
        <div className="space-y-4">
          {/* Configuration selectors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                Configuration de la génération
              </CardTitle>
              <CardDescription className="text-xs">
                Personnalisez le type d'activité, la durée et le format de groupe avant de générer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Type d'activité */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Gamepad2 className="h-3.5 w-3.5" />
                    Type d'activité
                  </Label>
                  <Select value={typeActivite} onValueChange={setTypeActivite}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_ACTIVITE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Durée activité */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    Durée de l'activité
                  </Label>
                  <Select value={activiteDuree} onValueChange={setActiviteDuree}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DUREE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Format groupe */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Format de groupe
                  </Label>
                  <Select value={formatGroupe} onValueChange={setFormatGroupe}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_GROUPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Démarche IRN */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Démarche IRN
                  </Label>
                  <Select value={typeDemarcheSm} onValueChange={setTypeDemarcheSm}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="titre_sejour">Titre de séjour (CO + CE)</SelectItem>
                      <SelectItem value="residency">Résidence (CO + CE)</SelectItem>
                      <SelectItem value="naturalisation">Naturalisation (CO + CE + EE + EO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gabarit detection */}
          {detectedGabarit && !gabaritIgnored && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="py-4 px-5 space-y-2">
                <div className="flex items-start gap-3">
                  <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold">
                      📋 Gabarit détecté : Séance {detectedGabarit.numero} — {detectedGabarit.titre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detectedGabarit.palier_cecrl && `Palier ${detectedGabarit.palier_cecrl}`}
                      {detectedGabarit.competences_cibles?.length > 0 && ` · ${detectedGabarit.competences_cibles.join(", ")}`}
                    </p>
                    {detectedGabarit.lexique_cibles?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Lexique :</span>{" "}
                        {detectedGabarit.lexique_cibles.slice(0, 8).join(", ")}
                        {detectedGabarit.lexique_cibles.length > 8 && "…"}
                      </p>
                    )}
                    {detectedGabarit.objectif_principal && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Objectif :</span> {detectedGabarit.objectif_principal}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => setGabaritIgnored(true)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleGenerate} className="flex-1" data-gabarit={detectedGabarit.numero}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Générer selon ce gabarit
                  </Button>
                  <Button variant="outline" onClick={() => setGabaritIgnored(true)}>
                    Ignorer le gabarit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate button (no gabarit) */}
          {(!detectedGabarit || gabaritIgnored) && (
            <Button onClick={handleGenerate} size="lg" className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              Générer les exercices et ateliers ludiques
            </Button>
          )}
        </div>
      )}

      {generating && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
            <p className="font-medium">L'IA génère le contenu de la séance...</p>
            <p className="text-sm text-muted-foreground mt-1">
              {TYPE_ACTIVITE_OPTIONS.find(o => o.value === typeActivite)?.label || "Activité"} · {activiteDuree} min · {FORMAT_GROUPE_OPTIONS.find(o => o.value === formatGroupe)?.label || ""}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Exercises + workshops list */}
      {exercices.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {exercices.length} paires exercice + atelier
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAteliers(!showAteliers)}>
                {showAteliers ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showAteliers ? "Masquer ateliers" : "Voir ateliers"}
              </Button>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                <CheckSquare className="h-4 w-4 mr-1" />
                {selected.size === exercices.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {exercices.map((ex, i) => (
              <Card
                key={i}
                className={cn(
                  "transition-all cursor-pointer",
                  selected.has(i) && "ring-2 ring-primary/50 bg-primary/5"
                )}
                onClick={() => toggleSelect(i)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex gap-3">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={selected.has(i)}
                        onCheckedChange={() => toggleSelect(i)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      {/* Exercise part */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">{ex.titre}</span>
                          <Badge className={`text-[10px] ${competenceColors[ex.competence] || ""}`}>
                            {ex.competence}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {formatLabels[ex.format] || ex.format}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            Diff. {ex.difficulte}/10
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground italic">{ex.consigne}</p>

                        {/* New pedagogical metadata */}
                        {(ex.contenu?.note_differentiation || ex.contenu?.justification_pedagogique || ex.contenu?.duree_estimee_secondes) && (
                          <div className="space-y-1 p-2 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs">
                            {ex.contenu?.duree_estimee_secondes && (
                              <p className="text-blue-700 dark:text-blue-300">⏱️ Durée estimée : {Math.round(ex.contenu.duree_estimee_secondes / 60)} min</p>
                            )}
                            {ex.contenu?.note_differentiation && (
                              <p className="text-blue-700 dark:text-blue-300">🎯 {ex.contenu.note_differentiation}</p>
                            )}
                            {ex.contenu?.justification_pedagogique && (
                              <p className="text-blue-700 dark:text-blue-300">📘 {ex.contenu.justification_pedagogique}</p>
                            )}
                            {ex.contenu?.criteres_correction && typeof ex.contenu.criteres_correction === "object" && (
                              <div className="grid grid-cols-2 gap-1 mt-1">
                                {Object.entries(ex.contenu.criteres_correction).filter(([_, v]) => v).map(([key, val]) => (
                                  <p key={key} className="text-[11px] text-blue-600 dark:text-blue-400">
                                    <span className="font-medium">{key.replace(/_/g, " ")}</span> : {val as string}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{ex.contenu?.items?.length || 0} item(s)</span>
                          {/* Save button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1 ml-auto"
                            disabled={saving}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveActivite(ex, i);
                            }}
                          >
                            <Save className="h-3 w-3" />
                            Sauvegarder
                          </Button>
                        </div>
                      </div>

                      {/* Workshop part */}
                      {showAteliers && ex.atelier_ludique && (
                        <div className="border-t pt-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                            <Gamepad2 className="h-4 w-4" />
                            Atelier ludique (formateur uniquement)
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">🎭 Scénario :</span>{" "}
                              {ex.atelier_ludique.scenario}
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">🎲 Jeu :</span>{" "}
                              {ex.atelier_ludique.jeu}
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">📦 Matériel :</span>{" "}
                              {ex.atelier_ludique.materiel}
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <span className="font-semibold">🗣️ Objectif oral :</span>{" "}
                              {ex.atelier_ludique.objectif_oral}
                            </div>
                          </div>
                          {ex.atelier_ludique.variante && (
                            <p className="text-xs text-muted-foreground">
                              💡 Variante : {ex.atelier_ludique.variante}
                            </p>
                          )}

                          {/* Scenario détaillé */}
                          {ex.scenario_detaille && (
                            <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-xs whitespace-pre-line border border-green-200 dark:border-green-800">
                              <span className="font-semibold block mb-1 text-green-700 dark:text-green-400">🎬 Scénario détaillé :</span>
                              {ex.scenario_detaille}
                            </div>
                          )}

                          {/* Documentation Fournie */}
                          {ex.atelier_ludique.documentation_fournie && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                📦 Matériel Pédagogique & Jeux
                              </div>
                              <div className="p-3 rounded-md bg-muted/60 text-xs whitespace-pre-line">
                                <span className="font-semibold block mb-1">📋 Guide formateur :</span>
                                {ex.atelier_ludique.documentation_fournie.guide_formateur}
                              </div>
                              {ex.atelier_ludique.documentation_fournie.fiches_eleves?.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {ex.atelier_ludique.documentation_fournie.fiches_eleves.map((fiche, fi) => (
                                    <Card key={fi} className="border bg-accent/20">
                                      <CardContent className="p-3 space-y-1.5">
                                        <p className="text-xs font-bold">{fiche.titre_fiche}</p>
                                        <p className="text-xs whitespace-pre-line">{fiche.contenu_fiche}</p>
                                        {fiche.lexique_cles?.length > 0 && (
                                          <div className="flex flex-wrap gap-1 pt-1">
                                            {fiche.lexique_cles.map((mot, mi) => (
                                              <Badge key={mi} variant="secondary" className="text-[9px]">{mot}</Badge>
                                            ))}
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Floating dispatch bar */}
      {exercices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-3 px-6 py-3 flex-wrap">
            <div className="text-sm font-medium shrink-0">
              <Badge variant="default" className="mr-1">{selected.size}</Badge>
              sélectionné(s)
            </div>
            <Select value={targetSessionId} onValueChange={setTargetSessionId}>
              <SelectTrigger className="flex-1 max-w-xs">
                <SelectValue placeholder="Séance cible..." />
              </SelectTrigger>
              <SelectContent>
                {todaySessions && todaySessions.length > 0 && (
                  <>
                    <SelectItem value="__header_today" disabled>— Aujourd'hui —</SelectItem>
                    {todaySessions.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.titre} {s.groups?.nom ? `(${s.groups.nom})` : ""}
                      </SelectItem>
                    ))}
                  </>
                )}
                {allSessions.filter((s: any) => !todaySessions?.some((t: any) => t.id === s.id)).length > 0 && (
                  <>
                    <SelectItem value="__header_upcoming" disabled>— Prochaines —</SelectItem>
                    {allSessions
                      .filter((s: any) => !todaySessions?.some((t: any) => t.id === s.id))
                      .map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.titre} — {new Date(s.date_seance).toLocaleDateString("fr-FR")}
                        </SelectItem>
                      ))}
                  </>
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleDispatch}
              disabled={dispatching || selected.size === 0 || !targetSessionId}
            >
              {dispatching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Ajouter
            </Button>
            {targetSessionId && (
              <ExternalResourcePicker sessionId={targetSessionId} onAdded={() => { /* refresh handled by parent queries */ }} />
            )}
            <Button variant="outline" onClick={handlePrint} disabled={selected.size === 0}>
              <Printer className="h-4 w-4 mr-2" />
              Exercices
            </Button>
            <Button variant="outline" onClick={handlePrintMateriel} disabled={selected.size === 0}>
              <Printer className="h-4 w-4 mr-2" />
              Matériel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionSupermarket;
