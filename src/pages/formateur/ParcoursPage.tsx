import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Plus,
  Sparkles,
  Loader2,
  Clock,
  Target,
  BookOpen,
  ArrowRight,
  Save,
  Copy,
  Trash2,
  Eye,
  GraduationCap,
  CalendarIcon,
  Landmark,
  CheckCircle2,
  Layers,
  Factory,
  FileText,
} from "lucide-react";
import { fetchActivePlanVersion, fetchTrainingSessions } from "@/lib/curriculum/api";
import { CURRICULUM_PLAN_VERSION_LABEL } from "@/lib/curriculum/sessions";
import { CURRICULUM_PALIERS, formatPalierParcoursLabel, type CurriculumPalier } from "@/lib/curriculum/pilot";
import { CurriculumPilotButton } from "@/components/curriculum/CurriculumPilotButton";
import { SessionDocumentsPanel } from "@/components/curriculum/SessionDocumentsPanel";

// MVP "Documents de séance" : seul S01 (v3) a des documents éditables pour
// l'instant (docs/seance-1-v3-validation/). Ne pas étendre à S02-S37 tant
// que l'éditeur n'a pas été validé sur ce périmètre restreint.
const SESSIONS_WITH_DOCUMENTS = new Set(["S01"]);

const CURRICULUM_V2_VERSION = "curriculum-v2.0";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

type VariantePlan = "enrichi" | "civique";
type VarianteFilter = VariantePlan | "curriculum-v2" | "tous";

interface VarianteConfig {
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  civique: boolean;
  heuresDefaut: number;
  badgeClass: string;
  cardActiveClass: string;
}

const VARIANTES: Record<VariantePlan, VarianteConfig> = {
  enrichi: {
    label: "Parcours enrichi (sans civique)",
    shortLabel: "Enrichi",
    tagline: "Cohorte actuelle",
    description: "Contrat 20 séances · S8–S20 enrichi (TCF IRN). Module civique masqué par profil.",
    civique: false,
    heuresDefaut: 50,
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    cardActiveClass: "ring-2 ring-emerald-500 border-emerald-500",
  },
  civique: {
    label: "Parcours complet / civique (90h)",
    shortLabel: "Civique 90h",
    tagline: "Cohorte suivante",
    description: "Inclut le module optionnel civique S21–S30 (activé si re-signature + examen civique obligatoire).",
    civique: true,
    heuresDefaut: 90,
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    cardActiveClass: "ring-2 ring-amber-500 border-amber-500",
  },
};

const CURRICULUM_V2_CONFIG = {
  label: "Parcours CapTCF curriculum v2 (120h)",
  shortLabel: "Curriculum v2",
  tagline: "Référentiel officiel",
  description:
    "41 séances S01–S37 + E1–E4 · Parcours cumulatif A2/CSP (80h) + paliers B1 et B2, aligné sur le manifest curriculum-v2.0.",
  heuresTotales: 120,
  badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cardActiveClass: "ring-2 ring-blue-500 border-blue-500",
};

const normalizeVariante = (v?: string | null): VariantePlan =>
  v === "civique" ? "civique" : "enrichi";

interface GeneratedSeance {
  titre: string;
  objectif_principal: string;
  competences_cibles: string[];
  duree_minutes: number;
  nb_exercices_suggeres: number;
}

