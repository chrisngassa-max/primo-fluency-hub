import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Source de vérité ÉLÈVE pour « Ma séance » / « Mes séances ».
 *
 * Architecture imposée :
 * - La SOURCE DE VÉRITÉ est PERSISTÉE (`sessions`, `session_exercices`,
 *   `devoirs`, `resultats`, `ressources_pedagogiques`). Un exercice envoyé
 *   reste donc visible après reload, le soir, ou même si l'élève était absent.
 * - `session_live_events` (Realtime) sert UNIQUEMENT de couche temps réel
 *   par-dessus (notification + rafraîchissement), jamais de source unique.
 */

export type SeanceResume = {
  id: string;
  titre: string;
  date_seance: string;
  group_id: string;
  group_nom: string;
  statut: string;
};

/** Statut d'un exercice tel que vécu par l'élève. */
export type ExerciceStatut = "a_faire" | "en_cours" | "termine";

export type SeanceExercice = {
  /** Clé unique d'affichage (session_exercice.id ou devoir.id). */
  key: string;
  /** Origine : exercice de séance (collectif) ou devoir individuel. */
  source: "seance" | "devoir";
  exerciceId: string;
  titre: string;
  competence: string | null;
  statut: ExerciceStatut;
  score: number | null;
  /** Devoir id pour ouverture directe (route /eleve/devoirs/:id). */
  devoirId: string | null;
};

const dayBounds = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

/** Récupère les groupes de l'élève courant. */
async function fetchGroupIds(eleveId: string): Promise<string[]> {
  const { data } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("eleve_id", eleveId);
  return (data ?? []).map((r) => r.group_id);
}

/**
 * Séances « du jour » + « en cours » pour l'élève. On agrège les deux pour
 * ne jamais masquer un envoi, comme le fait déjà le dashboard.
 */
export function useActiveSeances(eleveId: string | undefined) {
  return useQuery({
    queryKey: ["eleve-seances-actives", eleveId],
    queryFn: async (): Promise<SeanceResume[]> => {
      const groupIds = await fetchGroupIds(eleveId!);
      if (groupIds.length === 0) return [];
      const { start, end } = dayBounds();

      const { data: todays } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, statut, group:groups(nom)")
        .in("group_id", groupIds)
        .gte("date_seance", start.toISOString())
        .lt("date_seance", end.toISOString());

      const { data: enCours } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, group_id, statut, group:groups(nom)")
        .in("group_id", groupIds)
        .eq("statut", "en_cours");

      const byId = new Map<string, SeanceResume>();
      [...(todays ?? []), ...(enCours ?? [])].forEach((s: any) => {
        byId.set(s.id, {
          id: s.id,
          titre: s.titre,
          date_seance: s.date_seance,
          group_id: s.group_id,
          group_nom: s.group?.nom ?? "",
          statut: s.statut,
        });
      });
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.date_seance).getTime() - new Date(a.date_seance).getTime(),
      );
    },
    enabled: !!eleveId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
  });
}

/**
 * Exercices PERSISTÉS d'une séance pour l'élève courant, avec statut.
 * Combine les exercices de séance (collectifs / ciblés) et les devoirs
 * rattachés à cette séance. Les scores et statuts viennent de `resultats`
 * et `exercise_attempts` (couche persistée).
 */
