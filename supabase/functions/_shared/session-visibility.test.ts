import { describe, expect, it } from "vitest";
import { isActivityVisible, isExerciseLinkVisible } from "./session-visibility.ts";

describe("session-visibility — 2e relecture indépendante, point 10", () => {
  describe("isActivityVisible", () => {
    it("est visible en publishable et published", () => {
      expect(isActivityVisible({ pedagogical_status: "publishable" })).toBe(true);
      expect(isActivityVisible({ pedagogical_status: "published" })).toBe(true);
    });

    it("est invisible pour tous les paliers intermédiaires, dont technical_review", () => {
      for (const status of ["draft", "technical_review", "pedagogical_review", "factual_review", "trainer_approved"]) {
        expect(isActivityVisible({ pedagogical_status: status })).toBe(false);
      }
    });
  });

  describe("isExerciseLinkVisible — filtrage A1/A2/B1/B2", () => {
    const learnerId = "eleve-1";

    it("un apprenant A1 ne voit PAS un exercice commun B1", () => {
      const visible = isExerciseLinkVisible(
        { eleve_id: null },
        { niveau_vise: "B1" },
        learnerId,
        "A1",
      );
      expect(visible).toBe(false);
    });

    it("un apprenant A1 ne voit PAS un exercice commun B2", () => {
      expect(isExerciseLinkVisible({ eleve_id: null }, { niveau_vise: "B2" }, learnerId, "A1")).toBe(false);
    });

    it("un apprenant A1 voit un exercice commun A1", () => {
      expect(isExerciseLinkVisible({ eleve_id: null }, { niveau_vise: "A1" }, learnerId, "A1")).toBe(true);
    });

    it("un exercice individuel (bonus/remédiation) reste visible même à un niveau différent", () => {
      expect(isExerciseLinkVisible({ eleve_id: learnerId }, { niveau_vise: "B2" }, learnerId, "A1")).toBe(true);
    });

    it("un exercice assigné à un AUTRE élève n'est jamais visible", () => {
      expect(isExerciseLinkVisible({ eleve_id: "eleve-2" }, { niveau_vise: "A1" }, learnerId, "A1")).toBe(false);
    });

    it("sans niveau de groupe connu, un exercice commun reste visible (dégradé, pas de faux négatif)", () => {
      expect(isExerciseLinkVisible({ eleve_id: null }, { niveau_vise: "B2" }, learnerId, null)).toBe(true);
    });
  });
});
