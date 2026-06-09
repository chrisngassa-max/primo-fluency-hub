import { describe, expect, it } from "vitest";
import {
  buildSandboxHistory,
  SANDBOX_LEARNER_FIXTURES,
} from "./sandbox-fixtures";

describe("sandbox learner fixtures", () => {
  it("cree quatre trajectoires pedagogiques differenciees", () => {
    const fixtures = Object.values(SANDBOX_LEARNER_FIXTURES);

    expect(fixtures.map((fixture) => fixture.prenom)).toEqual(["Mina", "Youssef", "Olena", "Lucas"]);
    expect(new Set(fixtures.map((fixture) => fixture.profile.fragilite_principale)).size).toBeGreaterThan(1);
    expect(new Set(fixtures.map((fixture) => fixture.profile.score_risque)).size).toBe(4);
  });

  it("produit un historique date avec devoirs ouverts et termines", () => {
    const history = buildSandboxHistory(SANDBOX_LEARNER_FIXTURES.A2, ["ex-1", "ex-2"]);

    expect(history.resultats).toHaveLength(8);
    expect(history.devoirs.some((devoir) => devoir.statut === "en_attente")).toBe(true);
    expect(history.devoirs.some((devoir) => devoir.statut === "fait")).toBe(true);
    expect(history.resultats.every((resultat) => ["ex-1", "ex-2"].includes(resultat.exercise_id))).toBe(true);
  });
});
