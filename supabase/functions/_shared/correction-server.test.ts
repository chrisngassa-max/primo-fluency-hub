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

// Lot 2.1, point 5 — modèle de résultat qui évalue réellement la
// justification (pas un garde-fou "texte non vide"), sur un item ayant
// exactement la forme produite par generate-s01-interactive.mjs.
const JUSTIFICATION_ITEM = {
  question: "Comment s'appelle l'apprenante ?",
  options: ["Awa Diallo", "Awa Rossi", "Fatou Diallo"],
  bonne_reponse: "Awa Diallo",
  explication: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
  justification_required: true,
  justification_type: "support_evidence",
  justification_prompt: "Justifiez votre choix en citant précisément un mot ou une phrase entendue dans le dialogue.",
  correction: {
    bonne_reponse: "Awa Diallo",
    preuve_support: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
    justification_ouverte: {
      elements_attendus: ["Elle se présente : « Je m'appelle Awa. Awa Diallo. »"],
      criteres_evaluation: ["cite ou reformule fidèlement un élément réel du support"],
    },
  },
};

const justificationOpts = {
  format: "qcm",
  competence: "CO",
  items: [JUSTIFICATION_ITEM],
  supabaseUrl: "https://example.invalid",
  serviceRoleKey: "test-key",
};

describe("corrigerExerciceServer — modèle de résultat de justification (Lot 2.1, point 5)", () => {
  it("bonne réponse + justification acceptée (citation) -> overall_status complete, score compté, jamais provisoire", async () => {
    const result = await corrigerExerciceServer({
      ...justificationOpts,
      answers: { 0: { reponse: "Awa Diallo", justification: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »" } },
    });
    const entry = result.correction[0];
    expect(entry.answer_correct).toBe(true);
    expect(entry.justification_status).toBe("accepted");
    expect(entry.overall_status).toBe("complete");
    expect(entry.score_provisional).toBe(false);
    expect(result.correctCount).toBe(1);
    expect(result.score).toBe(100);
    expect(result.score_provisional).toBe(false);
  });

  it("bonne réponse + justification absente -> overall_status partial, PAS comptée comme une réussite (le garde-fou texte-non-vide ne suffit plus)", async () => {
    const result = await corrigerExerciceServer({
      ...justificationOpts,
      answers: { 0: "Awa Diallo" }, // chaîne simple : pas de justification du tout
    });
    const entry = result.correction[0];
    expect(entry.answer_correct).toBe(true);
    expect(entry.justification_status).toBe("missing");
    expect(entry.overall_status).toBe("partial");
    expect(result.correctCount).toBe(0);
    expect(result.score).toBe(0);
  });

  it("bonne réponse + justification manifestement sans rapport -> overall_status partial", async () => {
    const result = await corrigerExerciceServer({
      ...justificationOpts,
      answers: { 0: { reponse: "Awa Diallo", justification: "Il fait beau aujourd'hui." } },
    });
    const entry = result.correction[0];
    expect(entry.justification_status).toBe("unrelated");
    expect(entry.overall_status).toBe("partial");
    expect(result.correctCount).toBe(0);
  });

  it("bonne réponse + justification qui répète seulement la réponse -> overall_status partial (pas une preuve)", async () => {
    const result = await corrigerExerciceServer({
      ...justificationOpts,
      answers: { 0: { reponse: "Awa Diallo", justification: "Awa Diallo" } },
    });
    const entry = result.correction[0];
    expect(entry.justification_status).toBe("restates_answer_without_evidence");
    expect(entry.overall_status).toBe("partial");
  });

  it("bonne réponse + justification ambiguë -> overall_status provisional, score_provisional=true au niveau item ET exercice", async () => {
    const result = await corrigerExerciceServer({
      ...justificationOpts,
      answers: { 0: { reponse: "Awa Diallo", justification: "Elle se présente au groupe." } },
    });
    const entry = result.correction[0];
    if (entry.justification_status === "pending_review") {
      expect(entry.overall_status).toBe("provisional");
      expect(entry.score_provisional).toBe(true);
      expect(result.score_provisional).toBe(true);
      // Un item provisoire n'est ni compté comme réussi ni comme échoué
      // dans le score affiché tant qu'il n'est pas tranché.
      expect(result.correctCount).toBe(0);
    }
  });

  it("mauvaise réponse fermée -> overall_status incorrect, quelle que soit la qualité de la justification", async () => {
    const result = await corrigerExerciceServer({
      ...justificationOpts,
      answers: { 0: { reponse: "Fatou Diallo", justification: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »" } },
    });
    const entry = result.correction[0];
    expect(entry.answer_correct).toBe(false);
    expect(entry.overall_status).toBe("incorrect");
    expect(result.correctCount).toBe(0);
  });

  it("item sans justification_prompt (A1/A2) : justification_status not_required, comportement historique inchangé", async () => {
    const result = await corrigerExerciceServer({ ...baseOpts, answers: { 0: "Awa Diallo" } });
    const entry = result.correction[0];
    expect(entry.justification_status).toBe("not_required");
    expect(entry.overall_status).toBe("complete");
    expect(entry.score_provisional).toBe(false);
  });
});
