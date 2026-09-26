/**
 * Consentement spécifique « Aide IA » — sans nouvelle table.
 * - Décision UI : localStorage (accept / refuse / undecided)
 * - Garde Edge (Phase B) : table existante `ai_processing_consents.consent_ai`
 */

export const ASSISTANT_CONSENT_STORAGE_KEY = "captcf_assistant_ai_consent_v1";
export const ASSISTANT_CONSENT_VERSION = "assistant-aide-v1";

export type AssistantConsentStatus = "accepted" | "refused" | "undecided";

export function getAssistantAiConsent(): AssistantConsentStatus {
  if (typeof localStorage === "undefined") return "undecided";
  const v = localStorage.getItem(ASSISTANT_CONSENT_STORAGE_KEY);
  if (v === "accepted" || v === "refused") return v;
  return "undecided";
}

export function setAssistantAiConsent(status: "accepted" | "refused"): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ASSISTANT_CONSENT_STORAGE_KEY, status);
}

export function clearAssistantAiConsent(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ASSISTANT_CONSENT_STORAGE_KEY);
}

/** Texte d’information simple (A1/A2). */
export const ASSISTANT_CONSENT_INFO = `L’assistant Aide peut utiliser une IA pour expliquer la séance.
L’IA reçoit seulement le contexte pédagogique (titre, objectif, niveau, consigne) — pas ton nom, email ni notes.
Tu peux refuser : tu gardes la FAQ locale sans IA.
Tu peux changer d’avis plus tard.`;
