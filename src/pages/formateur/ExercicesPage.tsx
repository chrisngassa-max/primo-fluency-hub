import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  BookOpen, Printer, Search, Eye, Volume2, Circle, Filter, Drama, Package, MessageCircle, Wand2,
  Pencil, Trash2, Plus, CirclePlus, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Save,
  Brain, FileText, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadge, mapDifficultyToScale10 } from "@/components/DifficultyBadge";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;
const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

const competenceColor: Record<string, string> = {
  CO: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  CE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  EE: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  EO: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Structures: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const ExercicesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filterCompetence, setFilterCompetence] = useState<string>("all");
  const [filterNiveau, setFilterNiveau] = useState<string>("all");
  const [filterSession, setFilterSession] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Reset filters when leaving the page
  useEffect(() => {
    return () => {
      setFilterCompetence("all");
      setFilterNiveau("all");
      setFilterSession("all");
      setSearchTerm("");
    };
  }, []);

  const hasActiveFilters = filterCompetence !== "all" || filterNiveau !== "all" || filterSession !== "all" || searchTerm !== "";

  const resetFilters = () => {
    setFilterCompetence("all");
    setFilterNiveau("all");
    setFilterSession("all");
    setSearchTerm("");
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewExercise, setPreviewExercise] = useState<any>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [animationGuide, setAnimationGuide] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ─── AI Generation State ───
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Theme dialog fields
  const [aiTheme, setAiTheme] = useState("");
  const [aiCompetence, setAiCompetence] = useState("");
  const [aiNiveau, setAiNiveau] = useState("");
  const [aiFormat, setAiFormat] = useState("");

  // Import dialog fields
  const [importText, setImportText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importTreatment, setImportTreatment] = useState<"extract" | "reconfigure">("extract");
  const [importTargetFormat, setImportTargetFormat] = useState("");

  const FORMATS_TCF = [
    { value: "qcm", label: "QCM" },
    { value: "vrai_faux", label: "Vrai / Faux" },
    { value: "texte_lacunaire", label: "Texte à trous" },
    { value: "appariement", label: "Appariement" },
    { value: "transformation", label: "Transformation de phrase" },
    { value: "production_ecrite", label: "Production libre" },
  ];

  const handleAiGenerate = async (mode: "theme" | "import") => {
    if (!user) return;
    setAiLoading(true);
    try {
      const payload: any = { mode };
      if (mode === "theme") {
        if (!aiTheme || !aiCompetence || !aiNiveau || !aiFormat) {
          toast.error("Veuillez remplir tous les champs");
          setAiLoading(false);
          return;
        }
        payload.theme = aiTheme;
        payload.competence = aiCompetence;
        payload.niveau = aiNiveau;
        payload.format = aiFormat;
      } else {
        const source = importText.trim() || importUrl.trim();
        if (!source) {
          toast.error("Veuillez fournir un texte ou une URL");
          setAiLoading(false);
          return;
        }
        payload.sourceText = source;
        payload.treatment = importTreatment;
        if (importTreatment === "reconfigure") {
          if (!importTargetFormat) {
            toast.error("Veuillez choisir un format cible");
            setAiLoading(false);
            return;
          }
          payload.targetFormat = importTargetFormat;
        }
      }

      const { data, error } = await supabase.functions.invoke("smart-exercise-generator", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const ex = data.exercise;
      if (!ex) throw new Error("Aucun exercice retourné par l'IA");

      // Find a default point_a_maitriser_id
      const { data: points } = await supabase.from("points_a_maitriser").select("id").limit(1);
      const pointId = points?.[0]?.id;
      if (!pointId) throw new Error("Aucun point à maîtriser trouvé en base");

      const { error: insertError } = await supabase.from("exercices").insert({
        formateur_id: user.id,
        titre: ex.titre,
        consigne: ex.consigne,
        competence: ex.competence || aiCompetence || "CE",
        format: ex.format || aiFormat || "qcm",
        difficulte: ex.difficulte || 3,
        niveau_vise: ex.niveau_vise || aiNiveau || "A1",
        contenu: ex.contenu || { items: [] },
        point_a_maitriser_id: pointId,
        is_ai_generated: true,
      });
      if (insertError) throw insertError;

      toast.success("Exercice créé par l'IA !");
      qc.invalidateQueries({ queryKey: ["formateur-all-exercices", user.id] });
      setThemeDialogOpen(false);
      setImportDialogOpen(false);
      // Reset fields
      setAiTheme(""); setAiCompetence(""); setAiNiveau(""); setAiFormat("");
      setImportText(""); setImportUrl(""); setImportTreatment("extract"); setImportTargetFormat("");
    } catch (e: any) {
      toast.error("Erreur génération IA", { description: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  // Fetch all exercises for this formateur
  const { data: exercices, isLoading } = useQuery({
    queryKey: ["formateur-all-exercices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, titre, consigne, competence, format, contenu, difficulte, niveau_vise, created_at, is_ai_generated, animation_guide")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Fetch session_exercices to know which exercise belongs to which session
  const { data: sessionExLinks } = useQuery({
    queryKey: ["formateur-session-exercice-links", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("exercice_id, session_id, session:sessions(id, titre, date_seance)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Build session list for filter
  const sessionOptions = useMemo(() => {
    if (!sessionExLinks) return [];
    const map = new Map<string, string>();
    sessionExLinks.forEach((link: any) => {
      const s = link.session;
      if (s && !map.has(s.id)) {
        map.set(s.id, s.titre || `Séance du ${new Date(s.date_seance).toLocaleDateString("fr-FR")}`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [sessionExLinks]);

  // Map exercise -> session ids
  const exerciseSessionMap = useMemo(() => {
    if (!sessionExLinks) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    sessionExLinks.forEach((link: any) => {
      const arr = m.get(link.exercice_id) || [];
      arr.push(link.session_id);
      m.set(link.exercice_id, arr);
    });
    return m;
  }, [sessionExLinks]);

  // Filter exercises
  const filtered = useMemo(() => {
    if (!exercices) return [];
    return exercices.filter((ex) => {
      if (filterCompetence !== "all" && ex.competence !== filterCompetence) return false;
      if (filterNiveau !== "all" && ex.niveau_vise !== filterNiveau) return false;
      if (filterSession !== "all") {
        const sessions = exerciseSessionMap.get(ex.id) || [];
        if (!sessions.includes(filterSession)) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!ex.titre.toLowerCase().includes(s) && !ex.consigne.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [exercices, filterCompetence, filterNiveau, filterSession, searchTerm, exerciseSessionMap]);

  // Group by competence
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    filtered.forEach((ex) => {
      const key = ex.competence || "Autre";
      if (!g[key]) g[key] = [];
      g[key].push(ex);
    });
    return g;
  }, [filtered]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e) => e.id)));
    }
  };

  // ─── Auto-save item to Supabase ───
  const autoSaveExercise = useCallback(async (exerciseId: string, updates: { titre?: string; consigne?: string; contenu?: any }) => {
    setSavingItemId(exerciseId);
    try {
      const { error } = await supabase
        .from("exercices")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", exerciseId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["formateur-all-exercices", user?.id] });
    } catch (e: any) {
      toast.error("Erreur de sauvegarde", { description: e.message });
    } finally {
      setSavingItemId(null);
    }
  }, [qc, user?.id]);

  // Debounced save
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedSave = useCallback((exerciseId: string, updates: { titre?: string; consigne?: string; contenu?: any }) => {
    if (saveTimerRef.current[exerciseId]) clearTimeout(saveTimerRef.current[exerciseId]);
    saveTimerRef.current[exerciseId] = setTimeout(() => {
      autoSaveExercise(exerciseId, updates);
    }, 800);
  }, [autoSaveExercise]);

  // Local edit state per exercise
  const [localEdits, setLocalEdits] = useState<Record<string, any>>({});

  const getEditableContenu = (ex: any) => {
    if (localEdits[ex.id]?.contenu) return localEdits[ex.id].contenu;
    const c = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
    return { items: Array.isArray((c as any).items) ? (c as any).items : [] };
  };

  const getEditableField = (ex: any, field: "titre" | "consigne") => {
    if (localEdits[ex.id]?.[field] !== undefined) return localEdits[ex.id][field];
    return ex[field] || "";
  };

  const updateLocalField = (exId: string, field: string, value: any, ex: any) => {
    setLocalEdits((prev) => ({
      ...prev,
      [exId]: { ...prev[exId], [field]: value },
    }));
    const updates: any = {};
    if (field === "titre" || field === "consigne") {
      updates[field] = value;
    } else if (field === "contenu") {
      updates.contenu = value;
    }
    debouncedSave(exId, updates);
  };

  const updateItemField = (exId: string, itemIdx: number, field: string, value: any, ex: any) => {
    const contenu = getEditableContenu(ex);
    const items = [...contenu.items];
    items[itemIdx] = { ...items[itemIdx], [field]: value };
    const newContenu = { items };
    updateLocalField(exId, "contenu", newContenu, ex);
  };

  const updateItemOption = (exId: string, itemIdx: number, optIdx: number, value: string, ex: any) => {
    const contenu = getEditableContenu(ex);
    const items = [...contenu.items];
    const options = [...(items[itemIdx].options || [])];
    options[optIdx] = value;
    items[itemIdx] = { ...items[itemIdx], options };
    const newContenu = { items };
    updateLocalField(exId, "contenu", newContenu, ex);
  };

  const setCorrectAnswer = (exId: string, itemIdx: number, optIdx: number, ex: any) => {
    const contenu = getEditableContenu(ex);
    const items = [...contenu.items];
    const options = items[itemIdx].options || [];
    items[itemIdx] = { ...items[itemIdx], bonne_reponse: options[optIdx] || "" };
    const newContenu = { items };
    updateLocalField(exId, "contenu", newContenu, ex);
  };

  const addItem = (exId: string, ex: any) => {
    const contenu = getEditableContenu(ex);
    const items = [...contenu.items, { question: "", options: ["", "", "", ""], bonne_reponse: "", explication: "" }];
    const newContenu = { items };
    updateLocalField(exId, "contenu", newContenu, ex);
  };

  const removeItem = (exId: string, itemIdx: number, ex: any) => {
    const contenu = getEditableContenu(ex);
    const items = [...contenu.items];
    items.splice(itemIdx, 1);
    const newContenu = { items };
    updateLocalField(exId, "contenu", newContenu, ex);
  };

  const addOption = (exId: string, itemIdx: number, ex: any) => {
    const contenu = getEditableContenu(ex);
    const items = [...contenu.items];
    const options = [...(items[itemIdx].options || []), ""];
    items[itemIdx] = { ...items[itemIdx], options };
    const newContenu = { items };
    updateLocalField(exId, "contenu", newContenu, ex);
  };

  const removeOption = (exId: string, itemIdx: number, optIdx: number, ex: any) => {
    const contenu = getEditableContenu(ex);
    const items = [...contenu.items];
    const options = [...(items[itemIdx].options || [])];
    options.splice(optIdx, 1);
    items[itemIdx] = { ...items[itemIdx], options };
    const newContenu = { items };
    updateLocalField(exId, "contenu", newContenu, ex);
  };

  // ─── Print ───
  const handlePrintSelection = () => {
    if (selected.size === 0) return;
    const selectedExercises = (exercices ?? []).filter((e) => selected.has(e.id));
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up bloqué. Autorisez les pop-ups."); return; }

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Exercices — CAP TCF</title>
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
@media print { body { padding: 0; } .exercise { border: 1px solid #ccc; } }
</style></head><body>
<h1>📝 Exercices sélectionnés — ${selectedExercises.length} exercice(s)</h1>
<p style="font-size:10pt;color:#666;">Imprimé le ${new Date().toLocaleDateString("fr-FR")} — CAP TCF</p>
${selectedExercises.map((ex, i) => {
  const contenu = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
  const items: any[] = Array.isArray((contenu as any).items) ? (contenu as any).items : [];
  return `<div class="exercise">
<h2>${i + 1}. ${ex.titre}</h2>
<div class="meta">${ex.competence} · ${ex.format?.replace(/_/g, " ")} · Niveau ${ex.niveau_vise} · Difficulté ${ex.difficulte}/5</div>
<div class="consigne">${ex.consigne}</div>
${items.map((item: any, qi: number) => `<div class="question">
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

  const handlePrintSingle = (ex: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Pop-up bloqué."); return; }
    const contenu = typeof ex.contenu === "object" && ex.contenu !== null ? ex.contenu : { items: [] };
    const items: any[] = Array.isArray((contenu as any).items) ? (contenu as any).items : [];
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${ex.titre} — CAP TCF</title>
<style>
body { font-family: 'Segoe UI', sans-serif; padding: 24px; font-size: 13pt; color: #222; }
h1 { font-size: 16pt; margin-bottom: 4px; }
.meta { font-size: 10pt; color: #666; margin-bottom: 12px; }
.consigne { font-style: italic; margin-bottom: 16px; }
.question { margin-bottom: 14px; }
.question p { font-weight: 600; margin-bottom: 6px; }
.option { padding: 4px 0 4px 20px; position: relative; }
.option::before { content: "☐"; position: absolute; left: 0; }
.write-zone { border: 1px dashed #aaa; height: 60px; border-radius: 4px; margin-top: 6px; }
</style></head><body>
<h1>${ex.titre}</h1>
<div class="meta">${ex.competence} · ${ex.format?.replace(/_/g, " ")} · Niveau ${ex.niveau_vise}</div>
<div class="consigne">${ex.consigne}</div>
${items.map((item: any, qi: number) => `<div class="question">
<p>Q${qi + 1}. ${item.question || ""}</p>
${Array.isArray(item.options) && item.options.length > 0
  ? item.options.map((o: string) => `<div class="option">${o}</div>`).join("")
  : '<div class="write-zone"></div>'}
</div>`).join("")}
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Exercices</h1>
          <p className="text-sm text-muted-foreground">
            {`${exercices?.length || 0} ${(exercices?.length || 0) === 1 ? "exercice" : "exercices"} au total · ${filtered.length} affiché${filtered.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-3">
          <Button size="lg" className="gap-2" onClick={() => setThemeDialogOpen(true)}>
            <Brain className="h-5 w-5" />
            🧠 Générer à partir d'un Thème
          </Button>
          <Button size="lg" variant="secondary" className="gap-2" onClick={() => setImportDialogOpen(true)}>
            <FileText className="h-5 w-5" />
            📄 Importer &amp; Transformer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Filtres</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 h-9" placeholder="Titre ou consigne…"
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Compétence</Label>
              <Select value={filterCompetence} onValueChange={setFilterCompetence}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {COMPETENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Niveau</Label>
              <Select value={filterNiveau} onValueChange={setFilterNiveau}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Séance</Label>
              <Select value={filterSession} onValueChange={setFilterSession}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {sessionOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex justify-end mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <Filter className="h-3 w-3" />
                Réinitialiser les filtres
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection bar */}
      <div className="flex items-center justify-between">
        <button onClick={toggleAll} className="text-xs text-primary hover:underline">
          {selected.size === filtered.length && filtered.length > 0 ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
        <span className="text-xs text-muted-foreground">{selected.size === 0 ? "Aucun sélectionné" : selected.size === 1 ? "1 sélectionné" : `${selected.size} sélectionnés`}</span>
      </div>

      {/* Exercise list grouped by competence */}
      {Object.keys(grouped).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun exercice trouvé</p>
            {hasActiveFilters ? (
              <>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Des filtres sont actifs — aucun exercice ne correspond à votre sélection.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-3 gap-1.5"
                >
                  <Filter className="h-3 w-3" />
                  Réinitialiser les filtres
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground/70 mt-1">
                Générez des exercices depuis une séance pour les voir apparaître ici.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([comp, exs]) => (
          <div key={comp} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs", competenceColor[comp] || "bg-muted text-muted-foreground")}>
                {comp}
              </Badge>
              <span className="text-xs text-muted-foreground">{exs.length === 1 ? "1 exercice" : `${exs.length} exercices`}</span>
            </div>
            <Accordion type="multiple" className="space-y-1">
              {exs.map((ex: any) => {
                const isSelected = selected.has(ex.id);
                const contenu = getEditableContenu(ex);
                const items: any[] = contenu.items;
                const isEditing = editingId === ex.id;
                const isSaving = savingItemId === ex.id;

                return (
                  <AccordionItem key={ex.id} value={ex.id} className={cn(
                    "border rounded-lg transition-all",
                    isSelected && "border-primary/40 bg-primary/5"
                  )}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggle(ex.id)} className="h-5 w-5" />
                      <AccordionTrigger className="flex-1 min-w-0 py-0 hover:no-underline">
                        <div className="flex items-center gap-2 flex-wrap text-left">
                          <h3 className="font-semibold text-sm">{getEditableField(ex, "titre")}</h3>
                          <Badge variant="outline" className="text-[10px]">{ex.format?.replace(/_/g, " ")}</Badge>
                          <Badge variant="secondary" className="text-[10px]">Niv. {ex.niveau_vise}</Badge>
                          <DifficultyBadge level={mapDifficultyToScale10(ex.difficulte)} />
                          <span className="text-[10px] text-muted-foreground">{items.length} Q</span>
                          {ex.is_ai_generated && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 px-2 py-0.5 text-[10px] font-semibold">
                              ✨ Généré par IA
                            </span>
                          )}
                          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        </div>
                      </AccordionTrigger>
                      <div className="flex gap-1 shrink-0">
                        {ex.animation_guide && (
                          <Button variant="outline" size="icon" className="h-8 w-8 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950"
                            onClick={(e) => { e.stopPropagation(); setAnimationGuide({ ...ex.animation_guide, titre: ex.titre }); }}>
                            <Drama className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setPreviewExercise(ex); setPreviewPage(0); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant={isEditing ? "default" : "outline"} size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setEditingId(isEditing ? null : ex.id); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); handlePrintSingle(ex); }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <AccordionContent className="px-4 pb-4 pt-0">
                      <div className="space-y-4 border-t pt-3">
                        {/* Editable title & consigne */}
                        {isEditing && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Titre</Label>
                              <Input value={getEditableField(ex, "titre")}
                                onChange={(e) => updateLocalField(ex.id, "titre", e.target.value, ex)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Consigne</Label>
                              <Textarea value={getEditableField(ex, "consigne")} rows={2}
                                onChange={(e) => updateLocalField(ex.id, "consigne", e.target.value, ex)} />
                            </div>
                          </div>
                        )}
                        {!isEditing && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Consigne</p>
                            <p className="text-sm">{getEditableField(ex, "consigne")}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div><span className="text-muted-foreground">Niveau</span><p className="font-medium">{ex.niveau_vise}</p></div>
                          <div><span className="text-muted-foreground">Difficulté</span><p className="font-medium">{ex.difficulte}/5</p></div>
                          <div><span className="text-muted-foreground">Questions</span><p className="font-medium">{items.length}</p></div>
                        </div>

                        {/* ─── Full item list (editable or readonly) ─── */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {isEditing ? "Édition des items" : "Tous les items"} ({items.length})
                            </p>
                            {isEditing && (
                              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                                onClick={() => addItem(ex.id, ex)}>
                                <CirclePlus className="h-3 w-3" />Ajouter un item
                              </Button>
                            )}
                          </div>

                          {items.map((item: any, idx: number) => (
                            <Card key={idx} className={cn("p-3", isEditing ? "space-y-3" : "space-y-2")}>
                              {isEditing ? (
                                /* ─── EDIT MODE ─── */
                                <div className="space-y-3">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-bold text-primary mt-2 shrink-0">Q{idx + 1}</span>
                                    <Input className="flex-1" placeholder="Énoncé de la question" value={item.question || ""}
                                      onChange={(e) => updateItemField(ex.id, idx, "question", e.target.value, ex)} />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                      onClick={() => removeItem(ex.id, idx, ex)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>

                                  {Array.isArray(item.options) && (
                                    <div className="space-y-1.5 ml-6">
                                      <span className="text-[11px] text-muted-foreground font-medium">Choix de réponse — cochez la bonne réponse</span>
                                      {item.options.map((opt: string, oi: number) => {
                                        const isCorrect = item.bonne_reponse === opt && opt !== "";
                                        const letter = String.fromCharCode(65 + oi);
                                        return (
                                          <div key={oi} className={cn(
                                            "flex items-center gap-2 p-1.5 rounded-md border transition-colors",
                                            isCorrect ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/30" : "border-border"
                                          )}>
                                            <Checkbox
                                              checked={isCorrect}
                                              onCheckedChange={() => setCorrectAnswer(ex.id, idx, oi, ex)}
                                              className="h-4 w-4"
                                            />
                                            <span className="text-xs font-bold text-muted-foreground w-4">{letter}</span>
                                            <Input className="h-8 text-xs flex-1" value={opt}
                                              onChange={(e) => updateItemOption(ex.id, idx, oi, e.target.value, ex)} />
                                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                                              onClick={() => removeOption(ex.id, idx, oi, ex)}>
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          </div>
                                        );
                                      })}
                                      <Button variant="ghost" size="sm" className="text-xs gap-1 h-7"
                                        onClick={() => addOption(ex.id, idx, ex)}>
                                        <Plus className="h-3 w-3" />Ajouter un choix
                                      </Button>
                                    </div>
                                  )}

                                  <div className="ml-6">
                                    <span className="text-[11px] text-muted-foreground font-medium">Explication (correction)</span>
                                    <Input className="h-8 text-xs mt-1" value={item.explication || ""}
                                      onChange={(e) => updateItemField(ex.id, idx, "explication", e.target.value, ex)} />
                                  </div>
                                </div>
                              ) : (
                                /* ─── READ MODE ─── */
                                <div>
                                  <p className="text-sm">
                                    <span className="font-bold text-primary mr-2">Q{idx + 1}.</span>
                                    {item.question}
                                  </p>
                                  {Array.isArray(item.options) && item.options.length > 0 && (
                                    <div className="mt-2 space-y-1 ml-6">
                                      {item.options.map((opt: string, oi: number) => {
                                        const isCorrect = item.bonne_reponse === opt && opt !== "";
                                        const letter = String.fromCharCode(65 + oi);
                                        return (
                                          <div key={oi} className={cn(
                                            "flex items-center gap-2 text-xs p-1.5 rounded-md border",
                                            isCorrect ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/30 font-semibold" : "border-border"
                                          )}>
                                            <span className="font-bold text-muted-foreground w-4">{letter}</span>
                                            <span className="flex-1">{opt}</span>
                                            {isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Card>
                          ))}

                          {items.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Aucune question.{isEditing && " Cliquez « Ajouter un item » pour commencer."}
                            </p>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))
      )}

      {/* Floating print button */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button size="lg" onClick={handlePrintSelection} className="gap-2 shadow-lg">
            <Printer className="h-5 w-5" />
            Imprimer la sélection ({selected.size})
          </Button>
        </div>
      )}

      {/* ─── Preview Dialog with navigation ─── */}
      <Dialog open={!!previewExercise} onOpenChange={(open) => { if (!open) setPreviewExercise(null); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Aperçu Élève — {previewExercise?.titre}
            </DialogTitle>
            <DialogDescription>Exercice tel que l'élève le verra.</DialogDescription>
          </DialogHeader>
          {previewExercise && (() => {
            const pc = getEditableContenu(previewExercise);
            const pitems: any[] = pc.items;
            const totalPages = pitems.length;
            const currentItem = pitems[previewPage];

            return (
              <div className="space-y-5 pt-2">
                <Card><CardHeader className="pb-2">
                  <CardTitle className="text-base">Consigne</CardTitle>
                  <p className="text-sm text-muted-foreground">{getEditableField(previewExercise, "consigne")}</p>
                </CardHeader></Card>
                <div className="flex gap-2 flex-wrap">
                  <Badge>{previewExercise.competence}</Badge>
                  <Badge variant="outline">{previewExercise.format?.replace(/_/g, " ")}</Badge>
                  <Badge variant="secondary">Niveau {previewExercise.niveau_vise}</Badge>
                </div>

                {totalPages > 0 ? (
                  <>
                    {/* Navigation header */}
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

                    {/* Current question */}
                    {currentItem && (
                      <Card>
                        <CardContent className="pt-4 space-y-3">
                          <p className="font-medium text-sm">
                            <span className="text-primary font-bold mr-2">Q{previewPage + 1}.</span>{currentItem.question}
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
                                  <RadioGroupItem value={opt} id={`pv-q${previewPage}-o${oi}`} disabled />
                                  <Label htmlFor={`pv-q${previewPage}-o${oi}`} className="cursor-default flex-1 text-sm">{opt}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          ) : (
                            <div className="border rounded-md p-3 bg-muted/20 text-sm text-muted-foreground italic">
                              Zone de saisie libre
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
                  <div className="text-center py-8 text-muted-foreground text-sm">Aucune question.</div>
                )}

                <Button variant="outline" className="w-full" disabled>Soumettre mes réponses</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Animation Guide Dialog ─── */}
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
                {[
                  { icon: Drama, label: "Scénario", value: animationGuide.scenario },
                  { icon: Wand2, label: "Jeu pédagogique", value: animationGuide.jeu },
                  { icon: Package, label: "Matériel à préparer", value: animationGuide.materiel },
                  { icon: MessageCircle, label: "Objectif oral", value: animationGuide.objectif_oral, italic: true },
                ].map(({ icon: Icon, label, value, italic }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/60 shrink-0">
                      <Icon className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">{label}</p>
                      <p className={cn("text-sm mt-1", italic && "font-medium italic")}>{italic ? `« ${value} »` : value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Theme Generation Dialog ─── */}
      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>🧠 Générer à partir d'un Thème</DialogTitle>
            <DialogDescription>L'IA va créer un exercice complet ancré dans un contexte IRN.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Thème précis</Label>
              <Input placeholder="ex : la boulangerie, la CAF, le médecin…" value={aiTheme} onChange={(e) => setAiTheme(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Item TCF (compétence)</Label>
              <Select value={aiCompetence} onValueChange={setAiCompetence}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {COMPETENCES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Niveau de difficulté</Label>
              <Select value={aiNiveau} onValueChange={setAiNiveau}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {["A1", "A2", "B1", "B2", "C1"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Format d'exercice</Label>
              <Select value={aiFormat} onValueChange={setAiFormat}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {FORMATS_TCF.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gap-2" disabled={aiLoading} onClick={() => handleAiGenerate("theme")}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {aiLoading ? "Génération en cours…" : "Créer l'exercice"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Import & Transform Dialog ─── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>📄 Importer &amp; Transformer</DialogTitle>
            <DialogDescription>Collez un texte ou une URL, et l'IA en fera un exercice TCF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Texte source (copier/coller)</Label>
              <Textarea placeholder="Collez ici un texte, un exercice existant, un extrait de document…" rows={5} value={importText} onChange={(e) => setImportText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ou URL de page web</Label>
              <Input placeholder="https://…" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Traitement par l'IA</Label>
              <RadioGroup value={importTreatment} onValueChange={(v) => setImportTreatment(v as "extract" | "reconfigure")} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="extract" id="treat-extract" />
                  <Label htmlFor="treat-extract" className="font-normal">Extraire l'exercice tel quel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reconfigure" id="treat-reconfig" />
                  <Label htmlFor="treat-reconfig" className="font-normal">Reconfigurer au format…</Label>
                </div>
              </RadioGroup>
            </div>
            {importTreatment === "reconfigure" && (
              <div className="space-y-1.5">
                <Label>Format cible</Label>
                <Select value={importTargetFormat} onValueChange={setImportTargetFormat}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {FORMATS_TCF.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full gap-2" disabled={aiLoading} onClick={() => handleAiGenerate("import")}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {aiLoading ? "Transformation en cours…" : "Lancer la transformation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExercicesPage;
