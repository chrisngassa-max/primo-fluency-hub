import { describe, expect, it } from "vitest";
import {
  getDemarcheWeights,
  getDominantPilierFromErrors,
  getErrorRemediation,
  getStructuresSwitchRules,
  matchSwitchRule,
  niveauToBand,
  resolveFormatAlias,
} from "../../supabase/functions/_shared/referential-loader.ts";

describe("referential-loader", () => {
  it("loads referential data", () => {
    expect(getStructuresSwitchRules().length).toBeGreaterThanOrEqual(12);
    expect(getErrorRemediation("PHONO", "A0_A1")).not.toBeNull();
  });

  it("returns demarche weights for titre_sejour and naturalisation", () => {
    const titre = getDemarcheWeights("titre_sejour");
    expect(titre.CO).toBe(0.35);
    expect(titre.CE).toBe(0.35);
    expect(titre.EE).toBe(0.15);
    expect(titre.EO).toBe(0.15);
    expect(titre.niveau_cible).toBe("B1");

    const nat = getDemarcheWeights("naturalisation");
    expect(nat.CO).toBe(0.25);
    expect(nat.niveau_cible).toBe("B2");
  });

  it("maps niveau to band", () => {
    expect(niveauToBand("A0")).toBe("A0_A1");
    expect(niveauToBand("A2")).toBe("A2_B1");
    expect(niveauToBand("B2")).toBe("B2");
  });

  it("resolves format aliases including discrimination_audio", () => {
    const alias = resolveFormatAlias("discrimination_audio");
    expect(alias?.generateur).toBe("qcm");
    expect(alias?.options).toContain("support_audio");
  });

  it("matches PHONO switch rule when error rate exceeds threshold", () => {
    const rule = matchSwitchRule({
      niveauCecrl: "A1",
      errorCounts: { PHONO: 3, GRAM_ACCORD: 1 },
      totalErrors: 4,
      competenceScores: { EO: 45 },
    });

    expect(rule?.id).toBe("SW-EO-PHON-01");
    expect(rule?.pilier_cible).toBe("phonetique");
  });

  it("derives dominant pilier from error counts", () => {
    const pilier = getDominantPilierFromErrors(
      { PHONO: 5, GRAM_ACCORD: 1 },
      "A0_A1",
    );
    expect(pilier).toBe("phonetique");
  });
});
