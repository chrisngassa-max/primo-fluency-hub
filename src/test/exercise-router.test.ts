import { describe, expect, it } from "vitest";
import { routeExercises } from "@/services/ExerciseRouter";

describe("routeExercises", () => {
  it("proposes remediation on the weakest recent competence with an explicit reason", () => {
    const [recommendation] = routeExercises([{
      id: "student-1",
      name: "Amina",
      profile: { niveau_actuel: "A2" },
      results: [
        { competence: "CE", score: 34 },
        { competence: "CE", score: 42 },
        { competence: "CO", score: 78 },
      ],
    }], { theme: "Le logement", defaultCount: 4 });

    expect(recommendation.competence).toBe("CE");
    expect(recommendation.progression).toBe("remediation");
    expect(recommendation.count).toBe(4);
    expect(recommendation.motif).toContain("38% en CE");
  });

  it("uses profile rates when no recent result is available", () => {
    const [recommendation] = routeExercises([{
      id: "student-2",
      name: "Samir",
      profile: {
        niveau_actuel: "B1",
        taux_reussite_structures: 54,
        taux_reussite_eo: 82,
      },
    }]);

    expect(recommendation.competence).toBe("Structures");
    expect(recommendation.niveau).toBe("B1");
    expect(recommendation.progression).toBe("remediation");
  });

  it("adds accessibility aids and flags stagnation", () => {
    const [recommendation] = routeExercises([{
      id: "student-3",
      name: "Leila",
      profile: {
        niveau_actuel: "A1",
        vitesse_lecture: "lente",
        aisance_numerique: "faible",
        preferences_apprentissage: ["visuel"],
      },
      results: [
        { competence: "CE", score: 52 },
        { competence: "CE", score: 50 },
        { competence: "CE", score: 54 },
      ],
    }]);

    expect(recommendation.aides).toEqual(expect.arrayContaining(["audio", "banque de mots", "interaction simple", "support visuel"]));
    expect(recommendation.motif).toContain("sans progression nette");
    expect(recommendation.difficulte).toBe(2);
  });

  it("starts cautiously on a session target when there is no usable data", () => {
    const [recommendation] = routeExercises([{
      id: "student-4",
      name: "Noah",
    }], {
      competencesCibles: ["Expression orale"],
      niveauCible: "A2",
    });

    expect(recommendation.competence).toBe("EO");
    expect(recommendation.niveau).toBe("A2");
    expect(recommendation.progression).toBe("demarrage");
    expect(recommendation.motif).toContain("aucun resultat recent");
  });

  it("starts from the official level and ignores results before the new baseline", () => {
    const [recommendation] = routeExercises([{
      id: "student-5",
      name: "Meryem",
      profile: {
        niveau_actuel: "A2",
        niveau_eo: "B1",
        niveau_baseline_at: "2026-06-01T09:00:00Z",
        taux_reussite_ce: 25,
      },
      results: [
        { competence: "CE", score: 20, createdAt: "2026-05-20T09:00:00Z" },
      ],
    }], {
      competencesCibles: ["Expression orale"],
    });

    expect(recommendation.competence).toBe("EO");
    expect(recommendation.niveau).toBe("B1");
    expect(recommendation.progression).toBe("demarrage");
  });
});
