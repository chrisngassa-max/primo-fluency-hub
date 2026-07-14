// Lot 2.1, point 6 — liste blanche dédiée pour la restitution après
// libération : tests de non-fuite avant libération et de présence après.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { filterReleasedItemResult, filterReleasedItemResults } from "./released-correction-filter.ts";

const FULL_STORED_ITEM = {
  question: "Comment s'appelle l'apprenante ?",
  reponse_donnee: "Awa Diallo",
  bonne_reponse: "Awa Diallo",
  correct: true,
  explication: "Elle se présente dans le dialogue.",
  learner_justification: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
  answer_correct: true,
  justification_status: "accepted",
  justification_score: 100,
  justification_feedback: "Justification acceptée : elle cite ou reformule les éléments attendus du support.",
  overall_status: "complete",
  score_provisional: false,
  preuve_support: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
  explication_distracteurs: ["« Awa Rossi » ne correspond pas au support."],
  erreur_diagnostiquee: "confusion_information_presente",
  remediation: "Relisez la phrase du support puis répondez à nouveau.",
  justification_ouverte: {
    elements_attendus: ["Elle se présente : « Je m'appelle Awa. Awa Diallo. »"],
    criteres_evaluation: ["cite ou reformule fidèlement un élément réel du support"],
  },
  // Champ hypothétique interne qui ne devrait JAMAIS être exposé, même s'il
  // apparaissait un jour dans le stockage (défense en profondeur).
  internal_debug_notes: "ne jamais exposer ceci",
};

describe("filterReleasedItemResult — présence après libération (liste blanche)", () => {
  it("laisse passer tous les champs de restitution attendus (Lot 2/2.1)", () => {
    const filtered = filterReleasedItemResult(FULL_STORED_ITEM);
    for (const key of [
      "question", "reponse_donnee", "bonne_reponse", "correct", "answer_correct",
      "explication", "learner_justification",
      "justification_status", "justification_score", "justification_feedback",
      "overall_status", "score_provisional",
      "preuve_support", "explication_distracteurs", "erreur_diagnostiquee", "remediation",
    ]) {
      expect(filtered, key).toHaveProperty(key);
      expect(filtered[key]).toEqual((FULL_STORED_ITEM as Record<string, unknown>)[key]);
    }
    expect(filtered.justification_ouverte).toEqual({
      elements_attendus: FULL_STORED_ITEM.justification_ouverte.elements_attendus,
      criteres_evaluation: FULL_STORED_ITEM.justification_ouverte.criteres_evaluation,
    });
  });

  it("ne laisse jamais passer un champ hors liste blanche, même stocké (défense en profondeur)", () => {
    const filtered = filterReleasedItemResult(FULL_STORED_ITEM);
    expect(filtered).not.toHaveProperty("internal_debug_notes");
  });

  it("gère un item sans les nouveaux champs (comportement historique A1/A2, avant Lot 2.1) sans erreur", () => {
    const legacy = { question: "Q", reponse_donnee: "R", bonne_reponse: "R", correct: true, explication: "E" };
    const filtered = filterReleasedItemResult(legacy);
    expect(filtered).toEqual(legacy);
    expect(filtered).not.toHaveProperty("justification_ouverte");
  });

  it("gère null/undefined/objet vide sans erreur", () => {
    expect(filterReleasedItemResult(null)).toEqual({});
    expect(filterReleasedItemResult(undefined)).toEqual({});
    expect(filterReleasedItemResult({})).toEqual({});
  });

  it("justification_ouverte mal formé (pas un tableau) est neutralisé en tableau vide, jamais propagé tel quel", () => {
    const malformed = { ...FULL_STORED_ITEM, justification_ouverte: { elements_attendus: "pas un tableau", criteres_evaluation: null } };
    const filtered = filterReleasedItemResult(malformed as never);
    expect(filtered.justification_ouverte).toEqual({ elements_attendus: [], criteres_evaluation: [] });
  });
});

describe("filterReleasedItemResults — plusieurs items indexés", () => {
  it("filtre chaque entrée indépendamment en conservant les clés d'index", () => {
    const stored = { "0": FULL_STORED_ITEM, "1": { ...FULL_STORED_ITEM, internal_debug_notes: "x2" } };
    const filtered = filterReleasedItemResults(stored);
    expect(Object.keys(filtered)).toEqual(["0", "1"]);
    for (const key of Object.keys(filtered)) {
      expect(filtered[key]).not.toHaveProperty("internal_debug_notes");
    }
  });

  it("gère null/undefined sans erreur (statut non libéré)", () => {
    expect(filterReleasedItemResults(null)).toEqual({});
    expect(filterReleasedItemResults(undefined)).toEqual({});
  });
});

describe("get-attempt-correction — non-fuite avant libération (contrat de code)", () => {
  it("le filtre n'est appliqué qu'APRÈS la vérification correction_released_at dans le code source (jamais avant)", () => {
    const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "get-attempt-correction", "index.ts");
    const source = readFileSync(filePath, "utf8");
    const gateIndex = source.indexOf("if (!attempt.correction_released_at)");
    const filterCallIndex = source.indexOf("filterReleasedItemResults(");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(filterCallIndex).toBeGreaterThan(-1);
    expect(filterCallIndex).toBeGreaterThan(gateIndex);
    // Le early-return non-libéré ne doit jamais mentionner item_results.
    const earlyReturnBlock = source.slice(gateIndex, gateIndex + 200);
    expect(earlyReturnBlock).not.toContain("item_results");
  });
});
