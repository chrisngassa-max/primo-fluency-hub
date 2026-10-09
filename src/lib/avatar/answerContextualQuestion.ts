import { answerAvatarQuestion } from "./answerAvatarQuestion";
import { answerPedagogicalQuestion } from "./answerPedagogicalQuestion";
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
import {
  ASSISTANT_LIMITS,
  canConsumeAssistantQuota,
  recordAssistantConsumption,
  truncateForAssistant,
  withTimeout,
} from "./assistantLimits";
import type { AssistantConsentStatus } from "./assistantConsent";
import {
  isAccueilQuestion,
  modeFromStudentPath,
  navigationSnapshotFromPage,
  orchestrateAccueil,
} from "../../../supabase/functions/_shared/assistant-accueil/orchestrate";
import {
  answerPageOrientation,
  isPageOrientationQuestion,
} from "./answerPageOrientation";
import { isFormateurOrAdminPath } from "./eleveRouteCatalog";

export type AnswerContextualOptions = {
  helpCategory?: "technique";
  intent?: PedagogicalIntent | null;
  /** Injection tests uniquement. */
  provider?: AssistantAiProvider;
  /** false = non authentifié (refusé pour chemin IA). Défaut true en UI élève. */
  authenticated?: boolean;
  /** Consentement Aide IA (localStorage). Défaut : undecided → FAQ seulement pour IA. */
  assistantConsent?: AssistantConsentStatus;
  /**
   * Si true, autorise le provider local déterministe même sans consentement Aide
   * (comportement 3B-2). Pour le chemin « Edge / IA réelle », laisser false.
   */
  allowLocalWithoutConsent?: boolean;
  /** Compteur quota injectable (tests). */
  canConsume?: () => boolean;
  recordConsume?: () => void;
  /** Timeout provider injectable (tests). */
  timeoutMs?: number;
  /** uid de session, uniquement pour l'accueil local. Jamais recopié vers le modèle. */
  authUserId?: string | null;
  pagePath?: string | null;
  ownDevoirs?: {
    id: string;
    titre: string;
    statut: "en_attente" | "fait" | "expire" | "arrete";
    eleveId: string;
  }[];
};

/**
 * Orchestrateur : auth → consent → quota → contexte S01 → provider → FAQ fallback.
 * Phase A : aucun appel payant par défaut (provider local / flag live OFF).
 */
