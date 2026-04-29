import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ItemResult {
  question: string;
  reponse_donnee?: string | number;
  reponse_eleve?: string | number;
  bonne_reponse: string | number;
  /** "exemple_attendu" pour les productions libres (IA) — change le libellé. */
  bonne_reponse_label?: "bonne_reponse" | "exemple_attendu";
  correct: boolean;
  explication?: string;
  ia_evaluated?: boolean;
}

interface Props {
  itemResults: ItemResult[] | Record<string, ItemResult>;
  scoreNormalized: number;
}

export default function CorrectionDetaillee({ itemResults, scoreNormalized }: Props) {
  const [showCorrect, setShowCorrect] = useState(false);

  const entries: ItemResult[] = Array.isArray(itemResults)
    ? itemResults
    : Object.values(itemResults);

  const wrongItems = entries.filter((r) => !r.correct);
  const correctItems = entries.filter((r) => r.correct);

  const emoji = scoreNormalized >= 80 ? "🎉" : scoreNormalized >= 60 ? "💪" : "📚";
  const feedbackMsg =
    scoreNormalized >= 80
      ? `Excellent ! Tu as réussi ${correctItems.length} questions sur ${entries.length}. 🎉`
      : scoreNormalized >= 60
        ? `Bien ! ${wrongItems.length} point${wrongItems.length > 1 ? "s" : ""} à revoir. Tu progresses ! 💪`
        : `Continue ! Regarde les corrections ci-dessous pour comprendre tes erreurs. 📚`;

  return (
    <div className="space-y-5">
      {/* Score visuel */}
      <Card className={cn(
        "text-center",
        scoreNormalized >= 80 ? "border-green-500/30" : scoreNormalized >= 60 ? "border-orange-500/30" : "border-destructive/30"
      )}>
        <CardContent className="pt-6 pb-4">
          <p className={cn(
            "text-5xl font-black",
            scoreNormalized >= 80 ? "text-green-600" : scoreNormalized >= 60 ? "text-orange-600" : "text-destructive"
          )}>
            {scoreNormalized}%
          </p>
          <p className="text-3xl mt-1">{emoji}</p>
          <p className="text-sm text-muted-foreground mt-2">{feedbackMsg}</p>
        </CardContent>
      </Card>

      {/* Erreurs — en premier */}
      {wrongItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-destructive flex items-center gap-2">
            ❌ À retravailler ({wrongItems.length})
          </h2>
          {wrongItems.map((r, idx) => {
            const answer = r.reponse_donnee ?? r.reponse_eleve ?? "—";
            return (
              <Card key={`wrong-${idx}`} className="border-l-4 border-l-destructive">
                <CardContent className="py-3 px-4 space-y-2">
                  <p className="text-sm font-medium">{r.question}</p>
                  <div className="space-y-1">
                    <p className="text-xs text-destructive">
                      Ta réponse : {String(answer)}
                    </p>
                    <p className="text-xs text-green-600 font-medium">
                      ✅ Bonne réponse : {String(r.bonne_reponse)}
                    </p>
                  </div>
                  {r.explication && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
                      <span>💡</span>
                      <span className="text-blue-800 dark:text-blue-300">{r.explication}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Réussites — repliées par défaut */}
      {correctItems.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCorrect(!showCorrect)}
            className="text-sm font-semibold uppercase tracking-wide text-green-600 flex items-center gap-2 hover:underline"
          >
            ✅ {correctItems.length} bonne{correctItems.length > 1 ? "s" : ""} réponse{correctItems.length > 1 ? "s" : ""} {showCorrect ? "▲" : "▼"}
          </button>
          {showCorrect && correctItems.map((r, idx) => (
            <Card key={`correct-${idx}`} className="border-l-4 border-l-green-500">
              <CardContent className="py-3 px-4">
                <p className="text-sm font-medium">{r.question}</p>
                <p className="text-xs text-green-600 mt-1">✅ {String(r.bonne_reponse)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
