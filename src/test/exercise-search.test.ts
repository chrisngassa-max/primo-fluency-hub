import { describe, expect, it } from "vitest";
import {
  findReusableExercises,
  hasUsableContent,
  niveauWindow,
  REUSE_SCORE_MIN,
} from "../../supabase/functions/_shared/exercise-search.ts";

// ─── Mock minimal du client Supabase (chaîne de query thenable) ───
function makeClient(resultsByTable: Record<string, { data: any[]; error: any }>) {
  return {
    from(table: string) {
      const result = resultsByTable[table] ?? { data: [], error: null };
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        in: () => builder,
        gte: () => builder,
        not: () => builder,
        limit: () => builder,
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
  };
}

const A1_CE_QCM = {
  id: "ex-strong",
  titre: "CE A1 QCM banque",
  consigne: "Lisez et répondez.",
  competence: "CE",
  niveau_vise: "A1",
  format: "qcm",
  difficulte: 3,
  contenu: { items: [{ question: "Q1", bonne_reponse: "a" }] },
  contexte_irn: null,
  theme: null,
  niveau_guidage: null,
  eleve_id: null,
};

describe("exercise-search (search-first)", () => {
  it("niveauWindow returns ±1 around the target level", () => {
    expect(niveauWindow("A1")).toEqual(["A0", "A1", "A2"]);
    expect(niveauWindow("B2")).toEqual(["B1", "B2"]);
  });

  it("hasUsableContent requires items for non-production formats", () => {
    expect(hasUsableContent(A1_CE_QCM)).toBe(true);
    expect(hasUsableContent({ ...A1_CE_QCM, contenu: { items: [] } })).toBe(false);
    expect(hasUsableContent({ id: "x", consigne: "Décrivez.", format: "production_ecrite" })).toBe(true);
  });

  it("RÉUTILISE un exercice banque à score ≥ 80 et non vu récemment", async () => {
    const client = makeClient({
      exercices: { data: [A1_CE_QCM], error: null },
      devoirs: { data: [], error: null },
      resultats: { data: [], error: null },
    });

    const res = await findReusableExercises(client, {
      competence: "CE",
      niveauVise: "A1",
      count: 1,
      typeDemarche: "titre_sejour",
      eleveIds: ["eleve-1"],
    });

    expect(res.candidates[0].score).toBeGreaterThanOrEqual(REUSE_SCORE_MIN);
    expect(res.reusable).toHaveLength(1);
    expect(res.reusable[0].id).toBe("ex-strong");
    expect(res.reusable[0].source).toBe("banque");
    expect(res.report.reused).toBe(1);
  });

  it("GÉNÈRE (ne réutilise pas) un exercice vu récemment par l'élève", async () => {
    const client = makeClient({
      exercices: { data: [A1_CE_QCM], error: null },
      // L'exercice a été servi récemment en devoir → non frais.
      devoirs: { data: [{ exercice_id: "ex-strong" }], error: null },
      resultats: { data: [], error: null },
    });

    const res = await findReusableExercises(client, {
      competence: "CE",
      niveauVise: "A1",
      count: 1,
      typeDemarche: "titre_sejour",
      eleveIds: ["eleve-1"],
    });

    expect(res.candidates[0].score).toBeGreaterThanOrEqual(REUSE_SCORE_MIN);
    expect(res.candidates[0].fresh).toBe(false);
    expect(res.reusable).toHaveLength(0); // vu récemment → on génère
    expect(res.report.reused).toBe(0);
  });

  it("GÉNÈRE (ne réutilise pas) quand le score est sous le seuil de réutilisation", async () => {
    const client = makeClient({
      exercices: { data: [A1_CE_QCM], error: null },
      devoirs: { data: [], error: null },
      resultats: { data: [], error: null },
    });

    // Seuil relevé au-dessus du score atteignable → aucune réutilisation.
    const res = await findReusableExercises(client, {
      competence: "CE",
      niveauVise: "A1",
      count: 1,
      typeDemarche: "titre_sejour",
      reuseScoreMin: 101,
    });

    expect(res.reusable).toHaveLength(0);
    expect(res.report.reused).toBe(0);
    expect(res.report.fresh_eligible).toBe(0);
  });

  it("exclut (hard filter) un format inadapté à la compétence", async () => {
    const client = makeClient({
      // production_orale n'est pas un format autorisé pour CE → EXCL_02
      exercices: { data: [{ ...A1_CE_QCM, id: "ex-bad", format: "production_orale" }], error: null },
      devoirs: { data: [], error: null },
      resultats: { data: [], error: null },
    });

    const res = await findReusableExercises(client, {
      competence: "CE",
      niveauVise: "A1",
      count: 1,
    });

    expect(res.report.scored_passed_filters).toBe(0);
    expect(res.reusable).toHaveLength(0);
  });
});
