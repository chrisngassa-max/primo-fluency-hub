/**
 * Feature flag client — Lot 3B-3 Phase B.
 * - explicit VITE_CAPTCF_ASSISTANT_AI_LIVE=true|false wins
 * - sinon : activé automatiquement en build production (import.meta.env.PROD)
 * Kill-switch serveur CAPTCF_ASSISTANT_AI_ENABLED reste obligatoire pour tout appel modèle.
 */
export function isAssistantAiLiveEnabled(): boolean {
  try {
    const explicit = import.meta.env.VITE_CAPTCF_ASSISTANT_AI_LIVE;
    if (explicit === "true") return true;
    if (explicit === "false") return false;
    return import.meta.env.PROD === true;
  } catch {
    return false;
  }
}

/** Modèle recommandé (préflight) — le moins coûteux adapté aux réponses courtes. */
export const RECOMMENDED_ASSISTANT_MODEL = "gemini-2.5-flash-lite";
export const RECOMMENDED_ASSISTANT_MODEL_LOVABLE = "google/gemini-2.5-flash-lite";
