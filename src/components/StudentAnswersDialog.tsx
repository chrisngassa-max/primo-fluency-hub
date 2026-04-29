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
import { CheckCircle2, Circle, Headphones, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciceId: string;
  eleveId: string;
  eleveName: string;
  exerciceTitre?: string;
}

interface ExerciceItem {
  question?: string;
  enonce?: string;
  consigne?: string;
  options?: string[];
  bonne_reponse?: string;
  explication?: string;
  [k: string]: unknown;
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
      // 0) Le contenu de l'exercice (questions, options, script audio…)
      const { data: exercice } = await supabase
        .from("exercices")
        .select("id, titre, consigne, format, competence, contenu")
        .eq("id", exerciceId)
        .maybeSingle();

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

      return { exercice, attempt, resultat };
    },
    enabled: open && !!exerciceId && !!eleveId,
    refetchInterval: open ? 3000 : false, // suivi quasi temps réel pendant in_progress
  });

  // Privilégier la correction détaillée (resultats) pour l'affichage final
  const corr = data?.resultat?.correction_detaillee as any;
  const itemResults =
    corr && (Array.isArray(corr) || typeof corr === "object")
      ? Array.isArray(corr)
        ? corr
        : corr.items ?? corr.itemResults ?? corr
      : (data?.attempt?.item_results as any);

  const score =
    data?.resultat?.score != null
      ? Math.round(Number(data.resultat.score))
      : data?.attempt?.score_normalized != null
        ? Math.round(Number(data.attempt.score_normalized) * 100)
        : null;

  const status = data?.attempt?.status ?? (data?.resultat ? "completed" : "not_started");
  const hasFinalItems =
    itemResults && (Array.isArray(itemResults) ? itemResults.length > 0 : Object.keys(itemResults).length > 0);

  // Contenu live = items de l'exercice + réponses en cours
  const contenu = (data?.exercice?.contenu ?? {}) as Record<string, unknown>;
  const items = (contenu.items as ExerciceItem[] | undefined) ?? [];
  const scriptAudio = contenu.script_audio as string | undefined;
  const texteSupport = contenu.texte as string | undefined;
  const liveAnswers =
    (data?.attempt?.answers as Record<string | number, string> | null | undefined) ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Réponses de {eleveName}</span>
            {score !== null && status === "completed" && (
              <Badge variant="outline" className="font-bold">
                {score}%
              </Badge>
            )}
            {status === "in_progress" && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                En cours
              </Badge>
            )}
          </DialogTitle>
          {exerciceTitre && <DialogDescription>{exerciceTitre}</DialogDescription>}
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
          ) : status === "completed" && hasFinalItems ? (
            <CorrectionDetaillee itemResults={itemResults} scoreNormalized={score ?? 0} />
          ) : items.length > 0 ? (
            // Vue LIVE : on affiche le contenu de l'exercice item par item avec la réponse en cours
            <div className="space-y-4">
              {(scriptAudio || texteSupport) && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  {scriptAudio && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Headphones className="h-3.5 w-3.5" /> Script audio (CO)
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{scriptAudio}</p>
                    </div>
                  )}
                  {texteSupport && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" /> Texte support
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{texteSupport}</p>
                    </div>
                  )}
                </div>
              )}

              {items.map((item, idx) => {
                const userAnswer = liveAnswers[idx] ?? liveAnswers[String(idx)];
                const answered = userAnswer !== undefined && userAnswer !== "";
                const intitule = item.question ?? item.enonce ?? item.consigne ?? `Question ${idx + 1}`;
                return (
                  <div key={idx} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      {answered ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Question {idx + 1}
                        </p>
                        <p className="text-sm font-medium whitespace-pre-wrap">{intitule}</p>
                      </div>
                    </div>

                    {item.options && item.options.length > 0 && (
                      <ul className="ml-6 space-y-1">
                        {item.options.map((opt, oi) => {
                          const isPicked = answered && String(userAnswer) === String(opt);
                          return (
                            <li
                              key={oi}
                              className={`text-sm rounded px-2 py-1 border ${
                                isPicked
                                  ? "bg-blue-500/10 border-blue-500/40 font-medium"
                                  : "border-transparent text-muted-foreground"
                              }`}
                            >
                              {String.fromCharCode(65 + oi)}. {opt}
                              {isPicked && (
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-600">
                                  choisi
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {(!item.options || item.options.length === 0) && (
                      <div className="ml-6">
                        {answered ? (
                          <p className="text-sm bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1 whitespace-pre-wrap">
                            {String(userAnswer)}
                          </p>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">— pas encore répondu —</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune donnée disponible pour cet exercice.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
