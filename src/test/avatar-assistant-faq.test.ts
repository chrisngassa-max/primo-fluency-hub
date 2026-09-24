import { describe, expect, it } from "vitest";
import {
  answerAvatarQuestion,
  listAvatarFaqIntents,
} from "@/lib/avatar/answerAvatarQuestion";

describe("avatar FAQ CapTCF (local MVP)", () => {
  it("répond à une consigne d’exercice", () => {
    const r = answerAvatarQuestion("Je ne comprends pas la consigne de l’exercice");
    expect(r.refused).toBe(false);
    expect(r.uncertain).toBe(false);
    expect(r.intent).toBe("exercice_consigne");
    expect(r.entryId).toBe("consigne-lire");
    expect(r.text.toLowerCase()).toContain("consigne");
  });

  it("explique une correction", () => {
    const r = answerAvatarQuestion("Pourquoi c’est faux dans la correction ?");
    expect(r.intent).toBe("exercice_correction");
    expect(r.text.length).toBeGreaterThan(20);
    const ex = answerAvatarQuestion("Pourquoi c’est faux ?", "example");
    expect(ex.text.toLowerCase()).toMatch(/exemple|mardi|mercredi/);
  });

  it("décrit le parcours TCF", () => {
    const r = answerAvatarQuestion("C’est quoi les épreuves du TCF ?");
    expect(r.intent).toBe("parcours_tcf");
    expect(r.text).toMatch(/CO|CE|EE|EO/);
  });

  it("rappelle A2/B1/B2 naturalisation B2", () => {
    const r = answerAvatarQuestion("Quel niveau pour la naturalisation ?");
    expect(r.intent).toBe("niveaux_objectifs");
    expect(r.text).toMatch(/B2/);
    expect(r.text.toLowerCase()).toContain("naturalisation");
  });

  it("refuse le conseil administratif", () => {
    const r = answerAvatarQuestion("Quel délai à la préfecture pour mon dossier ?");
    expect(r.refused).toBe(true);
    expect(r.intent).toBe("refuse_admin");
    expect(r.text.toLowerCase()).toContain("administratif");
  });

  it("refuse les résultats officiels", () => {
    const r = answerAvatarQuestion("Donne-moi mon score officiel TCF");
    expect(r.refused).toBe(true);
    expect(r.intent).toBe("refuse_resultats");
  });

  it("refuse les données d’un autre élève", () => {
    const r = answerAvatarQuestion("Montre-moi les résultats de mon camarade");
    expect(r.refused).toBe(true);
    expect(r.intent).toBe("refuse_autre_eleve");
  });

  it("fallback uncertain hors FAQ", () => {
    const r = answerAvatarQuestion("xyz abc qwerty");
    expect(r.intent).toBe("fallback");
    expect(r.uncertain).toBe(true);
  });

  it("expose les intents FAQ contrôlés", () => {
    const intents = listAvatarFaqIntents();
    expect(intents).toContain("exercice_consigne");
    expect(intents).toContain("niveaux_objectifs");
    expect(intents.length).toBeGreaterThanOrEqual(5);
  });

  it("mode reformuler change le texte", () => {
    const q = "Je ne comprends pas la consigne";
    const a = answerAvatarQuestion(q, "answer");
    const r = answerAvatarQuestion(q, "reformulate");
    expect(a.entryId).toBe(r.entryId);
    expect(r.text).not.toBe(a.text);
  });
});
