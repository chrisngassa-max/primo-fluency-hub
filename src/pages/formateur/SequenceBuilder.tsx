import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSkillTree } from "@/hooks/useSkillTree";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseDraft {
  id: string;
  titre: string;
  consigne: string;
  format: string;
  difficulte: number;
  competence: string;
  contenu: any;
  isAiGenerated: boolean;
}

const SequenceBuilder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tree, isLoading: treeLoading } = useSkillTree();

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [niveauVise, setNiveauVise] = useState("A2");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI generation state — cascading selects
  const [selectedEpreuveId, setSelectedEpreuveId] = useState("");
  const [selectedSousSectionId, setSelectedSousSectionId] = useState("");
  const [selectedPointId, setSelectedPointId] = useState("");

  // Derived lists for cascading
  const selectedEpreuve = (tree ?? []).find((ep) => ep.id === selectedEpreuveId);
  const sousSectionsForEpreuve = selectedEpreuve?.sous_sections ?? [];
  const selectedSousSection = sousSectionsForEpreuve.find((ss) => ss.id === selectedSousSectionId);
  const pointsForSousSection = selectedSousSection?.points_a_maitriser ?? [];
  const selectedPoint = pointsForSousSection.find((p) => p.id === selectedPointId);

  // Manual add state
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitre, setManualTitre] = useState("");
  const [manualConsigne, setManualConsigne] = useState("");
  const [manualFormat, setManualFormat] = useState("qcm");
  const [manualCompetence, setManualCompetence] = useState("CE");


  const handleGenerate = async () => {
    if (!selectedPoint) {
      toast.error("Sélectionnez un point à maîtriser.");
      return;
    }
    const competence = selectedEpreuve?.competence ?? "";
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-exercises", {
        body: {
          pointName: selectedPoint.nom,
          competence,
          niveauVise,
          count: 10,
        },
      });
      if (error) throw error;
      const generated = (data?.exercises ?? []).map((ex: any, i: number) => ({
        id: `ai-${Date.now()}-${i}`,
        titre: ex.titre,
        consigne: ex.consigne,
        format: ex.format,
        difficulte: ex.difficulte,
        competence,
        contenu: ex.contenu,
        isAiGenerated: true,
      }));
      setExercises((prev) => [...prev, ...generated]);
      toast.success(`${generated.length} exercices générés par l'IA !`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de génération", { description: e.message || "Réessayez." });
    } finally {
      setGenerating(false);
    }
  };

  const handleAddManual = () => {
    if (!manualTitre || !manualConsigne) {
      toast.error("Remplissez le titre et la consigne.");
      return;
    }
    setExercises((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        titre: manualTitre,
        consigne: manualConsigne,
        format: manualFormat,
        difficulte: 3,
        competence: manualCompetence,
        contenu: { items: [] },
        isAiGenerated: false,
      },
    ]);
    setManualTitre("");
    setManualConsigne("");
    setManualOpen(false);
    toast.success("Exercice ajouté manuellement.");
  };

  const moveExercise = (index: number, direction: "up" | "down") => {
    const newList = [...exercises];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setExercises(newList);
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!titre) {
      toast.error("Donnez un titre à la séquence.");
      return;
    }
    if (exercises.length === 0) {
      toast.error("Ajoutez au moins un exercice.");
      return;
    }
    setSaving(true);
    try {
      // Create sequence
      const { data: seq, error: seqErr } = await supabase
        .from("sequences_pedagogiques")
        .insert({
          titre,
          description: description || null,
          niveau: niveauVise as any,
          formateur_id: user!.id,
          is_ai_generated: exercises.some((e) => e.isAiGenerated),
        })
        .select()
        .single();
      if (seqErr) throw seqErr;

      // Find a default point_a_maitriser_id
      const defaultPointId = selectedPointId || (tree ?? []).flatMap(ep => ep.sous_sections.flatMap(ss => ss.points_a_maitriser))[0]?.id;
      if (!defaultPointId) throw new Error("Aucun point à maîtriser trouvé.");

      // Create exercises linked to the sequence
      const exercisesToInsert = exercises.map((ex) => ({
        titre: ex.titre,
        consigne: ex.consigne,
        format: ex.format as any,
        difficulte: ex.difficulte,
        competence: ex.competence as any,
        contenu: ex.contenu,
        formateur_id: user!.id,
        sequence_id: seq.id,
        point_a_maitriser_id: defaultPointId,
        is_ai_generated: ex.isAiGenerated,
        niveau_vise: niveauVise as any,
      }));

      const { error: exErr } = await supabase.from("exercices").insert(exercisesToInsert);
      if (exErr) throw exErr;

      toast.success("Séquence créée avec succès !", {
        description: `${exercises.length} exercices enregistrés.`,
      });
      navigate("/formateur/seances");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de sauvegarde", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (treeLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle Séquence</h1>
          <p className="text-sm text-muted-foreground">
            Créez une séquence d'exercices hybride (IA + manuel)
          </p>
        </div>
      </div>

      {/* Sequence metadata */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seq-titre">Titre de la séquence</Label>
              <Input
                id="seq-titre"
                placeholder="Ex: Comprendre les documents administratifs"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seq-niveau">Niveau visé</Label>
              <Select value={niveauVise} onValueChange={setNiveauVise}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["A1", "A2", "B1", "B2", "C1"].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seq-desc">Description (optionnel)</Label>
            <Textarea
              id="seq-desc"
              placeholder="Objectifs de la séquence..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Generation tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI Generation */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Générer avec l'IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Point à maîtriser</Label>
              <Select value={selectedPointId} onValueChange={setSelectedPointId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un point..." />
                </SelectTrigger>
                <SelectContent>
                  {allPoints.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="text-xs text-muted-foreground mr-1">[{p.competence}]</span>
                      {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedPointId}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Générer 10 exercices
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Manual add */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Ajouter manuellement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un exercice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un exercice manuellement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input value={manualTitre} onChange={(e) => setManualTitre(e.target.value)} placeholder="Ex: Lire un prix au supermarché" />
                  </div>
                  <div className="space-y-2">
                    <Label>Consigne</Label>
                    <Textarea value={manualConsigne} onChange={(e) => setManualConsigne(e.target.value)} placeholder="Collez ici votre consigne..." rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Compétence</Label>
                      <Select value={manualCompetence} onValueChange={setManualCompetence}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["CO", "CE", "EE", "EO", "Structures"].map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select value={manualFormat} onValueChange={setManualFormat}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation", "production_ecrite", "production_orale"].map((f) => (
                            <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleAddManual} className="w-full">Ajouter</Button>
                </div>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground mt-3">
              Collez un texte ou une consigne trouvée à l'extérieur.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Exercise list */}
      {exercises.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Exercices ({exercises.length})</span>
              <Button onClick={handleSave} disabled={saving || !titre}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Enregistrer la séquence
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {exercises.map((ex, i) => (
              <div
                key={ex.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{ex.titre}</span>
                    <Badge variant="secondary" className="text-[10px]">{ex.competence}</Badge>
                    <Badge variant="outline" className="text-[10px]">{ex.format}</Badge>
                    {ex.isAiGenerated && (
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        <Sparkles className="h-3 w-3 mr-0.5" /> IA
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{ex.consigne}</p>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveExercise(i, "up")} disabled={i === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveExercise(i, "down")} disabled={i === exercises.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeExercise(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {exercises.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun exercice pour l'instant. Utilisez l'IA ou ajoutez-en manuellement.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SequenceBuilder;
