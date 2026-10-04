// Fail closed: this exception covers only written, objective exercises.
export function isDeterministicWrittenHomework(exercise: any): boolean {
  if (!exercise || !['CE', 'Structures'].includes(exercise.competence)
    || !['qcm', 'vrai_faux', 'appariement', 'texte_lacunaire', 'transformation'].includes(exercise.format)) return false;
  const items = exercise.contenu?.items;
  return Array.isArray(items) && items.length > 0 && items.every((item: any) => {
    if (!item || typeof item.bonne_reponse !== 'string' || !item.bonne_reponse.trim()) return false;
    // Same AI-template boundary as the server corrector; options make comparison objective.
    if (Array.isArray(item.options) && item.options.length > 0) return true;
    const answer = item.bonne_reponse;
    return answer.length <= 120 && !/\[[^\]]+\]/.test(answer)
      && !/^(le candidat|l['’]apprenant|l['’]élève|l['’]eleve)\s+(doit|devra)/i.test(answer.trim());
  });
}

export function consentCapabilities(consent: { consent_ai: boolean; consent_biometric: boolean; revoked_at: string | null } | null) {
  const active = !!consent && !consent.revoked_at;
  return { ai: active && consent.consent_ai, voice: active && consent.consent_biometric };
}

export function consentTimestamps(ai: boolean, voice: boolean, now: string) {
  return { consented_at: ai || voice ? now : null, revoked_at: ai || voice ? null : now };
}
