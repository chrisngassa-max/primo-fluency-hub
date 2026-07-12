import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Abonnement Realtime réutilisable sur `session_exercices` pour une séance.
 * Utilisé côté formateur (SessionPlaylistPanel — réordonnancement en direct)
 * ET côté apprenant (BilanSeance — la liste affichée doit refléter les
 * changements de position/ajout/retrait faits par le formateur pendant la
 * séance, sans que l'élève ait besoin de recharger la page).
 */
export function useSessionExercicesRealtime(sessionId: string | null | undefined, onChange: () => void) {
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`session-exercices-playlist-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_exercices", filter: `session_id=eq.${sessionId}` },
        onChange,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
}
