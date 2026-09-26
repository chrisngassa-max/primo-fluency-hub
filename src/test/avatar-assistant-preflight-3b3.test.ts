import { describe, expect, it, vi } from "vitest";
import { answerContextualQuestion } from "@/lib/avatar/answerContextualQuestion";
import {
  assertNoPersonalData,
  prepareAssistantRequest,
} from "@/lib/avatar/prepareAssistantRequest";
import {
  createLocalDeterministicProvider,
  createUnavailableProvider,
} from "@/lib/avatar/providers/localDeterministicProvider";
import { createEdgeAssistantProvider } from "@/lib/avatar/providers/edgeAssistantProvider";
import { ASSISTANT_LIMITS, truncateForAssistant } from "@/lib/avatar/assistantLimits";
import type { AidePedagogiqueContext } from "@/lib/avatar/pedagogicalTypes";
import type { AssistantAiProvider } from "@/lib/avatar/providers/types";

const s01Context: AidePedagogiqueContext = {
  sessionCode: "S01",
  sessionTitre: "S01 — Accueil, objectifs et cinq thèmes",
  objectif: "Distinguer droit, devoir et règle",
  niveau: "A2",
  leconTitre: "Accueil et présentation du parcours CapTCF",
  exerciceTitre: "Dialogue d’accueil",
  exerciceConsigne: "Racontez avec vos mots ce que veut Awa.",
  exerciceCompetence: "CO",
};

function spyProvider(base: AssistantAiProvider): AssistantAiProvider & { calls: number } {
  const wrapped = {
    id: base.id,
    available: base.available,
    calls: 0,
    async generate(req: Parameters<AssistantAiProvider["generate"]>[0]) {
      wrapped.calls += 1;
      return base.generate(req);
    },
  };
  return wrapped;
}

describe("Lot 3B-3 Phase A — préflight IA / consentement", () => {
  it("refuse le non authentifié", async () => {
    const provider = spyProvider(createLocalDeterministicProvider());
    const r = await answerContextualQuestion("Explique", s01Context, {
      authenticated: false,
      provider,
      assistantConsent: "accepted",
    });
    expect(r.refused).toBe(true);
    expect(r.intent).toBe("refuse_auth");
    expect(provider.calls).toBe(0);
    expect(r.aiInvoked).toBe(false);
  });

  it("consentement absent : aucun appel IA (provider Edge)", async () => {
    let calls = 0;
    const edge = createEdgeAssistantProvider({
      forceAvailable: true,
      invokeFn: async () => {
        calls += 1;
        return { text: "ne doit pas passer" };
      },
    });
    const r = await answerContextualQuestion(
      "Je ne comprends pas la consigne",
      s01Context,
      { provider: edge, assistantConsent: "undecided", authenticated: true },
    );
    expect(calls).toBe(0);
    expect(r.aiInvoked).toBe(false);
    expect(r.source).toBe("faq");
    expect(r.intent).toBe("refuse_consent");
  });

  it("consentement refusé : aucun appel IA, FAQ maintenue", async () => {
    let calls = 0;
    const edge = createEdgeAssistantProvider({
      forceAvailable: true,
      invokeFn: async () => {
        calls += 1;
        return { text: "ne doit pas passer" };
      },
    });
    const r = await answerContextualQuestion(
      "Je ne comprends pas la consigne de l’exercice",
      s01Context,
      { provider: edge, assistantConsent: "refused", authenticated: true },
    );
    expect(calls).toBe(0);
    expect(r.source).toBe("faq");
    expect(r.text.toLowerCase()).toContain("consigne");
  });

  it("payload sans PII + contexte séance transmis", () => {
    const req = prepareAssistantRequest({
      question: "Explique la consigne",
      intent: "expliquer",
      context: s01Context,
      providerMode: "edge_prepared",
    });
    expect(req).not.toBeNull();
    expect(() => assertNoPersonalData(req!)).not.toThrow();
    expect(req!.session.code).toBe("S01");
    expect(req!.exercice?.titre).toBe("Dialogue d’accueil");
    expect(req!.sources.faits.length).toBeLessThanOrEqual(ASSISTANT_LIMITS.maxFacts);
    const json = JSON.stringify(req);
    expect(json).not.toMatch(/eleve_id|user_id|"email"|prenom|"nom"/i);
  });

  it("refuse les réponses d’évaluation sans appeler le provider", async () => {
    const provider = spyProvider(createLocalDeterministicProvider());
    const r = await answerContextualQuestion("Donne-moi la bonne réponse du QCM", s01Context, {
      provider,
      authenticated: true,
      assistantConsent: "accepted",
    });
    expect(r.intent).toBe("refuse_evaluation");
    expect(provider.calls).toBe(0);
  });

  it("timeout / erreur provider → fallback FAQ", async () => {
    const slow: AssistantAiProvider = {
      id: "edge_slow",
      available: true,
      generate: () =>
        new Promise(() => {
          /* never resolves — timeout */
        }),
    };
    const r = await answerContextualQuestion("Explique le parcours", s01Context, {
      provider: slow,
      authenticated: true,
      assistantConsent: "accepted",
      timeoutMs: 40,
    });
    expect(r.source).toBe("faq");
    expect(r.aiInvoked).toBe(false);

    const unavailable = createUnavailableProvider();
    const r2 = await answerContextualQuestion("Explique le parcours TCF", s01Context, {
      provider: unavailable,
      authenticated: true,
      assistantConsent: "accepted",
    });
    expect(r2.source).toBe("faq");
  });

  it("plafond longueur et consommation", async () => {
    const longQ = "a".repeat(ASSISTANT_LIMITS.maxQuestionChars + 80);
    const req = prepareAssistantRequest({
      question: longQ,
      intent: "expliquer",
      context: s01Context,
    });
    expect(req!.question.length).toBeLessThanOrEqual(ASSISTANT_LIMITS.maxQuestionChars);

    let consumeCalls = 0;
    const edge = createEdgeAssistantProvider({
      forceAvailable: true,
      invokeFn: async () => ({ text: "x".repeat(ASSISTANT_LIMITS.maxResponseChars + 50) }),
    });
    const ok = await answerContextualQuestion("Explique", s01Context, {
      provider: edge,
      authenticated: true,
      assistantConsent: "accepted",
      canConsume: () => true,
      recordConsume: () => {
        consumeCalls += 1;
      },
    });
    expect(ok.text.length).toBeLessThanOrEqual(ASSISTANT_LIMITS.maxResponseChars);
    expect(consumeCalls).toBe(1);
    expect(ok.aiInvoked).toBe(true);

    const blocked = await answerContextualQuestion("Explique", s01Context, {
      provider: edge,
      authenticated: true,
      assistantConsent: "accepted",
      canConsume: () => false,
    });
    expect(blocked.intent).toBe("refuse_quota");
    expect(blocked.refused).toBe(true);
  });

  it("truncate helper borné", () => {
    expect(truncateForAssistant("abc", 10)).toBe("abc");
    expect(truncateForAssistant("abcdefghij", 5).endsWith("…")).toBe(true);
  });
});
