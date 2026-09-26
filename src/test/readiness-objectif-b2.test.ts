import { describe, expect, it } from "vitest";
import {
  objectifLibelleFallback,
  resolveObjectifFromParcours,
} from "@/lib/readinessDisplay";
import { resolveObjectif } from "../../supabase/functions/compute-readiness/gather";
import {
  getNiveauRequisScale,
  isObjectifAtteint,
  loadConfig,
} from "../../supabase/functions/_shared/readiness";

describe("IRN objectifs 2026 — resolve + seuils", () => {
  const config = loadConfig();

  it("naturalisation → objectif B2 (pas B1)", () => {
    expect(resolveObjectifFromParcours({ typeDemarche: "naturalisation" })).toBe("B2");
    expect(resolveObjectif({ typeDemarche: "naturalisation" })).toBe("B2");
    expect(
      resolveObjectifFromParcours({
        typeDemarche: "naturalisation",
        niveauCible: "B1",
      }),
    ).toBe("B2");
  });

  it("naturalisation + niveau B1 scale → insuffisant ; B2 scale → objectif atteint", () => {
    const b1Scale = getNiveauRequisScale("B1", config);
    const b2Scale = getNiveauRequisScale("B2", config);
    expect(b1Scale).toBe(7);
    expect(b2Scale).toBe(10);
    expect(isObjectifAtteint(b1Scale, "B2", config)).toBe(false);
    expect(isObjectifAtteint(b2Scale, "B2", config)).toBe(true);
  });

  it("carte de résident (B1) → objectif atteint au scale B1", () => {
    expect(resolveObjectifFromParcours({ niveauCible: "B1" })).toBe("B1");
    expect(resolveObjectif({ parcoursNiveau: "B1" })).toBe("B1");
    expect(objectifLibelleFallback("B1")).toBe("Carte de résident");
    expect(isObjectifAtteint(7, "B1", config)).toBe(true);
    expect(isObjectifAtteint(4, "B1", config)).toBe(false);
  });

  it("carte de séjour pluriannuelle (A2) → objectif atteint au scale A2", () => {
    expect(resolveObjectifFromParcours({ typeDemarche: "titre_sejour" })).toBe("A2");
    expect(resolveObjectif({ typeDemarche: "titre_sejour" })).toBe("A2");
    expect(objectifLibelleFallback("A2")).toBe("Carte de séjour pluriannuelle");
    expect(isObjectifAtteint(4, "A2", config)).toBe(true);
    expect(isObjectifAtteint(2, "A2", config)).toBe(false);
  });

  it("pas de régression : config expose A2/B1/B2 et libellés IRN", () => {
    expect(config.objectifs.A2.libelle).toMatch(/pluriannuelle/i);
    expect(config.objectifs.B1.libelle).toMatch(/résident/i);
    expect(config.objectifs.B2.libelle).toMatch(/naturalisation/i);
    expect(config.structural_moderator.fragile_threshold_by_objectif.B2).toBeDefined();
    expect(config.maitrise_periode.min_success_rate_by_objectif.B2).toBeDefined();
  });
});