export function useSeanceExercices(sessionId: string | null | undefined, eleveId: string | undefined) {
  return useQuery({
    queryKey: ["eleve-seance-exercices", sessionId, eleveId],
    queryFn: async (): Promise<SeanceExercice[]> => {
      if (!sessionId || !eleveId) return [];

      // 1) Exercices de séance envoyés (persistés).
      const { data: seLinks } = await supabase
        .from("session_exercices")
        .select("id, exercice_id, ordre, statut, exercice:exercices(id, titre, competence)")
        .eq("session_id", sessionId)
        .eq("statut", "traite_en_classe" as any)
        .or(`eleve_id.is.null,eleve_id.eq.${eleveId}`)
        .order("ordre", { ascending: true });

      // 2) Devoirs rattachés à cette séance (persistés, jamais archivés côté élève).
      const { data: devoirs } = await supabase
        .from("devoirs")
        .select("id, exercice_id, statut, exercice:exercices(id, titre, competence)")
        .eq("eleve_id", eleveId)
        .eq("session_id", sessionId)
        .neq("statut", "archive" as any);

      const exerciceIds = [
        ...new Set([
          ...(seLinks ?? []).map((se: any) => se.exercice_id),
          ...(devoirs ?? []).map((d: any) => d.exercice_id),
        ]),
      ].filter(Boolean);

      if (exerciceIds.length === 0) return [];

      // 3) Résultats persistés de l'élève (terminé + score).
      const { data: resultats } = await supabase
        .from("resultats")
        .select("exercice_id, score, created_at")
        .eq("eleve_id", eleveId)
        .in("exercice_id", exerciceIds)
        .order("created_at", { ascending: false });

      const scoreByEx = new Map<string, number>();
      (resultats ?? []).forEach((r: any) => {
        if (!scoreByEx.has(r.exercice_id)) scoreByEx.set(r.exercice_id, r.score);
      });

      // 4) Tentatives en cours (best effort — ne bloque pas si indisponible).
      let inProgress = new Set<string>();
      try {
        const { data: attempts } = await supabase
          .from("exercise_attempts")
          .select("exercise_id, status")
          .eq("learner_id", eleveId)
          .eq("status", "in_progress")
          .in("exercise_id", exerciceIds);
        inProgress = new Set((attempts ?? []).map((a: any) => a.exercise_id).filter(Boolean));
      } catch {
        /* lecture facultative */
      }

      const statutFor = (exId: string, devoirStatut?: string): ExerciceStatut => {
        if (scoreByEx.has(exId) || devoirStatut === "fait" || devoirStatut === "arrete") {
          return "termine";
        }
        if (inProgress.has(exId)) return "en_cours";
        return "a_faire";
      };

      const out: SeanceExercice[] = [];
      const seenEx = new Set<string>();

      (seLinks ?? []).forEach((se: any) => {
        const ex = se.exercice;
        if (!ex) return;
        seenEx.add(ex.id);
        out.push({
          key: `se-${se.id}`,
          source: "seance",
          exerciceId: ex.id,
          titre: ex.titre ?? "Exercice",
          competence: ex.competence ?? null,
          statut: statutFor(ex.id),
          score: scoreByEx.get(ex.id) ?? null,
          devoirId: null,
        });
      });

      (devoirs ?? []).forEach((d: any) => {
        const ex = d.exercice;
        if (!ex) return;
        // Évite le doublon si l'exercice est déjà listé comme exercice de séance.
        if (seenEx.has(ex.id)) return;
        out.push({
          key: `dev-${d.id}`,
          source: "devoir",
          exerciceId: ex.id,
          titre: ex.titre ?? "Exercice",
          competence: ex.competence ?? null,
          statut: statutFor(ex.id, d.statut),
          score: scoreByEx.get(ex.id) ?? null,
          devoirId: d.id,
        });
      });

      return out;
    },
    enabled: !!sessionId && !!eleveId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

/**
 * Couche TEMPS RÉEL : abonnement à `session_live_events` filtré sur la séance.
 * À chaque événement, on rafraîchit la liste persistée et on signale les
 * nouveaux envois d'exercice. Ce hook ne lit JAMAIS les données pour les
 * afficher : il ne fait que déclencher un refetch des sources persistées.
 */
export function useSeancesLiveRefresh(
  sessionIds: string[],
  opts?: { onNewExercice?: () => void; notify?: boolean },
) {
  const qc = useQueryClient();
  const idsKey = sessionIds.join(",");
  const notify = opts?.notify ?? true;
  const onNewExerciceRef = useRef(opts?.onNewExercice);
  onNewExerciceRef.current = opts?.onNewExercice;

  useEffect(() => {
    if (sessionIds.length === 0) return;
    const channels = sessionIds.map((sid) =>
      supabase
        .channel(`eleve-seance-live-${sid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_live_events",
            filter: `session_id=eq.${sid}`,
          },
          (payload) => {
            const ev = payload.new as { event_type?: string };
            // Rafraîchit systématiquement la source persistée.
            qc.invalidateQueries({ queryKey: ["eleve-seance-exercices"] });
            qc.invalidateQueries({ queryKey: ["eleve-seances-actives"] });
            qc.invalidateQueries({ queryKey: ["eleve-seance-lecons"] });

            // Signale un éventuel nouvel exercice / changement d'état de séance.
            const signalTypes = ["exercice_demarre", "session_state_change", "intervention_recue"];
            if (ev.event_type && signalTypes.includes(ev.event_type)) {
              onNewExerciceRef.current?.();
              if (notify) {
                toast("Nouveau contenu dans ta séance", {
                  description: "Ta liste vient d'être mise à jour.",
                });
              }
            }
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, notify, qc]);
}
