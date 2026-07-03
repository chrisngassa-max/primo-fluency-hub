export interface LiveEventInput {
  sessionId: string;
  eleveId: string;
  exerciceId: string;
  competence: string;
  score: number;
  incorrect: Array<{ idx: number; question: string; reponse: string; bonne: string }>;
  classifications: Map<number, string>;
  correctCount: number;
}

/** Pure builder — competence must be set on the column, not only in payload. */
export function buildLiveEventsToInsert(opts: LiveEventInput): Record<string, unknown>[] {
  const {
    sessionId, eleveId, exerciceId, competence, score,
    incorrect, classifications, correctCount,
  } = opts;

  const events: Record<string, unknown>[] = [];

  for (const err of incorrect) {
    events.push({
      session_id: sessionId,
      eleve_id: eleveId,
      event_type: "reponse_incorrecte",
      competence,
      type_erreur_id: classifications.get(err.idx) ?? null,
      payload: {
        exercice_id: exerciceId,
        competence,
        item_idx: err.idx,
        question: err.question,
        reponse: err.reponse,
      },
    });
  }

  if (correctCount > 0) {
    events.push({
      session_id: sessionId,
      eleve_id: eleveId,
      event_type: "reponse_correcte",
      competence,
      payload: {
        exercice_id: exerciceId,
        competence,
        correct_count: correctCount,
        score,
      },
    });
  }

  return events;
}
