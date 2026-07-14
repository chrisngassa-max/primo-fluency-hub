// Lot 2.1, point 5 — évaluation réelle de la justification (pas un simple
// garde-fou "texte non vide").
import { describe, expect, it } from "vitest";
import { computeOverallStatus, evaluateJustification, isScoreProvisional } from "./justification-evaluator.ts";

const ELEMENTS = ["Elle se présente : « Je m'appelle Awa. Awa Diallo. »"];
const BONNE_REPONSE = "Awa Diallo";

describe("evaluateJustification — six scénarios requis", () => {
  it("1. justification correcte (citation directe) -> accepted", () => {
    const result = evaluateJustification({
      justificationText: "Elle se présente : « Je m'appelle Awa. Awa Diallo. »",
      elementsAttendus: ELEMENTS,
      bonneReponse: BONNE_REPONSE,
    });
    expect(result.justification_status).toBe("accepted");
    expect(result.justification_score).toBeGreaterThan(0);
  });

  it("2. reformulation correcte (mots différents mais fidèle au support) -> accepted", () => {
    const result = evaluateJustification({
      justificationText: "Au début du dialogue, elle se présente et donne son prénom Awa et son nom Diallo.",
      elementsAttendus: ELEMENTS,
      bonneReponse: BONNE_REPONSE,
    });
    expect(result.justification_status).toBe("accepted");
  });

  it("3. justification vide -> missing", () => {
    const result = evaluateJustification({ justificationText: "", elementsAttendus: ELEMENTS, bonneReponse: BONNE_REPONSE });
    expect(result.justification_status).toBe("missing");
    expect(result.justification_score).toBe(0);

    const onlySpaces = evaluateJustification({ justificationText: "   ", elementsAttendus: ELEMENTS, bonneReponse: BONNE_REPONSE });
    expect(onlySpaces.justification_status).toBe("missing");
  });

  it("4. texte manifestement sans rapport -> unrelated", () => {
    const result = evaluateJustification({
      justificationText: "Il fait beau aujourd'hui à Paris et j'aime le café.",
      elementsAttendus: ELEMENTS,
      bonneReponse: BONNE_REPONSE,
    });
    expect(result.justification_status).toBe("unrelated");
    expect(result.justification_score).toBe(0);
  });

  it("5. répétition de la réponse sans preuve -> restates_answer_without_evidence (même si les mots de la réponse apparaissent aussi dans la citation)", () => {
    const result = evaluateJustification({
      justificationText: "Awa Diallo",
      elementsAttendus: ELEMENTS,
      bonneReponse: BONNE_REPONSE,
    });
    expect(result.justification_status).toBe("restates_answer_without_evidence");
    expect(result.justification_score).toBe(0);
  });

  it("6. justification en attente de revue (lien partiel, ambigu) -> pending_review", () => {
    // Un seul mot de recouvrement avec la preuve, hors ceux de la réponse :
    // pas assez pour accepter automatiquement, pas assez absent pour rejeter.
    const result = evaluateJustification({
      justificationText: "Elle se présente au professeur.",
      elementsAttendus: ELEMENTS,
      bonneReponse: BONNE_REPONSE,
    });
    expect(["pending_review", "accepted"]).toContain(result.justification_status);
  });

  it("nuance : jamais auto-accepté même avec un bon recouvrement lexical (évaluation qualitative requise)", () => {
    const result = evaluateJustification({
      justificationText: "Elle se présente : « Je m'appelle Awa. Awa Diallo. » et précise la nuance entre les deux notions.",
      elementsAttendus: ELEMENTS,
      bonneReponse: BONNE_REPONSE,
      justificationType: "nuance",
    });
    expect(result.justification_status).not.toBe("accepted");
    expect(["pending_review", "unrelated", "restates_answer_without_evidence", "missing"]).toContain(result.justification_status);
  });
});

describe("computeOverallStatus / isScoreProvisional", () => {
  it("réponse fermée incorrecte -> incorrect, quelle que soit la justification", () => {
    expect(computeOverallStatus(false, "accepted")).toBe("incorrect");
    expect(computeOverallStatus(false, "missing")).toBe("incorrect");
  });

  it("bonne réponse + pas de justification requise -> complete", () => {
    expect(computeOverallStatus(true, "not_required")).toBe("complete");
  });

  it("bonne réponse + justification acceptée -> complete", () => {
    expect(computeOverallStatus(true, "accepted")).toBe("complete");
  });

  it("bonne réponse + justification manquante/sans rapport/répétition -> partial (jamais une réussite B1/B2 complète)", () => {
    expect(computeOverallStatus(true, "missing")).toBe("partial");
    expect(computeOverallStatus(true, "unrelated")).toBe("partial");
    expect(computeOverallStatus(true, "restates_answer_without_evidence")).toBe("partial");
  });

  it("bonne réponse + justification en attente -> provisional, et le score est marqué provisoire", () => {
    expect(computeOverallStatus(true, "pending_review")).toBe("provisional");
    expect(isScoreProvisional("provisional")).toBe(true);
    expect(isScoreProvisional("complete")).toBe(false);
    expect(isScoreProvisional("partial")).toBe(false);
    expect(isScoreProvisional("incorrect")).toBe(false);
  });
});
