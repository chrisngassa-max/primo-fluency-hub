import { describe, expect, it } from "vitest";
import {
  buildUniformCompetenceInput,
  computeCompetenceIPE,
  computeGlobalIPE,
  computeWeightedScore,
  loadConfig,
  type CompetenceIPEResult,
} from "./readiness";

const config = loadConfig();

function makeResult(score: number, confiance: CompetenceIPEResult["confiance"] = "haute"): CompetenceIPEResult {
  return {
    score,
    bande: score <= 40 ? "fragile" : score <= 65 ? "construction" : score <= 84 ? "proche_seuil" : "pret",
    confiance,
    composantes: {
      maitrise_periode: score,
      preuve_examen: score,
      niveau_valide: score,
      penalite_erreurs: 100,
      penalite_raw: 0,
      weights_used: {},
    },
  };
}

describe("computeCompetenceIPE", () => {
  it("données insuffisantes (< 15 items) → confiance insuffisante", () => {
    const input = buildUniformCompetenceInput("CO", "A2", 70, {
      itemsEvaluated: 10,
    });
    const result = computeCompetenceIPE(input, config);
    expect(result.confiance).toBe("insuffisante");
  });

  it("sans preuve examen → poids fallback 70/20/10", () => {
    const input = buildUniformCompetenceInput("CE", "A2", 65, {
      hasExam: false,
    });
    const result = computeCompetenceIPE(input, config);
    expect(result.composantes.weights_used).toEqual({
      maitrise_periode: 0.7,
      niveau_valide: 0.2,
      penalite_erreurs: 0.1,
    });
    expect(result.confiance).toBe("moyenne");
  });

  it("pénalité continue — pas de falaise à 0", () => {
    const base = buildUniformCompetenceInput("EE", "A2", 75);
    const lowPenalty = computeCompetenceIPE(base, config);

    const withErrors = computeCompetenceIPE({
      ...base,
      errorEvents: [
        { typeCode: "HORS_SUJET", graviteBase: 5, createdAt: "2026-06-01", isNonResolue: true },
      ],
    }, config);

    const withMoreErrors = computeCompetenceIPE({
      ...base,
      errorEvents: [
        { typeCode: "HORS_SUJET", graviteBase: 5, createdAt: "2026-06-01", isNonResolue: true },
        { typeCode: "HORS_SUJET", graviteBase: 5, createdAt: "2026-06-02", isNonResolue: true },
        { typeCode: "HORS_SUJET", graviteBase: 5, createdAt: "2026-06-03", isNonResolue: true },
        { typeCode: "HORS_SUJET", graviteBase: 5, createdAt: "2026-06-04", isNonResolue: true },
      ],
    }, config);

    expect(withErrors.score).toBeGreaterThan(0);
    expect(withMoreErrors.score).toBeGreaterThan(0);
    expect(withErrors.score).toBeLessThan(lowPenalty.score);
    expect(withMoreErrors.score).toBeLessThan(withErrors.score);
    expect(withMoreErrors.composantes.penalite_raw).toBeLessThanOrEqual(1);
  });
});

describe("computeGlobalIPE", () => {
  it("ST fragile → EE/EO plafonnés à 65", () => {
    const global = computeGlobalIPE({
      objectif: "A2",
      competencies: {
        CO: makeResult(80),
        CE: makeResult(80),
        EE: makeResult(90),
        EO: makeResult(90),
      },
      st: makeResult(35),
    }, config);

    expect(global.composantes.structural_cap_applied).toBe(true);
    expect(global.score).toBe(72.5);
  });

  it("Apprenant A (objectif A2) — IPE ~50, bande construction", () => {
    const global = computeGlobalIPE({
      objectif: "A2",
      competencies: {
        CO: makeResult(70),
        CE: makeResult(65),
        EE: makeResult(30),
        EO: makeResult(40),
      },
      st: makeResult(45),
    }, config);

    expect(global.score).toBeGreaterThanOrEqual(45);
    expect(global.score).toBeLessThanOrEqual(55);
    expect(global.bande).toBe("construction");
  });

  it("Apprenant B (objectif A2) — IPE ~82, bande proche_seuil", () => {
    const global = computeGlobalIPE({
      objectif: "A2",
      competencies: {
        CO: makeResult(85),
        CE: makeResult(90),
        EE: makeResult(75),
        EO: makeResult(80),
      },
      st: makeResult(70),
    }, config);

    expect(global.score).toBeGreaterThanOrEqual(80);
    expect(global.score).toBeLessThanOrEqual(84);
    expect(global.bande).toBe("proche_seuil");
  });

  it("Apprenant C (objectif B1) — IPE ~65, bande proche_seuil", () => {
    const global = computeGlobalIPE({
      objectif: "B1",
      competencies: {
        CO: makeResult(80),
        CE: makeResult(75),
        EE: makeResult(45),
        EO: makeResult(60),
      },
      st: makeResult(50),
    }, config);

    expect(global.score).toBeGreaterThanOrEqual(60);
    expect(global.score).toBeLessThanOrEqual(68);
    expect(global.bande).toBe("construction");
  });
});

describe("computeWeightedScore", () => {
  it("avec examen utilise 40/30/20/10", () => {
    const { weights_used } = computeWeightedScore(
      { maitrise_periode: 80, niveau_valide: 80, penalite_erreurs: 100, preuve_examen: 70 },
      true,
      config,
    );
    expect(weights_used.preuve_examen).toBe(0.3);
    expect(weights_used.maitrise_periode).toBe(0.4);
  });
});