export async function answerContextualQuestion(
  question: string,
  context: AidePedagogiqueContext = DEFAULT_AIDE_CONTEXT,
  options: AnswerContextualOptions = {},
): Promise<ContextualAssistantAnswer> {
  const disclaimer = getPilotDisclaimer();
  const niveau = context.niveau ?? "A2";
  const trimmed = truncateForAssistant(question, ASSISTANT_LIMITS.maxQuestionChars);
  const authenticated = options.authenticated !== false;
  const consent: AssistantConsentStatus = options.assistantConsent ?? "undecided";
  const allowLocalWithoutConsent = options.allowLocalWithoutConsent ?? true;

  if (!trimmed) {
    return {
      text: "Écris une question courte sur la séance ou l’exercice.",
      intent: "faq_fallback",
      uncertain: true,
      refused: false,
      source: "faq",
      niveau,
      disclaimer,
      aiInvoked: false,
    };
  }

  if (!authenticated) {
    return {
      text: "Connecte-toi pour utiliser l’assistant Aide.",
      intent: "refuse_auth",
      uncertain: false,
      refused: true,
      source: "refuse",
      niveau,
      disclaimer,
      aiInvoked: false,
    };
  }

  if (isFormateurOrAdminPath(options.pagePath)) {
    return {
      text: "Cette page n’est pas dans l’espace élève. Je ne peux pas t’y aider.",
      intent: "refuse_auth",
      uncertain: false,
      refused: true,
      source: "refuse",
      niveau,
      disclaimer,
      aiInvoked: false,
    };
  }

  if (context.pedagogical) {
    return answerPedagogicalQuestion(
      trimmed,
      context.pedagogical,
      niveau,
      options.helpCategory,
      options.intent,
    );
  }

  // Lot 2A.4 — orientation par page (déterministe, sans invention).
  if (isPageOrientationQuestion(trimmed)) {
    const pending = (options.ownDevoirs ?? []).filter(
      (devoir) => devoir.eleveId === options.authUserId && devoir.statut === "en_attente",
    );
    const oriented = answerPageOrientation(trimmed, options.pagePath, {
      niveau,
      authenticated,
      facts: {
        devoirsPendingCount: options.ownDevoirs ? pending.length : null,
        prochaineSeanceTitre: context.sessionTitre,
        activiteTitre: context.exerciceTitre,
        objectif: context.objectif,
      },
    });
    if (oriented) return oriented;
  }

  if (options.authUserId && isAccueilQuestion(trimmed)) {
    const mode = modeFromStudentPath(options.pagePath);
    const snapshot = navigationSnapshotFromPage({
      authUserId: options.authUserId,
      mode,
      niveau,
      sessionCode: context.sessionCode,
      sessionTitre: context.sessionTitre,
      activityTitle: context.exerciceTitre,
      activityRoute: context.exerciceTitre ? options.pagePath ?? null : null,
      evaluationRoute: mode === "evaluation" ? options.pagePath ?? null : null,
      pagePath: options.pagePath,
      devoirs: (options.ownDevoirs ?? []).filter((devoir) => devoir.eleveId === options.authUserId),
    });
    const result = orchestrateAccueil({
      authUserId: options.authUserId,
      snapshot,
      question: trimmed,
      realAiAllowed: false,
    });
    return {
      text: result.publicResponse.text,
      intent: result.publicResponse.provider === "faq_fallback" ? "faq_fallback" : "accueil",
      uncertain: result.publicResponse.visibleFallback,
      refused: result.refused,
      source: result.publicResponse.provider === "faq_fallback" ? "faq" : "contextual",
      niveau,
      disclaimer,
      aiInvoked: false,
      provider: result.publicResponse.provider,
      openRoute: result.tool?.allowed ? result.tool.route ?? null : null,
      visibleFallback: result.publicResponse.visibleFallback,
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
      aiInvoked: false,
    };
  }

  const intent = detectPedagogicalIntent(trimmed, options.intent);
  const provider = options.provider ?? resolveAssistantProvider();
  const isEdgeLike = provider.id.startsWith("edge_");

  // Consentement Aide : obligatoire pour tout provider Edge / IA réelle.
  // FAQ toujours disponible si refus / undecided.
  if (isEdgeLike && consent !== "accepted") {
    return faqFallback(trimmed, niveau, disclaimer, "refuse_consent");
  }

  if (!isEdgeLike && !allowLocalWithoutConsent && consent !== "accepted") {
    return faqFallback(trimmed, niveau, disclaimer, "refuse_consent");
  }

  if (!provider.available) {
    return faqFallback(trimmed, niveau, disclaimer);
  }

  const canConsume = options.canConsume ?? canConsumeAssistantQuota;
  const recordConsume = options.recordConsume ?? recordAssistantConsumption;

  if (isEdgeLike && !canConsume()) {
    return {
      text:
        "Tu as atteint la limite de questions IA pour aujourd’hui. Utilise la FAQ locale ou réessaie demain.",
      intent: "refuse_quota",
      uncertain: false,
      refused: true,
      source: "refuse",
      niveau,
      disclaimer,
      aiInvoked: false,
    };
  }

  const prepared = prepareAssistantRequest({
    question: trimmed,
    intent,
    context,
    providerMode: isEdgeLike ? "edge_prepared" : "local_deterministic",
  });

  if (!prepared) {
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
        aiInvoked: false,
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
      aiInvoked: false,
    };
  }

  try {
    const result = await withTimeout(
      provider.generate(prepared),
      options.timeoutMs ?? ASSISTANT_LIMITS.providerTimeoutMs,
      "provider_timeout",
    );
    const text = truncateForAssistant(result.text, ASSISTANT_LIMITS.maxResponseChars);
    if (result.provider === "faq_fallback") {
      return {
        text,
        intent: "faq_fallback",
        uncertain: true,
        refused: false,
        source: "faq",
        niveau: prepared.niveau,
        disclaimer,
        aiInvoked: false,
        provider: "faq_fallback",
        visibleFallback: true,
      };
    }
    if (isEdgeLike) recordConsume();
    return {
      text,
      intent,
      uncertain: result.uncertain,
      refused: false,
      source: "contextual",
      niveau: prepared.niveau,
      disclaimer,
      aiInvoked: isEdgeLike,
    };
  } catch {
    return faqFallback(trimmed, niveau, disclaimer);
  }
}

function faqFallback(
  question: string,
  niveau: ContextualAssistantAnswer["niveau"],
  disclaimer: string,
  intent: ContextualAssistantAnswer["intent"] = "faq_fallback",
): ContextualAssistantAnswer {
  const faq = answerAvatarQuestion(question, "answer");
  return {
    text: faq.text,
    intent: intent === "refuse_consent" ? "refuse_consent" : "faq_fallback",
    uncertain: true,
    refused: intent === "refuse_consent" ? false : faq.refused,
    source: "faq",
    niveau,
    disclaimer: faq.disclaimer || disclaimer,
    aiInvoked: false,
    provider: "faq_fallback",
    visibleFallback: true,
  };
}
