import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Upload,
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  Target,
  CheckCircle2,
  ArrowLeft,
  FileText,
} from "lucide-react";

interface ParsedSession {
  titre: string;
  objectifs: string;
  competences_cibles: string[];
  duree_minutes: number;
  niveau_cible: string;
  date_suggestion: string | null;
  exercices_suggeres: string[];
}

const ImportProgramme = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [planText, setPlanText] = useState("");
  const [groupId, setGroupId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedSessions, setParsedSessions] = useState<ParsedSession[] | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["formateur-groups-import"],
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

  const handleAnalyze = async () => {
    if (!planText.trim()) {
      toast.error("Collez ou saisissez un plan de formation.");
      return;
    }
    if (!groupId) {
      toast.error("Sélectionnez un groupe cible.");
      return;
    }
    setAnalyzing(true);
    setParsedSessions(null);
    try {
      const { data, error } = await supabase.functions.invoke("parse-training-plan", {
        body: { planText, groupId, formateurId: user!.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setParsedSessions(data.sessions || []);
      toast.success(`${data.sessions?.length || 0} séance(s) détectée(s) !`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur d'analyse", { description: e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateAll = async () => {
    if (!parsedSessions || parsedSessions.length === 0) return;
    setCreating(true);
    try {
      const now = new Date();
      const sessionsToInsert = parsedSessions.map((s, i) => {
        const date = s.date_suggestion
          ? new Date(s.date_suggestion)
          : new Date(now.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000);

        return {
          titre: s.titre,
          objectifs: s.objectifs,
          group_id: groupId,
          niveau_cible: s.niveau_cible || "A1",
          duree_minutes: s.duree_minutes || 90,
          date_seance: date.toISOString(),
          statut: "planifiee" as const,
        };
      });

      const { error } = await supabase.from("sessions").insert(sessionsToInsert);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["formateur-sessions"] });
      toast.success(`${sessionsToInsert.length} séance(s) créée(s) avec succès !`);
      navigate("/formateur/seances");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur de création", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPlanText((ev.target?.result as string) || "");
      toast.success("Fichier chargé !");
    };
    reader.readAsText(file);
  };

  const competenceColors: Record<string, string> = {
    CO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    CE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    EE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    EO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Structures: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/formateur/seances")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importer un programme</h1>
          <p className="text-sm text-muted-foreground">
            Collez votre plan de formation et l'IA le transforme en séances
          </p>
        </div>
      </div>

      {/* Input section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Plan de formation
          </CardTitle>
          <CardDescription>
            Collez le texte brut, un tableau markdown, ou importez un fichier .txt/.md
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Groupe cible</label>
              {groupsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un groupe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups || []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nom} ({g.niveau})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Fichier</label>
              <Button variant="outline" asChild className="cursor-pointer">
                <label>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer
                  <input
                    type="file"
                    accept=".txt,.md,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </Button>
            </div>
          </div>

          <Textarea
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
            placeholder="Collez ici votre plan de formation généré par NotebookLM ou tout autre outil...&#10;&#10;Exemple :&#10;Séance 1 — Découverte CO/CE (A1) — 90 min&#10;Objectifs : Comprendre des annonces simples, lire un panneau&#10;&#10;Séance 2 — Structures de base (A1) — 90 min&#10;Objectifs : Articles définis, prépositions de lieu"
            className="min-h-[200px] font-mono text-sm"
          />

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || !planText.trim() || !groupId}
            className="w-full"
            size="lg"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {analyzing ? "Analyse en cours..." : "Analyser et créer les séances"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview of parsed sessions */}
      {parsedSessions && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {parsedSessions.length} séance(s) détectée(s)
            </h2>
            <Button onClick={handleCreateAll} disabled={creating || parsedSessions.length === 0}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {creating ? "Création..." : "Tout créer dans le calendrier"}
            </Button>
          </div>

          {parsedSessions.map((s, i) => (
            <Card
              key={i}
              className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/30"
              onClick={() =>
                navigate("/formateur/session-builder", {
                  state: {
                    titre: s.titre,
                    objectifs: s.objectifs,
                    competences_cibles: s.competences_cibles,
                    duree_minutes: s.duree_minutes,
                    niveau_cible: s.niveau_cible,
                    exercices_suggeres: s.exercices_suggeres,
                    source: "import",
                    groupId,
                  },
                })
              }
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{s.titre}</span>
                      <Badge variant="outline" className="text-xs">
                        {s.niveau_cible}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Sparkles className="h-3 w-3" />
                        Cliquez pour générer
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.objectifs}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {s.duree_minutes} min
                      </span>
                      {s.date_suggestion && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(s.date_suggestion).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {s.competences_cibles?.map((c) => (
                          <Badge key={c} className={`text-[10px] ${competenceColors[c] || ""}`}>
                            {c}
                          </Badge>
                        ))}
                      </span>
                    </div>
                    {s.exercices_suggeres && s.exercices_suggeres.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {s.exercices_suggeres.map((ex, j) => (
                          <Badge key={j} variant="secondary" className="text-[10px]">
                            {ex}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImportProgramme;
