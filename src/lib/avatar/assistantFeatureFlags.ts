/**
 * Feature flag client — Phase A : toujours faux en prod tant que Phase B non autorisée.
 * Ne jamais activer sans autorisation explicite de déploiement + secrets.
 */
export function isAssistantAiLiveEnabled(): boolean {
  try {
    return import.meta.env.VITE_CAPTCF_ASSISTANT_AI_LIVE === "true";
  } catch {
    return false;
  }
}

/** Modèle recommandé (préflight) — le moins coûteux adapté aux réponses courtes. */
export const RECOMMENDED_ASSISTANT_MODEL = "gemini-2.5-flash-lite";
export const RECOMMENDED_ASSISTANT_MODEL_LOVABLE = "google/gemini-2.5-flash-lite";
