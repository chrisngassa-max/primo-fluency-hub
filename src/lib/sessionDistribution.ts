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
export async function activateSessionForStudents(
  sessionId: string,
  reason: "exercices_envoyes" | "appel_enregistre" = "exercices_envoyes",
): Promise<void> {
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
      payload: { reason } as never,
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

/**
 * Envoie des exercices depuis la banque : crée les liens session_exercices
 * manquants puis réutilise sendSessionExercisesToStudents.
 */
export async function sendLibraryExercisesToStudents(params: {
  sessionId: string;
  exerciseIds: string[];
}): Promise<void> {
  const { sessionId, exerciseIds } = params;
  if (exerciseIds.length === 0) return;

  const { data: existing, error: fetchError } = await supabase
    .from("session_exercices")
    .select("id, exercice_id")
    .eq("session_id", sessionId)
    .in("exercice_id", exerciseIds);
  if (fetchError) throw fetchError;

  const linkByExercise = new Map(
    (existing ?? []).map((row) => [row.exercice_id, row.id]),
  );
  const missing = exerciseIds.filter((id) => !linkByExercise.has(id));

  if (missing.length > 0) {
    const { data: lastRow } = await supabase
      .from("session_exercices")
      .select("ordre")
      .eq("session_id", sessionId)
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startOrder = (lastRow?.ordre ?? 0) + 1;

    const { data: created, error: insertError } = await supabase
      .from("session_exercices")
      .insert(
        missing.map((exerciceId, index) => ({
          session_id: sessionId,
          exercice_id: exerciceId,
          ordre: startOrder + index,
          statut: "planifie" as const,
        })) as never,
      )
      .select("id, exercice_id");
    if (insertError) throw insertError;

    for (const row of created ?? []) {
      linkByExercise.set(row.exercice_id, row.id);
    }
  }

  const sessionExerciceIds = exerciseIds
    .map((id) => linkByExercise.get(id))
    .filter((id): id is string => !!id);

  await sendSessionExercisesToStudents({ sessionId, sessionExerciceIds });
}

/** Envoie une leçon/support aux élèves du groupe via resource_assignments. */
export async function sendLessonToStudents(params: {
  resourceId: string;
  sessionId: string;
  assignedBy: string;
}): Promise<number> {
  const { resourceId, sessionId, assignedBy } = params;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("group_id")
    .eq("id", sessionId)
    .single();
  if (sessionError) throw sessionError;

  const groupId = (session as { group_id?: string })?.group_id;
  if (!groupId) throw new Error("Séance sans groupe.");

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("eleve_id")
    .eq("group_id", groupId);
  if (membersError) throw membersError;

  const rows = (members || []).map((m: { eleve_id: string }) => ({
    resource_id: resourceId,
    learner_id: m.eleve_id,
    group_id: groupId,
    assigned_by: assignedBy,
  }));
  if (rows.length === 0) throw new Error("Aucun élève dans le groupe.");

  const { error } = await supabase.from("resource_assignments" as never).insert(rows as never);
  if (error) throw error;

  return rows.length;
}
