import { supabase } from "@/integrations/supabase/client";

export type LiveEventType =
  | "exercice_demarre"
  | "reponse_correcte"
  | "reponse_incorrecte"
  | "erreur_repetee"
  | "rythme_anormal"
  | "exercice_termine"
  | "aide_demandee"
  | "intervention_recue"
  | "fiche_terminee"
  | "inactif"
  | "clic_aleatoire_probable"
  | "session_state_change"
  | "eleve_state_change";

export async function emitLiveEvent(opts: {
  sessionId: string;
  eleveId: string;
  eventType: LiveEventType;
  payload?: Record<string, unknown>;
  typeErreurId?: string | null;
  prioriteScore?: number | null;
}): Promise<void> {
  const row = {
    session_id: opts.sessionId,
    eleve_id: opts.eleveId,
    event_type: opts.eventType,
    payload: (opts.payload ?? {}) as never,
    type_erreur_id: opts.typeErreurId ?? null,
    priorite_score: opts.prioriteScore ?? null,
  };
  const { error } = await supabase.from("session_live_events").insert(row as never);
  if (error) {
    console.warn("[liveEventEmitter]", opts.eventType, error.message);
  }
}
