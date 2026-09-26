import type { PreparedAssistantRequest } from "../pedagogicalTypes";
import type { AssistantAiProvider, AssistantProviderResult } from "./types";
import { isAssistantAiLiveEnabled } from "../assistantFeatureFlags";
import { ASSISTANT_LIMITS, truncateForAssistant } from "../assistantLimits";

/**
 * Provider Edge réel (préparé) — n’appelle le réseau que si le flag live est ON.
 * Phase A : flag OFF → available=false → orchestrateur FAQ / local.
 * Import Supabase lazy pour ne pas casser les tests unitaires hors env.
 */
export function createEdgeAssistantProvider(options?: {
  /** Injection tests : forcer available. */
  forceAvailable?: boolean;
  /** Injection tests : remplacer l’invoke. */
  invokeFn?: (body: PreparedAssistantRequest) => Promise<{ text: string; uncertain?: boolean }>;
}): AssistantAiProvider {
  const live = options?.forceAvailable ?? isAssistantAiLiveEnabled();

  return {
    id: "edge_captcf_assistant_qa",
    available: live,
    async generate(request: PreparedAssistantRequest): Promise<AssistantProviderResult> {
      if (!live && !options?.invokeFn) {
        throw new Error("edge_assistant_not_live");
      }

      const payload: PreparedAssistantRequest = {
        ...request,
        meta: { ...request.meta, provider_mode: "edge_prepared" },
      };

      if (options?.invokeFn) {
        const data = await options.invokeFn(payload);
        return {
          text: truncateForAssistant(data.text ?? "", ASSISTANT_LIMITS.maxResponseChars),
          uncertain: Boolean(data.uncertain),
        };
      }

      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("captcf-assistant-qa", {
        body: { request: payload },
      });

      if (error) throw error;
      if (!data?.text || typeof data.text !== "string") {
        throw new Error("edge_assistant_empty");
      }

      return {
        text: truncateForAssistant(data.text, ASSISTANT_LIMITS.maxResponseChars),
        uncertain: Boolean(data.uncertain),
      };
    },
  };
}
