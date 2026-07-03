// @ts-nocheck
/**
 * Résout le session_id pour l'émission de session_live_events.
 * Ordre : devoir.session_id → body.session_id → devoir récent même exo
 * → session_exercices (élève ou collectif) sur séance active/récente.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ACTIVE_SESSION_STATUTS = ["en_cours", "planifie", "ouverte"];

export interface ResolveSessionOpts {
  devoirSessionId?: string | null;
  bodySessionId?: string | null;
  exerciceId: string;
  eleveId: string;
}

export async function resolveLiveSessionId(
  admin: SupabaseClient,
  opts: ResolveSessionOpts,
): Promise<string | null> {
  if (opts.devoirSessionId) return opts.devoirSessionId;
  if (opts.bodySessionId) return opts.bodySessionId;

  const { data: devoirLink } = await admin
    .from("devoirs")
    .select("session_id")
    .eq("eleve_id", opts.eleveId)
    .eq("exercice_id", opts.exerciceId)
    .not("session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (devoirLink?.session_id) return devoirLink.session_id;

  const { data: seRows } = await admin
    .from("session_exercices")
    .select("session_id, created_at, sessions!inner(id, statut, date_seance)")
    .eq("exercice_id", opts.exerciceId)
    .or(`eleve_id.eq.${opts.eleveId},eleve_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!seRows?.length) return null;

  const active = seRows.find((r: any) =>
    ACTIVE_SESSION_STATUTS.includes(r.sessions?.statut)
  );
  if (active?.session_id) return active.session_id;

  return seRows[0]?.session_id ?? null;
}
