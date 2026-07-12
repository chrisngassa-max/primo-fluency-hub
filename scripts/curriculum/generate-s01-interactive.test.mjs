import { describe, expect, it } from "vitest";
import { buildInteractiveS01 } from "./generate-s01-interactive.mjs";

describe("S01 v3 — parcours interactif", () => {
  it("génère une playlist A1 à B2 suffisamment dense", async () => {
    const payload = await buildInteractiveS01();
    expect(payload.exercises).toHaveLength(29);
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(payload.playlists[level].length).toBeGreaterThanOrEqual(4);
      expect(payload.playlists[level].map((entry) => entry.ordre)).toEqual(
        Array.from({ length: payload.playlists[level].length }, (_, index) => index + 1),
      );
    }
  });

  it("ne produit que des formats compris par l'application", async () => {
    const payload = await buildInteractiveS01();
    const formats = new Set(["qcm", "vrai_faux", "appariement", "production_ecrite", "production_orale", "texte_lacunaire", "transformation"]);
    expect(payload.exercises.every((exercise) => formats.has(exercise.format))).toBe(true);
    expect(payload.report.validation_rules.every((rule) => rule.status === "pass")).toBe(true);
  });

  it("conserve CO dans toute la famille et sépare les prolongements EO", async () => {
    const payload = await buildInteractiveS01();
    const family = payload.exercises.filter((exercise) => exercise.family_id === "S01_CO_ACCUEIL_01");
    expect(family.map((exercise) => exercise.niveau_vise).sort()).toEqual(["A1", "A2", "B1", "B2"]);
    expect(family.every((exercise) => exercise.competence === "CO")).toBe(true);
    const extensions = payload.exercises.filter((exercise) => exercise.extension_of_family_id === "S01_CO_ACCUEIL_01");
    expect(extensions).toHaveLength(4);
    expect(extensions.every((exercise) => exercise.competence === "EO" && !exercise.family_id)).toBe(true);
  });

  it("formalise A2 comme pivot sans réduire la différenciation à la longueur", async () => {
    const payload = await buildInteractiveS01();
    const family = payload.exercises.filter((exercise) => exercise.family_id === "S01_CO_ACCUEIL_01");
    const byLevel = Object.fromEntries(family.map((exercise) => [exercise.niveau_vise, exercise]));
    expect(byLevel.A2.contenu.metadata.source_level).toBe("A2");
    expect(byLevel.A1.contenu.metadata.guidance).toBe("fort");
    expect(byLevel.B1.contenu.metadata.cognitive_operations).toContain("justifier");
    expect(byLevel.B2.contenu.metadata.cognitive_operations).toContain("nuancer");
    expect(byLevel.B2.contenu.items.length).toBeLessThan(byLevel.A2.contenu.items.length);
  });

  it("couvre les cinq compétences, dont Structures", async () => {
    const payload = await buildInteractiveS01();
    for (const competence of ["CO", "CE", "EE", "EO", "Structures"]) {
      expect(payload.exercises.some((exercise) => exercise.competence === competence)).toBe(true);
    }
  });
});
