import { supabase as _supabase } from "@/integrations/supabase/client";

const supabase = _supabase as any;

export type ManageableSession = {
  id: string;
  titre: string | null;
  date_seance: string | null;
  group_id: string;
  group_nom: string | null;
};

export type SessionLinkOutcome = {
  exerciseId: string;
  status: "added" | "already_present" | "refused";
  reason?: string;
  sessionExerciceId?: string;
  ordre?: number;
};

export type LinkPublishedVariantsResult = {
  outcomes: SessionLinkOutcome[];
  addedCount: number;
  alreadyPresentCount: number;
  refusedCount: number;
};

/**
 * Séances gérables par le formateur authentifié (groupe.formateur_id = userId).
 * Ne fait confiance à aucun rôle transmis par le navigateur.
 */
export async function fetchFormateurManageableSessions(userId: string): Promise<ManageableSession[]> {
  if (!userId) return [];

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, nom")
    .eq("formateur_id", userId)
    .eq("is_active", true);
  if (groupsError) throw groupsError;

  const groupIds = (groups ?? []).map((group: { id: string }) => group.id);
  if (groupIds.length === 0) return [];

  const groupNameById = new Map(
    (groups ?? []).map((group: { id: string; nom: string | null }) => [group.id, group.nom]),
  );

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, titre, date_seance, group_id")
    .in("group_id", groupIds)
    .order("date_seance", { ascending: false })
    .limit(100);
  if (sessionsError) throw sessionsError;

  return (sessions ?? []).map((session: {
    id: string;
    titre: string | null;
    date_seance: string | null;
    group_id: string;
  }) => ({
    id: session.id,
    titre: session.titre,
    date_seance: session.date_seance,
    group_id: session.group_id,
    group_nom: groupNameById.get(session.group_id) ?? null,
  }));
}

export async function assertSessionManagedByFormateur(
  sessionId: string,
  userId: string,
): Promise<{ ok: true; session: { id: string; group_id: string } } | { ok: false; reason: string }> {
  if (!sessionId || !userId) {
    return { ok: false, reason: "Séance ou formateur manquant." };
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, group_id, group:groups(formateur_id)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) {
    return { ok: false, reason: "Séance introuvable." };
  }

  const formateurId = (session as { group?: { formateur_id?: string } | null }).group?.formateur_id;
  if (formateurId !== userId) {
    return {
      ok: false,
      reason: "Vous n’avez pas le droit de modifier cette séance (elle appartient à un autre formateur).",
    };
  }

  return { ok: true, session: { id: session.id, group_id: session.group_id } };
}

/**
 * Rattache des exercices publiés à une séance (session_exercices).
 * Idempotent : un double appel ne crée pas de doublon.
 * Vérifie la propriété côté serveur via groups.formateur_id.
 */
export async function linkPublishedVariantsToSession(input: {
  sessionId: string;
  userId: string;
  variants: Array<{ exerciseId: string; ordre?: number }>;
}): Promise<LinkPublishedVariantsResult> {
  const { sessionId, userId, variants } = input;
  const outcomes: SessionLinkOutcome[] = [];

  const ownership = await assertSessionManagedByFormateur(sessionId, userId);
  if (!ownership.ok) {
    for (const variant of variants) {
      outcomes.push({
        exerciseId: variant.exerciseId,
        status: "refused",
        reason: ownership.reason,
      });
    }
    return summarize(outcomes);
  }

  const unique = new Map<string, { exerciseId: string; ordre?: number }>();
  for (const variant of variants) {
    if (!variant.exerciseId) continue;
    if (!unique.has(variant.exerciseId)) unique.set(variant.exerciseId, variant);
  }
  const list = [...unique.values()];
  if (list.length === 0) return summarize(outcomes);

  const exerciseIds = list.map((entry) => entry.exerciseId);
  const { data: existing, error: existingError } = await supabase
    .from("session_exercices")
    .select("id, exercice_id, ordre")
    .eq("session_id", sessionId)
    .in("exercice_id", exerciseIds);
  if (existingError) throw existingError;

  const existingByExercise = new Map(
    (existing ?? []).map((row: { id: string; exercice_id: string; ordre: number }) => [
      row.exercice_id,
      row,
    ]),
  );

  const missing = list.filter((entry) => !existingByExercise.has(entry.exerciseId));
  for (const entry of list) {
    const found = existingByExercise.get(entry.exerciseId);
    if (found) {
      outcomes.push({
        exerciseId: entry.exerciseId,
        status: "already_present",
        sessionExerciceId: found.id,
        ordre: found.ordre,
      });
    }
  }

  if (missing.length === 0) return summarize(outcomes);

  const { data: lastRow } = await supabase
    .from("session_exercices")
    .select("ordre")
    .eq("session_id", sessionId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrdre = ((lastRow as { ordre?: number } | null)?.ordre ?? 0) + 1;
  const rows = missing.map((entry) => {
    const ordre = typeof entry.ordre === "number" && entry.ordre > 0 ? entry.ordre : nextOrdre++;
    if (typeof entry.ordre !== "number" || entry.ordre <= 0) {
      /* nextOrdre already advanced */
    } else if (entry.ordre >= nextOrdre) {
      nextOrdre = entry.ordre + 1;
    }
    return {
      session_id: sessionId,
      exercice_id: entry.exerciseId,
      ordre,
      statut: "planifie" as const,
    };
  });

  const { data: created, error: insertError } = await supabase
    .from("session_exercices")
    .insert(rows as never)
    .select("id, exercice_id, ordre");
  if (insertError) throw insertError;

  for (const row of created ?? []) {
    outcomes.push({
      exerciseId: row.exercice_id,
      status: "added",
      sessionExerciceId: row.id,
      ordre: row.ordre,
    });
  }

  // Couvrir les manquants non renvoyés (cas rare)
  const createdIds = new Set((created ?? []).map((row: { exercice_id: string }) => row.exercice_id));
  for (const entry of missing) {
    if (!createdIds.has(entry.exerciseId) && !outcomes.some((o) => o.exerciseId === entry.exerciseId)) {
      outcomes.push({
        exerciseId: entry.exerciseId,
        status: "refused",
        reason: "Enregistrement refusé par le serveur.",
      });
    }
  }

  return summarize(outcomes);
}

function summarize(outcomes: SessionLinkOutcome[]): LinkPublishedVariantsResult {
  return {
    outcomes,
    addedCount: outcomes.filter((o) => o.status === "added").length,
    alreadyPresentCount: outcomes.filter((o) => o.status === "already_present").length,
    refusedCount: outcomes.filter((o) => o.status === "refused").length,
  };
}
