import type { AssistantAiProvider } from "./types";
import { createLocalDeterministicProvider } from "./localDeterministicProvider";

/**
 * Résout le fournisseur IA de l’assistant pédagogique.
 *
 * Lot 3B-2 : aucun fournisseur gratuit/sûr n’est branché côté client.
 * L’infra Edge (`ai-client.ts` + LOVABLE/GEMINI) existe mais **ne doit pas**
 * être appelée sans autorisation coût / consentement. On s’arrête donc sur
 * le faux fournisseur local déterministe.
 */
export function resolveAssistantProvider(): AssistantAiProvider {
  // Stop explicite avant tout appel réel / payant.
  return createLocalDeterministicProvider();
}

export type { AssistantAiProvider } from "./types";
