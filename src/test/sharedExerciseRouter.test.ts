import { describe, expect, it } from "vitest";
import { routeExercise } from "../../supabase/functions/_shared/exercise-router";

describe("shared Supabase exercise router", () => {
  it("routes phase 5 homework remediation deterministically", () => {
    const result = routeExercise({
      profil: { fragilite_principale: "CO" },
      phase: "phase5_devoir",
      competenceCible: "CO",
      scoreDernierExercice: 45,
    });

    expect(result.ruleId).toBe("R2");
    expect(result.decision).toBe("remediation_prioritaire");
    expect(result.devoirGenere).toBe("exo_guide_meme_niveau_outils_aide_fournis");
    expect(result.reasonStudent).not.toMatch(/echec|faible|remediation/i);
  });
});
