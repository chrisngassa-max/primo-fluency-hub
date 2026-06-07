import { describe, expect, it } from "vitest";
import { buildPedagogicalDirectives } from "../../supabase/functions/_shared/pedagogical-directives.ts";

describe("buildPedagogicalDirectives", () => {
  it("redescend une faiblesse EE vers Structures quand les structures sont fragiles", () => {
    const directives = buildPedagogicalDirectives({
      profile: {
        taux_reussite_ee: 38,
        taux_reussite_structures: 42,
      },
      weakCompetences: ["EE"],
    });

    expect(directives.competence_blocage).toBe("EE");
    expect(directives.competence_cible).toBe("Structures");
    expect(directives.regle_descente).toContain("Redescendre vers Structures");
    expect(directives.formats_interdits).toContain("production_ecrite_longue");
  });

  it("renforce audio, image et banque de mots quand la lecture est lente", () => {
    const directives = buildPedagogicalDirectives({
      profile: {
        vitesse_lecture: "lente",
        taux_reussite_ce: 55,
      },
    });

    expect(directives.vitesse_lecture).toBe("lente");
    expect(directives.supports_obligatoires).toEqual(expect.arrayContaining(["audio", "image", "banque_de_mots"]));
    expect(directives.longueur_max_consigne_mots).toBeLessThanOrEqual(8);
  });

  it("interdit les formats lourds quand l'etayage est fort", () => {
    const directives = buildPedagogicalDirectives({
      outcome: { besoin_pedagogique: "remediation" },
      profile: { taux_reussite_co: 45 },
    });

    expect(directives.niveau_etayage).toBe("fort");
    expect(directives.formats_autorises).not.toContain("production_ecrite");
    expect(directives.formats_interdits).toContain("redaction_libre");
  });

  it("simplifie les interactions quand l'aisance numerique est faible", () => {
    const directives = buildPedagogicalDirectives({
      profile: {
        aisance_numerique: "faible",
        niveau_scolarisation: "primaire",
      },
    });

    expect(directives.formats_autorises).toEqual(
      expect.arrayContaining(["qcm", "vrai_faux"])
    );
    expect(directives.formats_autorises).not.toContain("appariement");
    expect(directives.formats_interdits).toContain("glisser_deposer");
    expect(directives.longueur_max_consigne_mots).toBeLessThanOrEqual(6);
  });

  it("reprend le projet personnel comme contexte prioritaire", () => {
    const directives = buildPedagogicalDirectives({
      profile: {
        projet_personnel: "Travailler dans la restauration",
        objectif_tcf: "irn",
        preferences_apprentissage: ["audio", "exemples"],
      },
    });

    expect(directives.contexte_prioritaire).toBe("Travailler dans la restauration");
    expect(directives.objectif_tcf).toBe("irn");
    expect(directives.supports_obligatoires).toEqual(
      expect.arrayContaining(["audio", "exemple_resolu"])
    );
  });
});
