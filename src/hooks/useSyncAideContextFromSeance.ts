import { useEffect } from "react";
import { inferCurriculumSessionCode } from "@/lib/curriculum/sessionCode";
import { useAidePedagogique } from "@/contexts/AidePedagogiqueContext";
import type { PedagogicalLevel } from "@/lib/avatar/pedagogicalTypes";
import { isPedagogicalLevel } from "@/lib/avatar/detectPedagogicalIntent";
import type { SeanceExercice, SeanceResume } from "@/hooks/useEleveSeances";

/**
 * Synchronise le panneau Aide avec la séance / exercice visibles.
 * N’envoie jamais d’identifiant élève ni de score au contexte IA.
 */
export function useSyncAideContextFromSeance(params: {
  seance: SeanceResume | null | undefined;
  exercices: SeanceExercice[] | null | undefined;
  niveauHint?: string | null;
  objectifHint?: string | null;
}) {
  const { setAideContext, resetAideContext } = useAidePedagogique();

  useEffect(() => {
    const seance = params.seance;
    if (!seance) {
      resetAideContext();
      return;
    }

    const list = params.exercices ?? [];
    const current =
      list.find((e) => e.statut === "en_cours") ??
      list.find((e) => e.statut === "a_faire") ??
      list[0] ??
      null;

    const code = inferCurriculumSessionCode(seance.titre);
    const niveau: PedagogicalLevel = isPedagogicalLevel(params.niveauHint)
      ? params.niveauHint
      : "A2";

    setAideContext({
      sessionCode: code,
      sessionTitre: seance.titre,
      objectif: params.objectifHint ?? null,
      niveau,
      leconTitre: null,
      exerciceTitre: current?.titre ?? null,
      exerciceConsigne: null,
      exerciceCompetence: current?.competence ?? null,
    });

    return () => {
      resetAideContext();
    };
  }, [
    params.seance,
    params.exercices,
    params.niveauHint,
    params.objectifHint,
    setAideContext,
    resetAideContext,
  ]);
}
