import { describe, expect, it } from "vitest";
import { routeExercise, type RouterContext } from "@/lib/exerciseRouter";
import type { StudentProfileV4 } from "@/lib/studentProfileV4";

const baseProfile: StudentProfileV4 = {
  id: "profile-row",
  apprenant_id: "student-id",
  score_co: 50,
  score_ce: 70,
  score_ee: 80,
  score_eo: 90,
  niveau_co: "A1",
  niveau_ce: "B1",
  niveau_ee: "B2",
  niveau_eo: "B2",
  fragilite_principale: "CO",
  type_erreur_dominant: null,
  langue_maternelle: null,
  niveau_scolarisation: null,
  objectif_personnel: null,
  style_apprentissage: null,
  seances_consecutives_sous_60: { CO: 0, CE: 0, EE: 0, EO: 0 },
  dernier_score_phase2_ce: null,
  dernier_score_phase2_co: null,
  montee_auto_phase2: false,
  updated_at: null,
};

function context(overrides: Partial<RouterContext>): RouterContext {
  return {
    profil: baseProfile,
    phase: "phase5_devoir",
    competenceCible: "CO",
    ...overrides,
  };
}

describe("routeExercise", () => {
  it("prioritizes R1 over R4 for phase 2 automatic upgrade", () => {
    const result = routeExercise(context({
      phase: "phase2_tronc_commun",
      scorePhase2: 88,
      nbReussitesConsecutives: 2,
    }));

    expect(result.ruleId).toBe("R1");
    expect(result.decision).toBe("upgrade_support_phase2");
  });

  it("routes scores under 60 to guided remediation", () => {
    const result = routeExercise(context({ scoreDernierExercice: 45 }));

    expect(result.ruleId).toBe("R2");
    expect(result.decision).toBe("remediation_prioritaire");
    expect(result.reasonStudent).not.toMatch(/faible|echec|remediation/i);
  });

  it("routes scores from 60 to 79 to consolidation", () => {
    const result = routeExercise(context({ scoreDernierExercice: 72 }));

    expect(result.ruleId).toBe("R3");
    expect(result.decision).toBe("consolidation");
  });

  it("routes a first score above 80 to equivalent or superior exercise", () => {
    const result = routeExercise(context({
      scoreDernierExercice: 84,
      nbReussitesConsecutives: 1,
    }));

    expect(result.ruleId).toBe("R4");
    expect(result.decision).toBe("exercice_equivalent_ou_superieur");
  });

  it("reproposes missing work when no score rule applies", () => {
    const result = routeExercise(context({ exerciceNonFait: true }));

    expect(result.ruleId).toBe("R10");
    expect(result.decision).toBe("reproposition_automatique");
  });

  it("falls back to maintaining the current path", () => {
    const result = routeExercise(context({ competenceCible: "CE" }));

    expect(result.ruleId).toBe("R0");
    expect(result.decision).toBe("maintien_parcours");
  });
});
