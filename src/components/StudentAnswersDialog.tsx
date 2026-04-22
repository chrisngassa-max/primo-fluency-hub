import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import CorrectionDetaillee from "@/components/CorrectionDetaillee";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciceId: string;
  eleveId: string;
  eleveName: string;
  exerciceTitre?: string;
}

export default function StudentAnswersDialog({
  open,
  onOpenChange,
  exerciceId,
  eleveId,
  eleveName,
  exerciceTitre,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-answers", exerciceId, eleveId],
    queryFn: async () => {
      // 1) Tente d'abord exercise_attempts (le plus complet pour le live)
      const { data: attempt } = await supabase
        .from("exercise_attempts")
        .select("id, status, score_normalized, item_results, answers, completed_at, started_at")
        .eq("exercise_id", exerciceId)
        .eq("learner_id", eleveId)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      // 2) Et la version "résultat final" (correction détaillée riche)
      const { data: resultat } = await supabase
        .from("resultats")
        .select("id, score, correction_detaillee, reponses_eleve, created_at")
        .eq("exercice_id", exerciceId)
        .eq("eleve_id", eleveId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return { attempt, resultat };
    },
    enabled: open && !!exerciceId && !!eleveId,
  });

  // Privilégier la correction détaillée (resultats) pour l'affichage riche
  const corr = data?.resultat?.correction_detaillee as any;
  const itemResults = corr && (Array.isArray(corr) || typeof corr === "object")
    ? (Array.isArray(corr) ? corr : (corr.items ?? corr.itemResults ?? corr))
    : (data?.attempt?.item_results as any);

  const score = data?.resultat?.score != null
    ? Math.round(Number(data.resultat.score))
    : data?.attempt?.score_normalized != null
      ? Math.round(Number(data.attempt.score_normalized) * 100)
      : null;

  const status = data?.attempt?.status ?? (data?.resultat ? "completed" : "not_started");
  const hasItems = itemResults && (Array.isArray(itemResults) ? itemResults.length > 0 : Object.keys(itemResults).length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Réponses de {eleveName}</span>
            {score !== null && (
              <Badge variant="outline" className="font-bold">
                {score}%
              </Badge>
            )}
          </DialogTitle>
          {exerciceTitre && (
            <DialogDescription>{exerciceTitre}</DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : status === "not_started" ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              L'élève n'a pas encore commencé cet exercice.
            </p>
          ) : status === "in_progress" && !hasItems ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Exercice en cours — les réponses détaillées s'afficheront une fois la soumission validée.
            </p>
          ) : hasItems ? (
            <CorrectionDetaillee
              itemResults={itemResults}
              scoreNormalized={score ?? 0}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune réponse détaillée disponible.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
