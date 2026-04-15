import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ArrowLeft, ArrowRight, BookOpen, AlertTriangle, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import ExerciseEditor from "../ExerciseEditor";
import type { WizardState, ExerciceDraft } from "../types";

interface Props {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
  onRegenerateAll: () => void;
  onRegenerateOne: (index: number) => void;
  onReformulateItem: (exIndex: number, itemIndex: number, instruction?: string) => void;
  onBack: () => void;
  onNext: () => void;
  regeneratingIndex: number | null;
  reformulatingKey: { exIndex: number; itemIndex: number } | null;
}

const REASON_LABELS: Record<string, string> = {
  competence_exacte: "Compétence exacte",
  competence_categorie: "Compétence via catégorie",
  competence_generique: "Générique",
  competence_differente: "Compétence différente",
  niveau_proche: "Niveau proche",
  niveau_acceptable: "Niveau acceptable",
  niveau_eloigne: "Niveau éloigné",
  theme_match: "Thème correspondant",
  objectif_present: "Objectif défini",
  consigne_exploitable: "Consigne exploitable",
};

const Step2_PreviewEdition = ({
  state,
  onChange,
  onRegenerateAll,
  onRegenerateOne,
  onReformulateItem,
  onBack,
  onNext,
  regeneratingIndex,
  reformulatingKey,
}: Props) => {
  const updateExercise = (index: number, updated: ExerciceDraft) => {
    const generated = [...state.generated];
    generated[index] = updated;
    onChange({ generated });
  };

  const deleteExercise = (index: number) => {
    const generated = [...state.generated];
    generated.splice(index, 1);
    onChange({ generated });
  };

  const refs = state.referencesUtilisees || [];
  const warnings = state.pedagogicalWarnings || [];
  const meta = state.selectionMetadata;
  const scores = state.referenceScores || [];

  // Compute average level of references
  const avgLevel = (() => {
    const levels = refs.map(r => r.level_min).filter(Boolean) as string[];
    if (levels.length === 0) return null;
    const order = ["A0", "A1", "A2", "B1", "B2"];
    const avg = levels.reduce((s, l) => s + order.indexOf(l), 0) / levels.length;
    return order[Math.round(avg)] || null;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-medium">
          L'IA a généré {state.generated.length} exercice(s). Vérifie et modifie si besoin.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerateAll}
          disabled={state.loadingGenerate}
          className="gap-1"
        >
          {state.loadingGenerate ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Tout régénérer
        </Button>
      </div>

      {/* Pedagogical warnings */}
      {warnings.length > 0 && (
        <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 space-y-1">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-medium text-sm">
            <AlertTriangle className="h-4 w-4" />
            Avertissement{warnings.length > 1 ? "s" : ""} pédagogique{warnings.length > 1 ? "s" : ""}
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-orange-600 dark:text-orange-300">{w}</p>
          ))}
        </div>
      )}

      {/* References summary + details */}
      {refs.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground w-full justify-start">
              <BookOpen className="h-4 w-4" />
              <span>
                {refs.length} référence{refs.length > 1 ? "s" : ""} pédagogique{refs.length > 1 ? "s" : ""}
                {avgLevel && <span className="ml-1 text-xs">(niveau moyen : {avgLevel})</span>}
                {meta && <span className="ml-1 text-xs text-muted-foreground">— {meta.nb_candidates} candidat{meta.nb_candidates > 1 ? "s" : ""} évalué{meta.nb_candidates > 1 ? "s" : ""}</span>}
              </span>
              <ChevronDown className="h-3 w-3 ml-auto transition-transform" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-md border bg-muted/30 p-3 mt-1 space-y-2 max-h-60 overflow-y-auto">
              {refs.map((ref, i) => {
                const refScore = scores.find(s => s.id === ref.id);
                return (
                  <div key={ref.id || i} className="text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ref.title}</span>
                      {refScore && (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {refScore.score}pts
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ref.category && <Badge variant="outline" className="text-xs">{ref.category}</Badge>}
                      {(ref.level_min || ref.level_max) && (
                        <Badge variant="outline" className="text-xs">
                          {ref.level_min || "?"} → {ref.level_max || "?"}
                        </Badge>
                      )}
                    </div>
                    {ref.objective && <p className="text-xs text-muted-foreground mt-0.5">{ref.objective}</p>}
                    {refScore && refScore.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {refScore.reasons.slice(0, 3).map((r, ri) => (
                          <span key={ri} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {REASON_LABELS[r] || r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {state.generated.map((ex, i) => (
          <ExerciseEditor
            key={i}
            exercice={ex}
            index={i}
            onChange={(updated) => updateExercise(i, updated)}
            onRegenerate={() => onRegenerateOne(i)}
            onDelete={() => deleteExercise(i)}
            onReformulateItem={(itemIndex, instruction) => onReformulateItem(i, itemIndex, instruction)}
            reformulatingIndex={reformulatingKey?.exIndex === i ? reformulatingKey.itemIndex : null}
            regenerating={regeneratingIndex === i}
          />
        ))}
      </div>

      {state.generated.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Tous les exercices ont été supprimés. Reviens à l'étape 1 pour en générer de nouveaux.
        </p>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" size="lg" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Button size="lg" onClick={onNext} disabled={state.generated.length === 0} className="gap-1">
          Continuer <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Step2_PreviewEdition;
