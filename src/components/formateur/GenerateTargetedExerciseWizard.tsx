import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Step1_ChoixParametres from "./wizard/Step1_ChoixParametres";
import Step2_PreviewEdition from "./wizard/Step2_PreviewEdition";
import Step3_Assignation from "./wizard/Step3_Assignation";
import type { WizardState, ExerciceDraft } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const initialState: WizardState = {
  step: 1,
  themePredefini: "",
  themePersonnalise: "",
  competence: "CE",
  count: 2,
  niveau: "A1",
  difficulte: 4,
  generated: [],
  referencesUtilisees: [],
  loadingGenerate: false,
  elevesSelected: [],
  creerCommeDevoir: true,
  loadingPublish: false,
};

const GenerateTargetedExerciseWizard = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user } = useAuth();
  const [state, setState] = useState<WizardState>({ ...initialState });
  const [confirmClose, setConfirmClose] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [reformulatingKey, setReformulatingKey] = useState<{ exIndex: number; itemIndex: number } | null>(null);

  const update = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const theme = state.themePredefini || state.themePersonnalise.trim();

  const handleGenerate = async (count?: number) => {
    if (!user || !theme) return;
    update({ loadingGenerate: true });
    try {
      const { data, error } = await supabase.functions.invoke("generate-exercises", {
        body: {
          pointName: theme,
          competence: state.competence,
          niveauVise: state.niveau,
          count: count ?? state.count,
          difficultyLevel: state.difficulte,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const exercises: ExerciceDraft[] = (data.exercises || []).map((ex: any) => ({
        titre: ex.titre || "",
        consigne: ex.consigne || "",
        format: ex.format || "qcm",
        competence: state.competence,
        difficulte: ex.difficulte ?? state.difficulte,
        contenu: {
          texte: ex.contenu?.texte || "",
          script_audio: ex.contenu?.script_audio || "",
          image_description: ex.contenu?.image_description || "",
          items: Array.isArray(ex.contenu?.items) ? ex.contenu.items : [],
          ...(ex.contenu || {}),
        },
        metadata: ex.metadata,
        animation_guide: ex.animation_guide,
        variante_niveau_bas: ex.variante_niveau_bas,
        variante_niveau_haut: ex.variante_niveau_haut,
      }));

      if (count === 1) return exercises[0];
      update({ generated: exercises, referencesUtilisees: data.references_utilisees || [], step: 2 });
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      update({ loadingGenerate: false });
    }
  };

  const handleRegenerateOne = async (index: number) => {
    setRegeneratingIndex(index);
    try {
      const result = await handleGenerate(1);
      if (result) {
        setState((prev) => {
          const generated = [...prev.generated];
          generated[index] = result as ExerciceDraft;
          return { ...prev, generated };
        });
      }
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleReformulateItem = async (exIndex: number, itemIndex: number, instruction?: string) => {
    setReformulatingKey({ exIndex, itemIndex });
    try {
      const ex = state.generated[exIndex];
      const item = ex.contenu.items[itemIndex];
      const { data, error } = await supabase.functions.invoke("reformulate-exercise-item", {
        body: {
          item,
          contexte: {
            titre_exercice: ex.titre,
            consigne: ex.consigne,
            texte_support: ex.contenu.texte,
            competence: ex.competence,
            niveau: state.niveau,
          },
          instruction,
        },
      });
      if (error) throw error;
      if (data?.item) {
        setState((prev) => {
          const generated = [...prev.generated];
          const items = [...generated[exIndex].contenu.items];
          items[itemIndex] = data.item;
          generated[exIndex] = {
            ...generated[exIndex],
            contenu: { ...generated[exIndex].contenu, items },
          };
          return { ...prev, generated };
        });
        toast.success("Item reformulé !");
      }
    } catch (e: any) {
      toast.error("Erreur reformulation", { description: e.message });
    } finally {
      setReformulatingKey(null);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    update({ loadingPublish: true });
    try {
      // Get a default point_a_maitriser_id
      const { data: points } = await supabase.from("points_a_maitriser").select("id").limit(1);
      const pointId = points?.[0]?.id;
      if (!pointId) throw new Error("Aucun point à maîtriser trouvé en base");

      const { data: insertedExercices, error } = await supabase
        .from("exercices")
        .insert(
          state.generated.map((ex) => ({
            formateur_id: user.id,
            titre: ex.titre,
            consigne: ex.consigne,
            format: ex.format as any,
            competence: ex.competence as any,
            difficulte: ex.difficulte,
            niveau_vise: state.niveau,
            contenu: ex.contenu,
            animation_guide: ex.animation_guide,
            variante_niveau_bas: ex.variante_niveau_bas,
            variante_niveau_haut: ex.variante_niveau_haut,
            point_a_maitriser_id: pointId,
            is_ai_generated: true,
            statut: "validated",
          }))
        )
        .select();

      if (error) throw error;

      if (state.elevesSelected.length > 0 && state.creerCommeDevoir && insertedExercices) {
        const devoirsToInsert = state.elevesSelected.flatMap((eleveId) =>
          insertedExercices.map((ex) => ({
            eleve_id: eleveId,
            exercice_id: ex.id,
            formateur_id: user.id,
            statut: "en_attente" as const,
            raison: "consolidation" as const,
          }))
        );
        const { error: devoirsError } = await supabase.from("devoirs").insert(devoirsToInsert);
        if (devoirsError) throw devoirsError;

        toast.success(
          `${insertedExercices.length} exercice(s) publié(s) et assigné(s) à ${state.elevesSelected.length} élève(s)`
        );
      } else {
        toast.success(`${insertedExercices?.length || 0} exercice(s) publié(s)`);
      }

      setState({ ...initialState });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast.error("Erreur de publication", { description: e.message });
    } finally {
      update({ loadingPublish: false });
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen && state.step === 2 && state.generated.length > 0) {
      setConfirmClose(true);
    } else {
      if (!newOpen) setState({ ...initialState });
      onOpenChange(newOpen);
    }
  };

  const stepLabels = ["Paramètres", "Édition", "Assignation"];

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">🎯 Générateur d'exercices ciblé</DialogTitle>
            <DialogDescription>
              Étape {state.step}/3 — {stepLabels[state.step - 1]}
            </DialogDescription>
            <div className="flex gap-2 pt-2">
              {stepLabels.map((label, i) => (
                <Badge
                  key={i}
                  variant={state.step === i + 1 ? "default" : state.step > i + 1 ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {i + 1}. {label}
                </Badge>
              ))}
            </div>
          </DialogHeader>

          {state.step === 1 && (
            <Step1_ChoixParametres
              state={state}
              onChange={update}
              onGenerate={() => handleGenerate()}
            />
          )}

          {state.step === 2 && (
            <Step2_PreviewEdition
              state={state}
              onChange={update}
              onRegenerateAll={() => handleGenerate()}
              onRegenerateOne={handleRegenerateOne}
              onReformulateItem={handleReformulateItem}
              onBack={() => update({ step: 1 })}
              onNext={() => update({ step: 3 })}
              regeneratingIndex={regeneratingIndex}
              reformulatingKey={reformulatingKey}
            />
          )}

          {state.step === 3 && (
            <Step3_Assignation
              state={state}
              onChange={update}
              onBack={() => update({ step: 2 })}
              onPublish={handlePublish}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonner les modifications ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu vas perdre les exercices générés et tes modifications. Continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setState({ ...initialState });
                onOpenChange(false);
                setConfirmClose(false);
              }}
            >
              Oui, abandonner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GenerateTargetedExerciseWizard;
