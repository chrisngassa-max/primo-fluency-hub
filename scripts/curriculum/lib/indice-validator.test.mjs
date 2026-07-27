// Lot 2.1, point 3 — validateur d'indices A1.
import { describe, expect, it } from "vitest";
import {
  fieldsAreIdentical,
  indiceContainsAnswer,
  validateExerciseIndices,
  validateIndice,
} from "./indice-validator.mjs";

describe("indiceContainsAnswer", () => {
  it("détecte la réponse littérale (accents/casse insensibles)", () => {
    expect(indiceContainsAnswer("Elle se présente : « Je m'appelle Awa. Awa Diallo. »", "Awa Diallo")).toBe(true);
    expect(indiceContainsAnswer("« cinq thèmes sur la vie en France »", "Cinq")).toBe(true);
  });

  it("ne détecte rien pour un indice orienté qui ne cite pas la réponse", () => {
    expect(indiceContainsAnswer("Écoutez le moment où l'apprenante se présente et donne son nom.", "Awa Diallo")).toBe(false);
  });

  it("gère les valeurs vides/nulles sans erreur", () => {
    expect(indiceContainsAnswer("", "Awa")).toBe(false);
    expect(indiceContainsAnswer("un indice", "")).toBe(false);
    expect(indiceContainsAnswer(null, undefined)).toBe(false);
  });
});

describe("fieldsAreIdentical", () => {
  it("compare après normalisation (accents/casse/espaces)", () => {
    expect(fieldsAreIdentical("Été", "ete")).toBe(true);
    expect(fieldsAreIdentical("A  B", "a b")).toBe(true);
    expect(fieldsAreIdentical("A", "B")).toBe(false);
  });
});

describe("validateIndice", () => {
  it("valide un indice orienté sûr", () => {
    const result = validateIndice({
      itemId: "x",
      indice: "Écoutez le moment où l'apprenante se présente.",
      bonneReponse: "Awa Diallo",
      preuveSupport: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
      explication: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
    });
    expect(result.valid).toBe(true);
    expect(result.status).toBe("pedagogical_hint");
    expect(result.violations).toEqual([]);
  });

  it("rejette un indice contenant littéralement la réponse", () => {
    const result = validateIndice({
      itemId: "x",
      indice: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
      bonneReponse: "Awa Diallo",
    });
    expect(result.valid).toBe(false);
    expect(result.status).toBe("leak");
    expect(result.violations.map((v) => v.code)).toContain("INDICE_CONTAINS_ANSWER");
  });

  it("rejette un indice identique à preuve_support", () => {
    const result = validateIndice({
      itemId: "x",
      indice: "Un exemple.",
      bonneReponse: "autre chose",
      preuveSupport: "Un exemple.",
    });
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("INDICE_EQUALS_PREUVE_SUPPORT");
  });

  it("rejette un indice identique à l'explication, MÊME en assisted_retrieval (jamais une donnée de corrigé)", () => {
    const result = validateIndice({
      itemId: "x",
      indice: "Un exemple.",
      bonneReponse: "autre chose",
      explication: "Un exemple.",
      assistedRetrieval: true,
    });
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("INDICE_EQUALS_EXPLICATION");
  });

  it("autorise la réponse visible dans l'indice UNIQUEMENT sous assisted_retrieval déclaré (support d'observation)", () => {
    const result = validateIndice({
      itemId: "x",
      indice: "bleu clair : Principes | rouge clair : Histoire, géographie et culture",
      bonneReponse: "Histoire, géographie et culture",
      assistedRetrieval: true,
    });
    expect(result.valid).toBe(true);
    expect(result.status).toBe("assisted_retrieval");
  });

  it("sans assisted_retrieval, la même légende reste une violation", () => {
    const result = validateIndice({
      itemId: "x",
      indice: "bleu clair : Principes | rouge clair : Histoire, géographie et culture",
      bonneReponse: "Histoire, géographie et culture",
      assistedRetrieval: false,
    });
    expect(result.valid).toBe(false);
  });

  it("un item sans indice est valide (rien à valider)", () => {
    const result = validateIndice({ itemId: "x", indice: undefined, bonneReponse: "A" });
    expect(result.valid).toBe(true);
    expect(result.status).toBeNull();
  });
});

describe("validateExerciseIndices", () => {
  it("agrège les violations de tous les items d'un exercice", () => {
    const exercise = {
      metadata_code: "cv2:S01:v3:demo:A1",
      contenu: {
        items: [
          { indice: "Elle dit : « Awa Diallo »", bonne_reponse: "Awa Diallo", correction: {} },
          { indice: "Écoutez le début.", bonne_reponse: "Awa Diallo", correction: {} },
        ],
      },
    };
    const result = validateExerciseIndices(exercise);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.results).toHaveLength(2);
  });

  it("respecte assistedRetrieval par item (pas un blanc-seing pour tout l'exercice)", () => {
    const exercise = {
      metadata_code: "cv2:S01:v3:demo:A1",
      contenu: {
        items: [
          { indice: "légende : rouge = X", bonne_reponse: "X", correction: {}, assisted_retrieval: true },
          { indice: "légende : rouge = X", bonne_reponse: "X", correction: {}, assisted_retrieval: false },
        ],
      },
    };
    const result = validateExerciseIndices(exercise, { assistedRetrieval: (item) => item.assisted_retrieval === true });
    expect(result.results[0].valid).toBe(true);
    expect(result.results[1].valid).toBe(false);
  });
});
