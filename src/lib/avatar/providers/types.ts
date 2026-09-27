import type { PreparedAssistantRequest } from "../pedagogicalTypes";

export type AssistantProviderResult = {
  text: string;
  uncertain: boolean;
  /** Présent quand l'Edge répond par la FAQ, sans appel modèle. */
  provider?: "faq_fallback" | "server_context";
};

/**
 * Interface fournisseur IA remplaçable.
 * Implémentations futures : Edge Function (LOVABLE/GEMINI côté serveur).
 * Lot 3B-2 : aucun appel réel — LocalDeterministicProvider uniquement.
 */
export interface AssistantAiProvider {
  readonly id: string;
  readonly available: boolean;
  generate(request: PreparedAssistantRequest): Promise<AssistantProviderResult>;
}
