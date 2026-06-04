import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const corpus = JSON.parse(
  readFileSync(resolve("data/corpora/logement-co-a2-b2.json"), "utf8"),
);

describe("logement CO A2/B2 corpus", () => {
  it("contains enough CO A2/B2 exercises for the blocking S1-02a requirement", () => {
    expect(corpus).toHaveLength(18);
    expect(corpus.every((exercise: any) => ["A2", "B1", "B2"].includes(exercise.niveau_vise))).toBe(true);
    expect(corpus.filter((exercise: any) => exercise.niveau_vise === "A2")).toHaveLength(6);
    expect(corpus.filter((exercise: any) => exercise.niveau_vise === "B1")).toHaveLength(6);
    expect(corpus.filter((exercise: any) => exercise.niveau_vise === "B2")).toHaveLength(6);
  });

  it("covers the required logement oral situations", () => {
    const situations = new Set(corpus.map((exercise: any) => exercise.situation));
    expect(situations).toEqual(expect.objectContaining({}));
    expect(situations.has("annonce vocale")).toBe(true);
    expect(situations.has("message d'agence")).toBe(true);
    expect(situations.has("rendez-vous visite")).toBe(true);
    expect(situations.has("etat des lieux")).toBe(true);
    expect(situations.has("demande de document")).toBe(true);
    expect(situations.has("reunion copropriete")).toBe(true);
    expect(situations.has("mediation locative")).toBe(true);
  });

  it("keeps every answer inside its options", () => {
    for (const exercise of corpus) {
      expect(exercise.script_audio.split(/\s+/).length).toBeGreaterThanOrEqual(25);
      expect(exercise.items.length).toBeGreaterThan(0);
      for (const item of exercise.items) {
        expect(item.options).toContain(item.bonne_reponse);
      }
    }
  });
});
