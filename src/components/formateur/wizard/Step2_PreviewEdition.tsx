import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ArrowLeft, ArrowRight } from "lucide-react";
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
