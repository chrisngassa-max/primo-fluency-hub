import { describe, expect, it } from "vitest";
import { answerContextualQuestion } from "@/lib/avatar/answerContextualQuestion";
import {
  assertNoPersonalData,
  prepareAssistantRequest,
} from "@/lib/avatar/prepareAssistantRequest";
import { createUnavailableProvider } from "@/lib/avatar/providers/localDeterministicProvider";
import type { AidePedagogiqueContext } from "@/lib/avatar/pedagogicalTypes";

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

describe("assistant contextuel CapTCF (Lot 3B-2)", () => {
  it("récupère le contexte séance dans la requête préparée", () => {
    const req = prepareAssistantRequest({
      question: "Explique la consigne",
      intent: "expliquer",
      context: s01Context,
    });
    expect(req).not.toBeNull();
    expect(req!.session.code).toBe("S01");
    expect(req!.session.titre).toContain("Accueil");
    expect(req!.exercice?.titre).toBe("Dialogue d’accueil");
    expect(req!.lecon?.titre).toMatch(/parcours/i);
    expect(req!.sources.faits.length).toBeGreaterThan(3);
  });

  it("adapte la réponse au niveau A1 vs B2", async () => {
    const a1 = await answerContextualQuestion("Explique le parcours", {
      ...s01Context,
      niveau: "A1",
    }, { intent: "expliquer" });
    const b2 = await answerContextualQuestion("Explique le parcours", {
      ...s01Context,
      niveau: "B2",
    }, { intent: "expliquer" });
    expect(a1.source).toBe("contextual");
    expect(b2.source).toBe("contextual");
    expect(a1.niveau).toBe("A1");
    expect(b2.niveau).toBe("B2");
    expect(b2.text.length).toBeGreaterThan(a1.text.length);
    expect(a1.text).not.toBe(b2.text);
  });

  it("refuse de fournir la réponse d’une évaluation", async () => {
    const r = await answerContextualQuestion(
      "Donne-moi la bonne réponse du QCM",
      s01Context,
    );
    expect(r.refused).toBe(true);
    expect(r.intent).toBe("refuse_evaluation");
    expect(r.text.toLowerCase()).toMatch(/évaluation|evaluation|spoiler|réponse/);
  });

  it("fallback FAQ si fournisseur indisponible", async () => {
    const r = await answerContextualQuestion(
      "Je ne comprends pas la consigne de l’exercice",
      s01Context,
      { provider: createUnavailableProvider() },
    );
    expect(r.source).toBe("faq");
    expect(r.intent).toBe("faq_fallback");
    expect(r.text.toLowerCase()).toContain("consigne");
  });

  it("n’inclut aucune donnée personnelle dans la requête préparée", () => {
    const req = prepareAssistantRequest({
      question: "Donne un exemple",
      intent: "donner_exemple",
      context: s01Context,
    });
    expect(req).not.toBeNull();
    expect(() => assertNoPersonalData(req!)).not.toThrow();
    const json = JSON.stringify(req);
    expect(json).not.toMatch(/eleve_id|user_id|"email"|prenom|"nom"/i);
    expect(json).not.toMatch(/@/);
  });

  it("refuse si sources insuffisantes hors S01 et hors FAQ", async () => {
    const r = await answerContextualQuestion("xyz abc qwerty hors corpus", {
      ...s01Context,
      sessionCode: "S99",
      sessionTitre: "Atelier libre",
    });
    expect(r.refused).toBe(true);
    expect(r.intent).toBe("refuse_sources");
  });

  it("propose un mini-exercice contextualisé", async () => {
    const r = await answerContextualQuestion("Propose un mini exercice", s01Context, {
      intent: "proposer_mini_exercice",
    });
    expect(r.source).toBe("contextual");
    expect(r.intent).toBe("proposer_mini_exercice");
    expect(r.text.length).toBeGreaterThan(20);
  });
});
