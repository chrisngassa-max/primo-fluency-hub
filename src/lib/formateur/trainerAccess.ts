/**
 * Miroir logique des politiques RLS Lot 5 (tests locaux, sans base distante).
 * session_live_events SELECT : formateur du groupe de la session (ou élève propriétaire).
 * exercise_attempts SELECT formateur : exercices.formateur_id = auth.uid().
 * Ne pas élargir les droits élève.
 */

export type SessionOwnership = {
  sessionId: string;
  formateurId: string;
};

export type ExerciseOwnership = {
  exerciseId: string;
  formateurId: string;
};

export function canFormateurReadLiveEvent(input: {
  formateurId: string;
  event: { session_id: string | null; eleve_id: string };
  sessionsOwned: SessionOwnership[];
}): boolean {
  if (!input.formateurId || !input.event.session_id) return false;
  return input.sessionsOwned.some(
    (s) => s.sessionId === input.event.session_id && s.formateurId === input.formateurId,
  );
}

/** Lecture formateur des indices journalisés sur un devoir (y compris sans session). */
export function canFormateurReadDevoirHelpEvent(input: {
  formateurId: string;
  event: { devoir_id: string | null; eleve_id: string };
  devoirsOwned: Array<{ devoirId: string; formateurId: string }>;
}): boolean {
  if (!input.formateurId || !input.event.devoir_id) return false;
  return input.devoirsOwned.some(
    (d) => d.devoirId === input.event.devoir_id && d.formateurId === input.formateurId,
  );
}

export function canFormateurReadAttempt(input: {
  formateurId: string;
  attempt: { exercise_id: string; learner_id: string };
  exercisesOwned: ExerciseOwnership[];
}): boolean {
  if (!input.formateurId) return false;
  return input.exercisesOwned.some(
    (e) => e.exerciseId === input.attempt.exercise_id && e.formateurId === input.formateurId,
  );
}

export function filterHelpEventsForFormateur<T extends { session_id: string | null; eleve_id: string }>(
  events: T[],
  formateurId: string,
  sessionsOwned: SessionOwnership[],
): T[] {
  return events.filter((event) =>
    canFormateurReadLiveEvent({ formateurId, event, sessionsOwned }),
  );
}
