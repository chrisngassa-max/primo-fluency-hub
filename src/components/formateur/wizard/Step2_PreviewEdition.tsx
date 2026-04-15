import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
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

      {refs.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground w-full justify-start">
              <BookOpen className="h-4 w-4" />
              {refs.length} référence(s) pédagogique(s) utilisée(s)
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-md border bg-muted/30 p-3 mt-1 space-y-2">
              {refs.map((ref, i) => (
                <div key={ref.id || i} className="text-sm">
                  <span className="font-medium">{ref.title}</span>
                  {ref.category && <Badge variant="outline" className="ml-2 text-xs">{ref.category}</Badge>}
                  {ref.objective && <p className="text-xs text-muted-foreground mt-0.5">{ref.objective}</p>}
                  {(ref.level_min || ref.level_max) && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({ref.level_min || "?"} → {ref.level_max || "?"})
                    </span>
                  )}
                </div>
              ))}
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
