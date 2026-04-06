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
} from "lucide-react";

const NIVEAUX = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

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

  const handleGenerate = async () => {
    if (!titre.trim()) { toast.error("Saisissez un titre."); return; }
    if (heuresTotales <= 0) { toast.error("Indiquez le volume horaire."); return; }

    setGenerating(true);
    setGeneratedSeances(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-parcours", {
        body: { heuresTotales, niveauDepart, niveauCible, dureeSeanceMinutes: dureeSeance, type_demarche: typeDemarche },
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

  const resetForm = () => {
    setShowForm(false);
    setTitre("");
    setDescription("");
    setGroupId("");
    setNiveauDepart("A0");
    setNiveauCible("A1");
    setHeuresTotales(50);
    setDureeSeance(90);
    setIsTemplate(false);
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
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau plan
        </Button>
      </div>

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
      {parcoursLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (parcoursList || []).length === 0 && !showForm ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-lg font-semibold text-foreground">Aucun plan de formation créé</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Créez votre premier plan de formation adaptatif pour organiser la progression de vos groupes.
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau plan de formation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(parcoursList || []).map((p: any) => {
            const sb = statutBadge[p.statut] || statutBadge.brouillon;
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.titre}</span>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                        {p.is_template && <Badge variant="secondary" className="text-[10px]">📋 Modèle</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{p.niveau_depart} → {p.niveau_cible}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.heures_totales_prevues}h prévues</span>
                        <span>·</span>
                        <span>{p.nb_seances_prevues} séances</span>
                        {p.group?.nom && <><span>·</span><span>{p.group.nom}</span></>}\\
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
      )}
    </div>
  );
};

export default ParcoursPage;
