import { answerAvatarQuestion } from "./answerAvatarQuestion";
import {
  detectPedagogicalIntent,
  isEvaluationAnswerRequest,
} from "./detectPedagogicalIntent";
import {
  getPilotDisclaimer,
  prepareAssistantRequest,
} from "./prepareAssistantRequest";
import { resolveAssistantProvider } from "./providers/resolveProvider";
import type { AssistantAiProvider } from "./providers/types";
import type {
  AidePedagogiqueContext,
  ContextualAssistantAnswer,
  PedagogicalIntent,
} from "./pedagogicalTypes";
import { DEFAULT_AIDE_CONTEXT } from "./pedagogicalTypes";

export type AnswerContextualOptions = {
  intent?: PedagogicalIntent | null;
  /** Injection tests uniquement. */
  provider?: AssistantAiProvider;
};

/**
 * Orchestrateur MVP : contexte S01 → provider local → FAQ fallback.
 * Aucun appel réseau par défaut.
 */
export async function answerContextualQuestion(
  question: string,
  context: AidePedagogiqueContext = DEFAULT_AIDE_CONTEXT,
  options: AnswerContextualOptions = {},
): Promise<ContextualAssistantAnswer> {
  const disclaimer = getPilotDisclaimer();
  const niveau = context.niveau ?? "A2";
  const trimmed = question.trim();

  if (!trimmed) {
    return {
      text: "Écris une question courte sur la séance ou l’exercice.",
      intent: "faq_fallback",
      uncertain: true,
      refused: false,
      source: "faq",
      niveau,
      disclaimer,
    };
  }

  if (isEvaluationAnswerRequest(trimmed)) {
    return {
      text:
        "Je ne fournis pas la réponse d’une évaluation. Je peux expliquer la consigne, reformuler, donner un exemple, un indice ou un mini-exercice — sans spoiler.",
      intent: "refuse_evaluation",
      uncertain: false,
      refused: true,
      source: "refuse",
      niveau,
      disclaimer,
    };
  }

  const intent = detectPedagogicalIntent(trimmed, options.intent);
  const provider = options.provider ?? resolveAssistantProvider();

  if (!provider.available) {
    return faqFallback(trimmed, niveau, disclaimer);
  }

  const prepared = prepareAssistantRequest({
    question: trimmed,
    intent,
    context,
    providerMode: "local_deterministic",
  });

  if (!prepared) {
    // Hors séance pilote S01 → FAQ locale (pas d’invention).
    const faq = answerAvatarQuestion(trimmed, "answer");
    if (faq.intent === "fallback" || faq.uncertain) {
      return {
        text:
          "Je n’ai pas assez de sources validées pour cette séance. Pose ta question sur la séance pilote S01, ou utilise la FAQ (consigne, TCF, lexique).",
        intent: "refuse_sources",
        uncertain: true,
        refused: true,
        source: "refuse",
        niveau,
        disclaimer,
      };
    }
    return {
      text: faq.text,
      intent: "faq_fallback",
      uncertain: faq.uncertain,
      refused: faq.refused,
      source: "faq",
      niveau,
      disclaimer: faq.disclaimer,
    };
  }

  try {
    const result = await provider.generate(prepared);
    return {
      text: result.text,
      intent,
      uncertain: result.uncertain,
      refused: false,
      source: "contextual",
      niveau: prepared.niveau,
      disclaimer,
    };
  } catch {
    return faqFallback(trimmed, niveau, disclaimer);
  }
}

function faqFallback(
  question: string,
  niveau: ContextualAssistantAnswer["niveau"],
  disclaimer: string,
): ContextualAssistantAnswer {
  const faq = answerAvatarQuestion(question, "answer");
  return {
    text: faq.text,
    intent: "faq_fallback",
    uncertain: faq.uncertain || true,
    refused: faq.refused,
    source: "faq",
    niveau,
    disclaimer: faq.disclaimer || disclaimer,
  };
}
