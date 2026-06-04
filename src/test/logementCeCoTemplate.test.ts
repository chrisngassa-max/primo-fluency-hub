import { describe, expect, it } from "vitest";
import { LOGEMENT_CE_CO_TEMPLATE_V4, LOGEMENT_CE_CO_CORPUS_REQUIREMENTS } from "@/data/sessionTemplates/logementCeCo";
import {
  validateSessionTemplateReadinessV4,
  validateSessionTemplateV4,
} from "@/lib/sessionTemplateV4";

describe("LOGEMENT_CE_CO_TEMPLATE_V4", () => {
  it("is structurally valid as the CE/CO logement pilot", () => {
    expect(validateSessionTemplateV4(LOGEMENT_CE_CO_TEMPLATE_V4)).toEqual([]);
    expect(LOGEMENT_CE_CO_TEMPLATE_V4.theme).toBe("logement");
    expect(LOGEMENT_CE_CO_TEMPLATE_V4.mvp_competences).toEqual(["CE", "CO"]);
    expect(LOGEMENT_CE_CO_TEMPLATE_V4.phases.phase3_atelier_cible.mvp_competences_disponibles).toEqual(["CE", "CO"]);
  });

  it("is not deployable until A1/A2/B1/B2 phase 2 supports are attached", () => {
    expect(validateSessionTemplateReadinessV4(LOGEMENT_CE_CO_TEMPLATE_V4)).toEqual(
      expect.arrayContaining([
        "phase2_missing_support:A1",
        "phase2_missing_support:A2",
        "phase2_missing_support:B1",
        "phase2_missing_support:B2",
      ]),
    );
  });

  it("documents the blocking CO A2/B2 corpus requirement", () => {
    expect(LOGEMENT_CE_CO_CORPUS_REQUIREMENTS.coA2B2MinimumCount).toBeGreaterThanOrEqual(18);
    expect(LOGEMENT_CE_CO_CORPUS_REQUIREMENTS.situations).toContain("message d'agence");
    expect(LOGEMENT_CE_CO_CORPUS_REQUIREMENTS.competences).toEqual(["CE", "CO"]);
  });
});
