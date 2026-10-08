/** Only fixed, reviewed messages may cross the server-to-teacher boundary. */
const conflict = 'La préparation a changé depuis votre dernière confirmation. Actualisez l’aperçu, puis confirmez de nouveau.';
const recipient = 'Vous ne pouvez pas envoyer ce devoir au groupe ou à l’élève sélectionné. Vérifiez le destinataire.';
const content = 'Au moins un exercice n’est pas prêt à être envoyé. Corrigez les éléments signalés, puis réessayez.';
const busy = 'Cet exercice est en cours de modification ou d’attribution. Réessayez dans un instant.';
const expired = 'Votre session a expiré. Reconnectez-vous avant d’envoyer le devoir.';
const forbidden = 'Vous n’avez pas l’autorisation d’effectuer cet envoi.';
const unknown = 'Le devoir n’a pas pu être envoyé. Aucun contenu n’a été créé. Réessayez ou actualisez la page.';
const messages: Readonly<Record<string, string>> = Object.freeze({
  homework_request_conflict: conflict,
  homework_request_required: conflict,
  homework_group_forbidden: recipient,
  homework_session_forbidden: recipient,
  homework_student_forbidden: recipient,
  homework_inexecutable: content,
  homework_invalid_entries: content,
  homework_invalid_entry: content,
  homework_empty_batch: content,
  homework_original_audio_use_manual: 'Cet exercice audio doit être attribué depuis le parcours manuel.',
  homework_exercise_busy: busy,
  homework_invalid_deadline: 'Choisissez une date limite valide située dans le futur.',
  homework_forbidden: forbidden,
  homework_isolation_unsupported: unknown,
  '55P03': busy,
  '42501': forbidden,
  PGRST301: expired,
  PGRST302: expired,
  PGRST303: expired,
  session_expired: expired,
  refresh_token_not_found: expired,
  refresh_token_already_used: expired,
  // Fixed local recovery errors: preserve the no-send explanation, never echo input.
  'État de reprise illisible. Aucun envoi effectué.': 'État de reprise illisible. Aucun envoi effectué.',
  'Reprise après rechargement indisponible dans ce navigateur. Aucun envoi effectué.':
    'Reprise après rechargement indisponible dans ce navigateur. Aucun envoi effectué.',
  'Réponse non confirmée. Réessayez le même lot pour vérifier son envoi sans doublon.':
    'Réponse non confirmée. Réessayez le même lot pour vérifier son envoi sans doublon.',
});

export function automaticHomeworkErrorMessage(error: unknown): string {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) return unknown;
  const fields: string[] = [];
  // Specific business messages take precedence over a generic SQLSTATE.
  for (const key of ['message', 'details', 'hint', 'code']) {
    try {
      const value: unknown = Reflect.get(error, key);
      if (typeof value === 'string') fields.push(value);
    } catch { /* An unexpected getter/proxy must not break the error handler. */ }
  }
  for (const value of fields) {
    if (Object.prototype.hasOwnProperty.call(messages, value)) return messages[value];
  }
  return unknown;
}
