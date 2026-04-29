/**
 * QA embarquée à injecter dans les prompts système des générateurs d'exercices.
 * Demande à l'IA d'auto-réviser chaque item avant de l'inclure dans la réponse finale.
 * À combiner avec la validation déterministe (`validateAndFix`) côté serveur.
 */
export const QA_REVIEW_BLOCK = `

═══════════════════════════════════════════════════
REVUE QA INTERNE OBLIGATOIRE (ne pas mentionner dans la réponse)
═══════════════════════════════════════════════════
Avant d'inclure chaque item dans la réponse finale, effectue une revue interne :
1. La consigne est claire et adaptée au niveau ciblé.
2. Une seule réponse est correcte.
3. Les distracteurs sont plausibles mais incorrects.
4. Le français est naturel, sans ambiguïté involontaire.
5. L'item correspond bien à la compétence ciblée.
6. L'item n'est pas redondant avec les autres items de l'exercice.

Si un item échoue à un critère, corrige-le avant de l'inclure.
Ne mentionne pas cette revue dans ta réponse. Retourne uniquement le JSON final validé.
═══════════════════════════════════════════════════
`;

/**
 * Helper : crée un signalement qa_auto si toutes les colonnes obligatoires sont disponibles.
 * Sinon, journalise dans les logs avec préfixe [QA_AUTO].
 *
 * @param supabase - Client Supabase (service role recommandé)
 * @param payload - Données du contexte QA
 */
export async function logQaAuto(
  supabase: any,
  payload: {
    eleve_id?: string | null;
    formateur_id?: string | null;
    exercice_id?: string | null;
    devoir_id?: string | null;
    bilan_test_id?: string | null;
    context?: string;
    excluded: Array<{ titre?: string; reason?: string; details?: unknown }>;
    detected_issues?: unknown;
    action_taken: string;
  }
): Promise<void> {
  const { eleve_id, formateur_id, exercice_id, excluded, detected_issues, action_taken } = payload;

  // exercise_reports requiert eleve_id (NOT NULL). formateur_id et exercice_id sont conseillés.
  if (!eleve_id || !formateur_id) {
    console.warn(
      `[QA_AUTO] Skipped DB log (missing eleve_id/formateur_id). action=${action_taken} excluded=${excluded.length}`,
      { excluded, detected_issues }
    );
    return;
  }

  try {
    await supabase.from("exercise_reports").insert({
      eleve_id,
      formateur_id,
      exercice_id: exercice_id ?? null,
      devoir_id: payload.devoir_id ?? null,
      bilan_test_id: payload.bilan_test_id ?? null,
      context: payload.context ?? "qa_auto",
      status: "nouveau",
      ai_analysis: {
        source: "qa_auto",
        action_taken,
        excluded,
        detected_issues: detected_issues ?? null,
      },
      ai_problem_type: "contenu",
      ai_confidence: 0,
      ai_processed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[QA_AUTO] Failed to insert exercise_reports:", e);
  }
}
