import { supabase } from "@/integrations/supabase/client";

/**
 * Distribution d'une séance vers les élèves (mécanisme unique partagé).
 *
 * Contexte : le tableau de bord élève (`src/pages/eleve/Dashboard.tsx`) et le
 * hook `useActiveSeances` ne montrent une séance que si elle est « du jour »
 * (`date_seance` aujourd'hui) OU `statut = 'en_cours'`. Marquer des exercices
 * `traite_en_classe` ne suffit donc PAS : tant que la séance n'est pas active,
 * la requête élève court-circuite (`activeSessionIds` vide) et l'élève voit
 * « Aucune séance aujourd'hui ». C'est exactement le cas des séances sandbox,
 * dont la date est fixée à demain et le statut à `planifiee`.
 *
 * `activateSessionForStudents` rend la séance visible immédiatement côté élève
 * sans écraser une séance déjà terminée, et émet un événement temps réel pour
 * que les écrans abonnés se rafraîchissent.
 */
export async function activateSessionForStudents(sessionId: string): Promise<void> {
  if (!sessionId) return;

  const { error } = await supabase
    .from("sessions")
    .update({ statut: "en_cours" as any, updated_at: new Date().toISOString() } as any)
    .eq("id", sessionId)
    .neq("statut", "terminee");
  if (error) throw error;

  // Couche temps réel : best-effort, ne bloque pas l'envoi en cas d'échec.
  const { error: eventError } = await supabase
    .from("session_live_events")
    .insert({
      session_id: sessionId,
      eleve_id: null,
      event_type: "session_state_change",
      payload: { reason: "exercices_envoyes" } as never,
    } as never);
  if (eventError) {
    console.warn("[sessionDistribution] session_state_change", eventError.message);
  }
}

/**
 * Envoie des exercices de séance aux élèves : les marque `traite_en_classe`
 * (couche persistée lue par l'élève) puis active la séance pour qu'elle
 * apparaisse aujourd'hui sur le tableau de bord élève.
 */
export async function sendSessionExercisesToStudents(params: {
  sessionId: string;
  sessionExerciceIds: string[];
}): Promise<void> {
  const { sessionId, sessionExerciceIds } = params;

  if (sessionExerciceIds.length > 0) {
    const { error } = await supabase
      .from("session_exercices")
      .update({
        statut: "traite_en_classe" as any,
        is_sent: true,
        updated_at: new Date().toISOString(),
      } as any)
      .in("id", sessionExerciceIds);
    if (error) throw error;
  }

  await activateSessionForStudents(sessionId);
}
