import type { AssistantAiProvider } from "./types";
import { createLocalDeterministicProvider } from "./localDeterministicProvider";
import { createEdgeAssistantProvider } from "./edgeAssistantProvider";
import { isAssistantAiLiveEnabled } from "../assistantFeatureFlags";
import { getAssistantAiConsent } from "../assistantConsent";

/**
 * Résout le fournisseur.
 * Phase A : live flag OFF → toujours local déterministe (0 appel payant).
 * Phase B (après autorisation) : Edge si consentement Aide accepté + flag live.
 */
export function resolveAssistantProvider(options?: {
  preferEdge?: boolean;
}): AssistantAiProvider {
  const live = isAssistantAiLiveEnabled();
  const consentOk = getAssistantAiConsent() === "accepted";
  if (live && consentOk && options?.preferEdge !== false) {
    return createEdgeAssistantProvider();
  }
  return createLocalDeterministicProvider();
}

export type { AssistantAiProvider } from "./types";
