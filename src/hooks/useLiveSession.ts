import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveEventType } from "@/lib/liveEventEmitter";

export type { LiveEventType };

export type LiveEvent = {
  id: string;
  session_id: string;
  eleve_id: string | null;
  event_type: LiveEventType;
  payload: Record<string, unknown> | null;
  type_erreur_id: string | null;
  priorite_score: number | null;
  created_at: string;
};

export type EleveStatutLive = "idle" | "playing" | "finished" | "offline";

export type EleveStateLive = {
  eleve_id: string;
  statut: EleveStatutLive;
  dernier_event_type: LiveEventType | null;
  derniere_activite: string | null;
  score_dernier_exercice: number | null;
  exercice_id: string | null;
  exercice_en_cours_id: string | null;
  exercice_en_cours_titre: string | null;
  dernier_type_erreur: string | null;
};

export type NiveauxEleve = {
  niveau_co?: string | null;
  niveau_ce?: string | null;
  niveau_ee?: string | null;
  niveau_eo?: string | null;
};

// Sprint 4 — moteur de priorité côté client
const POIDS_PALIER: Record<string, number> = {
  A0: 1.0,
  A1: 1.2,
  A2: 1.5,
  B1: 2.0,
  B2: 2.5,
};

function poidsForEleve(eleveId: string, niveauxMap?: Map<string, NiveauxEleve>): number {
  const n = niveauxMap?.get(eleveId);
  if (!n) return 1.2;
  const niveaux = [n.niveau_co, n.niveau_ce, n.niveau_ee, n.niveau_eo].filter(Boolean) as string[];
  if (niveaux.length === 0) return 1.2;
  const poids = niveaux.map((niv) => POIDS_PALIER[niv] ?? 1.2);
  return poids.reduce((a, b) => a + b, 0) / poids.length;
}

function freshnessFactor(createdAt: string): number {
  const minutesSince = (Date.now() - new Date(createdAt).getTime()) / 60000;
  return Math.max(0.2, 1 - minutesSince / 15);
}

function eventToStatut(type: LiveEventType): EleveStatutLive {
  if (type === "fiche_terminee" || type === "exercice_termine") return "finished";
  if (type === "inactif") return "idle";
  return "playing";
}

const MAX_EVENTS = 200;
const PRIORITY_WINDOW_MS = 15 * 60 * 1000;

export function useLiveSession(
  sessionId: string | null,
  niveauxMap?: Map<string, NiveauxEleve>,
) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setEvents([]);
      return;
    }
    supabase
      .from("session_live_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(MAX_EVENTS)
      .then(({ data }) => {
        if (data) setEvents(data as LiveEvent[]);
      });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    channelRef.current = supabase
      .channel(`live-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_live_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setEvents((prev) =>
            [payload.new as LiveEvent, ...prev].slice(0, MAX_EVENTS)
          );
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnected(false);
    };
  }, [sessionId]);

  const eleveStateMap = useMemo(() => {
    const map = new Map<string, EleveStateLive>();
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (!ev.eleve_id) continue;
      const prev = map.get(ev.eleve_id);
      const isErreur =
        ev.event_type === "reponse_incorrecte" || ev.event_type === "erreur_repetee";
      const payload = (ev.payload ?? {}) as Record<string, any>;
      const started = ev.event_type === "exercice_demarre";
      const finishedCurrent =
        ev.event_type === "exercice_termine" &&
        (!prev?.exercice_en_cours_id || payload.exercice_id === prev.exercice_en_cours_id);
      map.set(ev.eleve_id, {
        eleve_id: ev.eleve_id,
        statut: eventToStatut(ev.event_type),
        dernier_event_type: ev.event_type,
        derniere_activite: ev.created_at,
        score_dernier_exercice:
          payload.score ?? prev?.score_dernier_exercice ?? null,
        exercice_id:
          payload.exercice_id ?? prev?.exercice_id ?? null,
        exercice_en_cours_id: started
          ? payload.exercice_id ?? null
          : finishedCurrent ? null : prev?.exercice_en_cours_id ?? null,
        exercice_en_cours_titre: started
          ? payload.exercice_titre ?? "Exercice"
          : finishedCurrent ? null : prev?.exercice_en_cours_titre ?? null,
        dernier_type_erreur: isErreur
          ? (ev.type_erreur_id ?? prev?.dernier_type_erreur ?? null)
          : (prev?.dernier_type_erreur ?? null),
      });
    }
    return map;
  }, [events]);

  // Sprint 4 — priorité complète par élève : base × poids_palier × freshness
  const prioriteMap = useMemo(() => {
    const map = new Map<string, number>();
    const cutoff = Date.now() - PRIORITY_WINDOW_MS;
    for (const ev of events) {
      if (!ev.eleve_id) continue;
      if (ev.event_type !== "reponse_incorrecte" && ev.event_type !== "erreur_repetee") continue;
      if (!ev.priorite_score) continue;
      if (new Date(ev.created_at).getTime() < cutoff) continue;
      const freshness = freshnessFactor(ev.created_at);
      const poids = poidsForEleve(ev.eleve_id, niveauxMap);
      const full = ev.priorite_score * poids * freshness;
      const existing = map.get(ev.eleve_id) ?? 0;
      if (full > existing) map.set(ev.eleve_id, full);
    }
    return map;
  }, [events, niveauxMap]);

  const recentFeed = useMemo(() => events.slice(0, 20), [events]);

  return { events, recentFeed, eleveStateMap, prioriteMap, connected };
}
