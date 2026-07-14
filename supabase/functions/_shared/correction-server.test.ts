// Lot 2 — corrigerExerciceServer() doit continuer d'accepter une réponse
// simple (chaîne, comportement historique) ET une réponse structurée
// { reponse, justification } (items portant justification_prompt, B1/B2),
// sans jamais utiliser la justification pour le calcul de `correct`.
import { describe, expect, it } from "vitest";
import { corrigerExerciceServer } from "./correction-server.ts";

const QCM_ITEM = {
  question: "Comment s'appelle l'apprenante ?",
  options: ["Awa Diallo", "Awa Rossi", "Fatou Diallo"],
  bonne_reponse: "Awa Diallo",
  explication: "Elle se présente dans le dialogue.",
};

const baseOpts = {
  format: "qcm",
  competence: "CO",
  items: [QCM_ITEM],
  supabaseUrl: "https://example.invalid",
  serviceRoleKey: "test-key",
};

describe("corrigerExerciceServer — réponses structurées (Lot 2)", () => {
  it("continue d'accepter une réponse simple (chaîne) — comportement historique inchangé", async () => {
    const result = await corrigerExerciceServer({ ...baseOpts, answers: { 0: "Awa Diallo" } });
    expect(result.correction[0].correct).toBe(true);
    expect(result.correction[0].reponse_eleve).toBe("Awa Diallo");
    expect(result.correction[0].learner_justification).toBeUndefined();
  });

  it("accepte une réponse structurée { reponse, justification } et note reponse_eleve/correct sur `reponse` uniquement", async () => {
    const result = await corrigerExerciceServer({
      ...baseOpts,
      answers: { 0: { reponse: "Awa Diallo", justification: "Elle le dit explicitement au début du dialogue." } },
    });
    expect(result.correction[0].correct).toBe(true);
    expect(result.correction[0].reponse_eleve).toBe("Awa Diallo");
    expect(result.correction[0].learner_justification).toBe("Elle le dit explicitement au début du dialogue.");
  });

  it("une justification vide ou absente dans l'objet structuré ne produit pas learner_justification", async () => {
    const result = await corrigerExerciceServer({
      ...baseOpts,
      answers: { 0: { reponse: "Awa Diallo", justification: "   " } },
    });
    expect(result.correction[0].learner_justification).toBeUndefined();
  });

  it("la justification n'influence jamais la correction : une mauvaise réponse reste fausse même avec une bonne justification", async () => {
    const result = await corrigerExerciceServer({
      ...baseOpts,
      answers: { 0: { reponse: "Fatou Diallo", justification: "Elle se présente au début du dialogue." } },
    });
    expect(result.correction[0].correct).toBe(false);
    expect(result.correction[0].learner_justification).toBe("Elle se présente au début du dialogue.");
  });

  it("un tableau en valeur de answers[idx] n'est pas traité comme une réponse structurée (garde-fou Array.isArray)", async () => {
    const result = await corrigerExerciceServer({ ...baseOpts, answers: { 0: ["Awa Diallo"] } });
    // Un tableau n'est ni une chaîne ni l'objet {reponse, justification}
    // attendu : converti tel quel via toString(), ne doit pas planter.
    expect(typeof result.correction[0].reponse_eleve).toBe("string");
  });

  it("tentative d'injection de correction : correct/score/bonne_reponse ajoutés par un client malveillant dans la réponse structurée sont ignorés — le résultat reste recalculé depuis item.bonne_reponse", async () => {
    const result = await corrigerExerciceServer({
      ...baseOpts,
      answers: {
        0: {
          reponse: "Fatou Diallo", // mauvaise réponse
          justification: "peu importe",
          correct: true, // injection
          score: 100, // injection
          bonne_reponse: "Fatou Diallo", // tentative de réécrire le corrigé
        },
      },
    });
    expect(result.correction[0].correct).toBe(false);
    expect(result.correction[0].bonne_reponse).toBe(QCM_ITEM.bonne_reponse);
    expect(result.score).toBe(0);
  });

  it("compatibilité du reporting : la forme de ServerCorrectionItem reste stable (learner_justification additif, tous les champs historiques présents)", async () => {
    const result = await corrigerExerciceServer({ ...baseOpts, answers: { 0: "Awa Diallo" } });
    const entry = result.correction[0];
    for (const key of ["question", "reponse_eleve", "bonne_reponse", "correct", "explication"]) {
      expect(entry, key).toHaveProperty(key);
    }
    expect(entry.question).toBe(QCM_ITEM.question);
    expect(entry.bonne_reponse).toBe(QCM_ITEM.bonne_reponse);
    expect(entry.explication).toBe(QCM_ITEM.explication);
    expect(typeof result.score).toBe("number");
    expect(typeof result.countedItems).toBe("number");
    expect(typeof result.correctCount).toBe("number");
  });
});