const competenceColors: Record<string, string> = {
  CO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Structures: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const ParcoursPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Variant selection (filter + creation preset)
  const [selectedVariante, setSelectedVariante] = useState<VarianteFilter>("tous");
  const [variante, setVariante] = useState<VariantePlan>("enrichi");
  const [documentsSessionCode, setDocumentsSessionCode] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [niveauDepart, setNiveauDepart] = useState("A0");
  const [niveauCible, setNiveauCible] = useState("A1");
  const [heuresTotales, setHeuresTotales] = useState(50);
  const [dureeSeance, setDureeSeance] = useState(90);
  const [typeDemarche, setTypeDemarche] = useState<"titre_sejour" | "naturalisation">("titre_sejour");
  const [isTemplate, setIsTemplate] = useState(false);
  const [dateExamenCible, setDateExamenCible] = useState<Date | undefined>(undefined);

  const [curriculumPalierCible, setCurriculumPalierCible] = useState<CurriculumPalier>("B2");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedSeances, setGeneratedSeances] = useState<GeneratedSeance[] | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["formateur-groups-parcours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: parcoursList, isLoading: parcoursLoading } = useQuery({
    queryKey: ["formateur-parcours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcours")
        .select("*, group:groups(nom)")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: curriculumPlan, isLoading: curriculumPlanLoading } = useQuery({
    queryKey: ["curriculum-plan-version"],
    queryFn: fetchActivePlanVersion,
    enabled: !!user,
  });

  const { data: curriculumSessions = [], isLoading: curriculumSessionsLoading } = useQuery({
    queryKey: ["curriculum-training-sessions", curriculumPlan?.id],
    queryFn: () => fetchTrainingSessions(curriculumPlan!.id),
    enabled: !!curriculumPlan?.id,
  });

  const handleGenerate = async () => {
    if (!titre.trim()) { toast.error("Saisissez un titre."); return; }
    if (heuresTotales <= 0) { toast.error("Indiquez le volume horaire."); return; }

    setGenerating(true);
    setGeneratedSeances(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-parcours", {
        body: { heuresTotales, niveauDepart, niveauCible, dureeSeanceMinutes: dureeSeance, type_demarche: typeDemarche, variante_plan: variante, groupId: groupId || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedSeances(data.seances || []);
      toast.success(`${data.seances?.length || 0} séances générées par l'IA !`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedSeances || generatedSeances.length === 0) return;
    setSaving(true);
    try {
      // Create parcours
      const { data: parcours, error: pErr } = await supabase
        .from("parcours")
        .insert({
          formateur_id: user!.id,
          group_id: groupId || null,
          titre,
          description,
          niveau_depart: niveauDepart,
          niveau_cible: niveauCible,
          heures_totales_prevues: heuresTotales,
          nb_seances_prevues: generatedSeances.length,
          is_template: isTemplate,
          statut: isTemplate ? "template" : "actif",
          type_demarche: typeDemarche,
          variante_plan: variante,
          date_examen_cible: dateExamenCible ? format(dateExamenCible, "yyyy-MM-dd") : null,
        } as any)
        .select()
        .single();
      if (pErr) throw pErr;

      // Create parcours_seances
      const seancesToInsert = generatedSeances.map((s, i) => ({
        parcours_id: parcours.id,
        ordre: i + 1,
        titre: s.titre,
        objectif_principal: s.objectif_principal,
        competences_cibles: s.competences_cibles,
        duree_minutes: s.duree_minutes,
        nb_exercices_suggeres: s.nb_exercices_suggeres,
        exercices_total: s.nb_exercices_suggeres,
        statut: "prevu",
      }));

      const { error: sErr } = await supabase
        .from("parcours_seances")
        .insert(seancesToInsert as any);
      if (sErr) throw sErr;

      qc.invalidateQueries({ queryKey: ["formateur-parcours"] });
      toast.success(isTemplate ? "Modèle sauvegardé !" : "Plan de formation créé !");
      resetForm();
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (parcoursId: string) => {
    try {
      // Fetch the parcours and its seances
      const { data: original } = await supabase
        .from("parcours")
        .select("*")
        .eq("id", parcoursId)
        .single();
      if (!original) throw new Error("Plan introuvable");

      const { data: seances } = await supabase
        .from("parcours_seances")
        .select("*")
        .eq("parcours_id", parcoursId)
        .order("ordre");

      // Create copy
      const { data: copy, error: cErr } = await supabase
        .from("parcours")
        .insert({
          formateur_id: user!.id,
          titre: `${(original as any).titre} (copie)`,
          description: (original as any).description,
          niveau_depart: (original as any).niveau_depart,
          niveau_cible: (original as any).niveau_cible,
          heures_totales_prevues: (original as any).heures_totales_prevues,
          nb_seances_prevues: (original as any).nb_seances_prevues,
          variante_plan: (original as any).variante_plan ?? "enrichi",
          is_template: false,
          statut: "brouillon",
        } as any)
        .select()
        .single();
      if (cErr) throw cErr;

      if (seances && seances.length > 0) {
        const copies = seances.map((s: any) => ({
          parcours_id: copy.id,
          ordre: s.ordre,
          titre: s.titre,
          objectif_principal: s.objectif_principal,
          competences_cibles: s.competences_cibles,
          duree_minutes: s.duree_minutes,
          nb_exercices_suggeres: s.nb_exercices_suggeres,
          exercices_total: s.exercices_total,
          statut: "prevu",
        }));
        await supabase.from("parcours_seances").insert(copies as any);
      }

      qc.invalidateQueries({ queryKey: ["formateur-parcours"] });
      toast.success("Plan dupliqué !");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleDelete = async (parcoursId: string) => {
    try {
      const { error } = await supabase.from("parcours").delete().eq("id", parcoursId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["formateur-parcours"] });
      toast.success("Plan supprimé.");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const openForm = (v?: VariantePlan) => {
    const variant = v ?? (selectedVariante !== "tous" && selectedVariante !== "curriculum-v2" ? selectedVariante : "enrichi");
    setVariante(variant);
    setHeuresTotales(VARIANTES[variant].heuresDefaut);
    setTypeDemarche(variant === "civique" ? "naturalisation" : "titre_sejour");
    setShowForm(true);
  };

  const changeFormVariante = (variant: VariantePlan) => {
    setVariante(variant);
    setHeuresTotales(VARIANTES[variant].heuresDefaut);
    setTypeDemarche(variant === "civique" ? "naturalisation" : "titre_sejour");
  };

  const resetForm = () => {
    setShowForm(false);
    setTitre("");
    setDescription("");
    setGroupId("");
    setNiveauDepart("A0");
    setNiveauCible("A1");
    setHeuresTotales(VARIANTES.enrichi.heuresDefaut);
    setDureeSeance(90);
    setIsTemplate(false);
    setVariante("enrichi");
    setTypeDemarche("titre_sejour");
    setDateExamenCible(undefined);
    setGeneratedSeances(null);
  };

  const statutBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    brouillon: { label: "Brouillon", variant: "outline" },
    actif: { label: "Actif", variant: "default" },
    template: { label: "Modèle", variant: "secondary" },
    termine: { label: "Terminé", variant: "outline" },
  };

  const totalGeneratedMinutes = generatedSeances?.reduce((sum, s) => sum + s.duree_minutes, 0) || 0;
  const totalGeneratedExercises = generatedSeances?.reduce((sum, s) => sum + s.nb_exercices_suggeres, 0) || 0;

  const allParcours = parcoursList || [];
  const varianteCounts: Record<VariantePlan, number> = {
    enrichi: allParcours.filter((p: any) => normalizeVariante(p.variante_plan) === "enrichi").length,
    civique: allParcours.filter((p: any) => normalizeVariante(p.variante_plan) === "civique").length,
  };
  const filteredParcours =
    selectedVariante === "tous" || selectedVariante === "curriculum-v2"
      ? allParcours
      : allParcours.filter((p: any) => normalizeVariante(p.variante_plan) === selectedVariante);

  const curriculumTotalMinutes = curriculumSessions.reduce(
    (sum, s) => sum + (s.duree_minutes ?? 0),
    0,
  );
  const showCurriculumPanel = selectedVariante === "curriculum-v2";
  const showParcoursList = selectedVariante !== "curriculum-v2";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Plans de formation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Créez et gérez vos plans de formation adaptatifs
          </p>
        </div>
        <Button onClick={() => openForm()} disabled={showForm}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau plan
        </Button>
      </div>

      {/* Variant selector: deux cohortes en parallèle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Variante de parcours
          </p>
          {selectedVariante !== "tous" && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedVariante("tous")}>
              Voir tous les parcours
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Sélectionnez la variante pour filtrer la liste et préparer un nouveau plan. Vous pouvez gérer les trois parcours en parallèle.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(VARIANTES) as VariantePlan[]).map((key) => {
            const v = VARIANTES[key];
            const active = selectedVariante === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedVariante(active ? "tous" : key)}
                className={cn(
                  "text-left rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && v.cardActiveClass,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {v.civique ? (
                      <Landmark className="h-5 w-5 text-amber-600 shrink-0" />
                    ) : (
                      <GraduationCap className="h-5 w-5 text-emerald-600 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold leading-tight">{v.label}</p>
                      <p className="text-xs text-muted-foreground">{v.tagline}</p>
                    </div>
                  </div>
                  {active && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{v.description}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge className={cn("text-[10px] gap-1", v.badgeClass)}>
                    {v.civique ? <Landmark className="h-3 w-3" /> : null}
                    {v.civique ? "Module civique inclus" : "Sans module civique"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {varianteCounts[key]} plan{varianteCounts[key] > 1 ? "s" : ""}
                  </Badge>
                </div>
              </button>
            );
          })}
          {(() => {
            const v = CURRICULUM_V2_CONFIG;
            const active = selectedVariante === "curriculum-v2";
            return (
              <button
                type="button"
                onClick={() => setSelectedVariante(active ? "tous" : "curriculum-v2")}
                className={cn(
                  "text-left rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && v.cardActiveClass,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="font-semibold leading-tight">{v.label}</p>
                      <p className="text-xs text-muted-foreground">{v.tagline}</p>
                    </div>
                  </div>
                  {active && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{v.description}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge className={cn("text-[10px] gap-1", v.badgeClass)}>
                    <Factory className="h-3 w-3" />
                    {curriculumPlan?.version ?? CURRICULUM_V2_VERSION}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {curriculumSessions.length || 41} séance{(curriculumSessions.length || 41) > 1 ? "s" : ""}
                  </Badge>
                </div>
              </button>
            );
          })()}
        </div>
      </div>

      {/* Curriculum v2 panel */}
      {showCurriculumPanel && (
        <Card className="border-blue-200 dark:border-blue-900/50">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Factory className="h-5 w-5 text-blue-600" />
                  {CURRICULUM_V2_CONFIG.label}
                </CardTitle>
                <CardDescription>
                  Référentiel {curriculumPlan?.version ?? CURRICULUM_V2_VERSION}
                  {curriculumPlan ? ` (${CURRICULUM_PLAN_VERSION_LABEL})` : ""}
                  {" · "}A2/CSP 80h + B1 + B2 cumulatif
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/formateur/production-parcours")} className="gap-2 shrink-0">
                <Factory className="h-4 w-4" />
                Ouvrir la production
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap pt-2">
              <Badge className={cn("text-[10px] gap-1", CURRICULUM_V2_CONFIG.badgeClass)}>
                {curriculumPlan?.version ?? CURRICULUM_V2_VERSION}
              </Badge>
              {curriculumTotalMinutes > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(curriculumTotalMinutes / 60)}h
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] gap-1">
                <BookOpen className="h-3 w-3" />
                {curriculumSessions.length} séances
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-3 border-t mt-3">
              <div className="space-y-1.5 flex-1 max-w-xs">
                <Label className="text-xs">Palier cible par défaut (variantes)</Label>
                <Select
                  value={curriculumPalierCible}
                  onValueChange={(v) => setCurriculumPalierCible(v as CurriculumPalier)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRICULUM_PALIERS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Distinct du n° de séance et du niveau actuel des élèves. Parcours cumulatif vers B2.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {curriculumPlanLoading || curriculumSessionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : curriculumSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune séance trouvée pour le plan actif. Vérifiez le déploiement du curriculum v2.
              </p>
            ) : (
              curriculumSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                >
                  <Badge
                    variant="outline"
                    className="font-mono text-xs shrink-0 bg-blue-50 dark:bg-blue-950/40 border-blue-200"
                  >
                    {s.code}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{s.titre}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{formatPalierParcoursLabel(s.palier)}</span>
                      <span>·</span>
                      <span>Séance n°{s.ordre}</span>
                      {s.duree_minutes != null && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {s.duree_minutes} min
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {SESSIONS_WITH_DOCUMENTS.has(s.code) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs shrink-0"
                      onClick={() => setDocumentsSessionCode(s.code)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Documents
                    </Button>
                  )}
                  <CurriculumPilotButton
                    trainingSession={s}
                    palierCible={curriculumPalierCible}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents de séance — MVP éditeur (S01 v3 uniquement pour l'instant) */}
      <Dialog open={documentsSessionCode !== null} onOpenChange={(open) => !open && setDocumentsSessionCode(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Documents de séance — {documentsSessionCode}
            </DialogTitle>
            <DialogDescription>
              Brouillons pédagogiques éditables directement dans l'application, distincts des ressources
              publiées par la pipeline de génération automatique.
            </DialogDescription>
          </DialogHeader>
          {documentsSessionCode && <SessionDocumentsPanel sessionCode={documentsSessionCode} />}
        </DialogContent>
      </Dialog>

      {/* Creation form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Créer un plan de formation</CardTitle>
            <CardDescription>
              Définissez le cadre global, puis laissez l'IA découper la progression
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Variante du parcours</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(VARIANTES) as VariantePlan[]).map((key) => {
                  const v = VARIANTES[key];
                  const active = variante === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => changeFormVariante(key)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-all hover:border-primary/40",
                        active && v.cardActiveClass,
                      )}
                    >
                      {v.civique ? (
                        <Landmark className="h-4 w-4 text-amber-600 shrink-0" />
                      ) : (
                        <GraduationCap className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">{v.label}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.civique ? "Module civique inclus" : "Sans module civique"}
                        </p>
                      </div>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titre du plan</Label>
                <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Préparation TCF A1 - Groupe Mars 2026" />
              </div>
              <div className="space-y-2">
                <Label>Groupe associé (optionnel)</Label>
                {groupsLoading ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger><SelectValue placeholder="Aucun (modèle)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun (modèle)</SelectItem>
                      {(groups || []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Niveau départ</Label>
                <Select value={niveauDepart} onValueChange={setNiveauDepart}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
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
              <div className="space-y-2">
                <Label>Heures totales</Label>
                <Input type="number" value={heuresTotales} onChange={(e) => setHeuresTotales(Number(e.target.value))} min={1} max={500} />
              </div>
              <div className="space-y-2">
                <Label>Durée séance (min)</Label>
                <Input type="number" value={dureeSeance} onChange={(e) => setDureeSeance(Number(e.target.value))} min={30} max={240} step={15} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notes, contexte, objectifs spécifiques..." className="min-h-[60px]" />
              </div>
              <div className="space-y-2">
                <Label>Type de démarche</Label>
                <Select value={typeDemarche} onValueChange={(v) => setTypeDemarche(v as "titre_sejour" | "naturalisation")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="titre_sejour">Titre de séjour / Résidence</SelectItem>
                    <SelectItem value="naturalisation">Naturalisation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date d'examen cible (optionnel)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full md:w-[280px] justify-start text-left font-normal",
                      !dateExamenCible && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateExamenCible ? format(dateExamenCible, "PPP", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateExamenCible}
                    onSelect={setDateExamenCible}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={isTemplate} onCheckedChange={setIsTemplate} />
              <Label className="text-sm">Sauvegarder comme modèle réutilisable</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating} className="flex-1">
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {generating ? "Génération IA..." : "Générer la progression"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated preview */}
      {generatedSeances && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{generatedSeances.length} séances générées</CardTitle>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(totalGeneratedMinutes / 60)}h{totalGeneratedMinutes % 60 > 0 ? `${totalGeneratedMinutes % 60}` : ""}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="h-3 w-3" />
                  {totalGeneratedExercises} exercices
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {generatedSeances.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() =>
                  navigate("/formateur/session-builder", {
                    state: {
                      titre: s.titre,
                      objectifs: s.objectif_principal,
                      competences_cibles: s.competences_cibles,
                      duree_minutes: s.duree_minutes,
                      niveau_cible: niveauCible,
                      source: "parcours",
                      groupId: groupId !== "none" ? groupId : undefined,
                    },
                  })
                }
              >
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.titre}</span>
                    <span className="text-xs text-muted-foreground">{s.duree_minutes} min</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{s.nb_exercices_suggeres} ex.</span>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Sparkles className="h-3 w-3" />
                      Ouvrir
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.objectif_principal}</p>
                  <div className="flex gap-1 flex-wrap">
                    {s.competences_cibles?.map((c) => (
                      <Badge key={c} className={`text-[10px] ${competenceColors[c] || ""}`}>{c}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <Button onClick={handleSave} disabled={saving} className="w-full mt-4" size="lg">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {isTemplate ? "Sauvegarder le modèle" : "Créer le plan de formation"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing parcours list */}
      {showParcoursList && (parcoursLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : allParcours.length === 0 && !showForm ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-lg font-semibold text-foreground">Aucun plan de formation créé</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Créez votre premier plan de formation adaptatif pour organiser la progression de vos groupes.
              </p>
            </div>
            <Button onClick={() => openForm()} size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau plan de formation
            </Button>
          </CardContent>
        </Card>
      ) : filteredParcours.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucun plan « {VARIANTES[selectedVariante as VariantePlan]?.shortLabel} » pour le moment.
            </p>
            <Button onClick={() => openForm()} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer ce parcours
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredParcours.map((p: any) => {
            const sb = statutBadge[p.statut] || statutBadge.brouillon;
            const pv = VARIANTES[normalizeVariante(p.variante_plan)];
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.titre}</span>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                        <Badge className={cn("text-[10px] gap-1", pv.badgeClass)}>
                          {pv.civique ? <Landmark className="h-3 w-3" /> : null}
                          {pv.shortLabel}
                        </Badge>
                        {p.is_template && <Badge variant="secondary" className="text-[10px]">📋 Modèle</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{p.niveau_depart} → {p.niveau_cible}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.heures_totales_prevues}h prévues</span>
                        <span>·</span>
                        <span>{p.nb_seances_prevues} séances</span>
                        {p.group?.nom && <><span>·</span><span>{p.group.nom}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/formateur/parcours/${p.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDuplicate(p.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ParcoursPage;
