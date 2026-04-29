import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook réutilisable de synchronisation live des tentatives d'exercice
 * vers la table `exercise_attempts`. Permet au formateur de voir en
 * direct (via Realtime) l'avancement des élèves pendant la passation,
 * sans attendre la soumission finale.
 *
 * - Upsert d'un `exercise_attempts` avec status="in_progress"
 * - Debounce ~800ms sur les changements de réponses
 * - Heartbeat 10s pour rafraîchir / recréer si besoin
 * - Compatible : DevoirPassation (1 exercice) et BilanSeance (par exercice courant)
 *
 * Important : la finalisation `completed` est gérée par le trigger SQL
 * `mirror_resultat_to_attempt` lors de l'insertion dans `resultats`.
 * Ce hook ne fait PAS de transition "completed" pour ne rien casser.
 */
export interface UseLiveAttemptSyncOptions {
  exerciseId: string | null | undefined;
  learnerId: string | null | undefined;
  /** Réponses brutes (clé = index d'item). Utilisé pour calculer la progression. */
  answers: Record<number | string, string>;
  /** Items de l'exercice (pour calcul progression + score partiel). */
  items: Array<{ bonne_reponse?: string; [k: string]: unknown }>;
  /** Désactive le sync (ex: exercice déjà terminé / résultat affiché). */
  disabled?: boolean;
  /** Source d'origine (ex: "primo-live", "primo-bilan-live"). */
  sourceApp?: string;
}

export function useLiveAttemptSync({
  exerciseId,
  learnerId,
  answers,
  items,
  disabled = false,
  sourceApp = "primo-live",
}: UseLiveAttemptSyncOptions) {
  const attemptIdRef = useRef<string | null>(null);
  const lastSnapshotRef = useRef<string>("");

  const sync = useCallback(
    async (force = false) => {
      if (!exerciseId || !learnerId || disabled) return;

      const snapshot = JSON.stringify(answers);
      if (!force && snapshot === lastSnapshotRef.current) return;
      lastSnapshotRef.current = snapshot;

      // Calcul progression + score partiel (QCM/texte)
      let answeredCount = 0;
      let correctCount = 0;
      const itemResults = items.map((item, idx) => {
        const userAnswer = (answers as Record<string | number, string>)[idx];
        if (userAnswer !== undefined && userAnswer !== "") {
          answeredCount++;
          const isCorrect =
            String(userAnswer).trim().toLowerCase() ===
            String(item?.bonne_reponse ?? "").trim().toLowerCase();
          if (isCorrect) correctCount++;
          return { idx, answered: true, correct: isCorrect, reponse: userAnswer };
        }
        return { idx, answered: false };
      });
      const partialScore = items.length > 0 ? correctCount / items.length : 0;

      const payload: Record<string, unknown> = {
        answers: answers as never,
        item_results: {
          items: itemResults,
          answered: answeredCount,
          total: items.length,
        } as never,
        score_normalized: partialScore,
        source_app: sourceApp,
      };

      try {
        // 1) update existant in_progress (cas le plus fréquent)
        const { data: updated, error: updErr } = await supabase
          .from("exercise_attempts")
          .update(payload as never)
          .eq("exercise_id", exerciseId)
          .eq("learner_id", learnerId)
          .eq("status", "in_progress")
          .select("id")
          .maybeSingle();

        if (updated?.id) {
          attemptIdRef.current = updated.id;
          return;
        }
        if (updErr) console.warn("[useLiveAttemptSync] update warn:", updErr.message);

        // 2) sinon insert
        const { data: inserted, error: insErr } = await supabase
          .from("exercise_attempts")
          .insert({
            exercise_id: exerciseId,
            learner_id: learnerId,
            status: "in_progress",
            started_at: new Date().toISOString(),
            ...payload,
          } as never)
          .select("id")
          .maybeSingle();

        if (inserted?.id) attemptIdRef.current = inserted.id;
        else if (insErr) console.warn("[useLiveAttemptSync] insert warn:", insErr.message);
      } catch (e) {
        console.warn("[useLiveAttemptSync] error", e);
      }
    },
    [exerciseId, learnerId, answers, items, disabled, sourceApp]
  );

  // Debounce ~800ms sur les changements de réponses
  useEffect(() => {
    if (!exerciseId || !learnerId || disabled) return;
    const t = setTimeout(() => sync(false), 800);
    return () => clearTimeout(t);
  }, [answers, exerciseId, learnerId, disabled, sync]);

  // Heartbeat 10s
  useEffect(() => {
    if (!exerciseId || !learnerId || disabled) return;
    const interval = setInterval(() => sync(true), 10000);
    return () => clearInterval(interval);
  }, [exerciseId, learnerId, disabled, sync]);

  return { attemptId: attemptIdRef.current, syncNow: () => sync(true) };
}
