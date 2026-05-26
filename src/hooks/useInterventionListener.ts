import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveIntervention = {
  id: string;
  titre: string;
  contenu_texte: string;
  audio_url: string | null;
  competence: string | null;
  niveau_cible: string | null;
};

/**
 * Écoute les événements `intervention_recue` destinés à l'élève connecté
 * dans une session donnée. Retourne la dernière intervention reçue.
 */
export function useInterventionListener(sessionId: string | null | undefined) {
  const [intervention, setIntervention] = useState<LiveIntervention | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let userId: string | null = null;

    const setup = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      userId = auth.user.id;

      const channel = supabase
        .channel(`intervention-listener-${sessionId}-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_live_events",
            filter: `session_id=eq.${sessionId}`,
          },
          async (payload) => {
            const ev = payload.new as {
              event_type: string;
              eleve_id: string | null;
              payload: Record<string, unknown> | null;
            };
            if (ev.event_type !== "intervention_recue") return;
            if (ev.eleve_id !== userId) return;

            const p = (ev.payload ?? {}) as Record<string, unknown>;
            const interventionId = p.intervention_id as string | undefined;
            if (!interventionId) return;

            const { data: interv } = await supabase
              .from("interventions")
              .select("id, titre, contenu_texte, audio_url, competence, niveau_cible")
              .eq("id", interventionId)
              .maybeSingle();

            if (interv && !cancelled) {
              setIntervention(interv as LiveIntervention);
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setup().then((c) => {
      cleanup = c;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [sessionId]);

  const dismiss = async () => {
    if (!sessionId || !intervention) {
      setIntervention(null);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase.from("session_live_events").insert({
        session_id: sessionId,
        eleve_id: auth.user.id,
        event_type: "aide_demandee",
        payload: { intervention_acknowled: true, intervention_id: intervention.id },
      });
    }
    setIntervention(null);
  };

  return { intervention, dismiss };
}
