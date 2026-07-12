import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FlaskConical, Layers3, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ExerciseStudentPreviewDialog, { type PreviewExercise } from "@/components/ExerciseStudentPreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Level = "Tous" | "A1" | "A2" | "B1" | "B2";
type InteractiveExercise = PreviewExercise & {
  id: string;
  metadata_code: string | null;
  difficulte: number;
  duree_limite_secondes: number | null;
};

const LEVELS: Level[] = ["Tous", "A1", "A2", "B1", "B2"];

export default function S01InteractiveExercises() {
  const navigate = useNavigate();
  const [level, setLevel] = useState<Level>("Tous");
  const [selected, setSelected] = useState<InteractiveExercise | null>(null);
  const [testedIds, setTestedIds] = useState<Set<string>>(new Set());

  const { data: exercises = [], isLoading, error } = useQuery({
    queryKey: ["learner-s01-v3-interactive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, metadata_code, titre, consigne, competence, format, niveau_vise, difficulte, duree_limite_secondes, contenu, created_at")
        .like("metadata_code", "cv2:S01:v3:%")
        .eq("statut", "published")
        .eq("is_live_ready", true)
        .order("niveau_vise")
        .order("metadata_code");
      if (error) throw error;
      return (data ?? []) as InteractiveExercise[];
    },
  });

  const visible = level === "Tous" ? exercises : exercises.filter((exercise) => exercise.niveau_vise === level);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" className="mt-1 gap-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Layers3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-extrabold text-[#0b234a]">Exercices interactifs — Séance 1 v3</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Teste les activités comme un apprenant. Ce mode d’essai n’ajoute pas de résultat à ta progression.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="font-semibold text-blue-900 dark:text-blue-200">
          {exercises.length} exercices interactifs disponibles
        </p>
        <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-300/80">
          Le QCM civique en révision n’apparaît pas ici.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LEVELS.map((candidate) => (
          <Button
            key={candidate}
            size="sm"
            variant={level === candidate ? "default" : "outline"}
            className={level === candidate ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setLevel(candidate)}
          >
            {candidate}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : error ? (
        <Card><CardContent className="p-5 text-sm text-destructive">Impossible de charger les exercices interactifs.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((exercise, index) => (
            <Card key={exercise.id} className="border-blue-100 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Activité {index + 1} sur {visible.length}
                  </p>
                  <p className="font-semibold">{exercise.titre}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{exercise.niveau_vise}</Badge>
                    <Badge variant="outline">{exercise.competence}</Badge>
                    <Badge variant="secondary">{exercise.format?.replace(/_/g, " ")}</Badge>
                    {testedIds.has(exercise.id) && <Badge className="bg-green-600">Testé</Badge>}
                  </div>
                </div>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setSelected(exercise)}>
                  <FlaskConical className="h-4 w-4" /> Tester
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ExerciseStudentPreviewDialog
        open={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        exercise={selected}
        interactive
        onTestComplete={() => {
          if (selected) setTestedIds((current) => new Set(current).add(selected.id));
        }}
      />
    </div>
  );
}
