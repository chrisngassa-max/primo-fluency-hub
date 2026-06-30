import { describe, expect, it } from "vitest";
import { computeExerciseDuration } from "./exercise-duration";

describe("computeExerciseDuration", () => {
  it("CO2, 3 items, script ~20 mots, 2 ecoutes → clamp TCF, pas 720s", () => {
    const script = "Bonjour ceci est un message court pour un rendez vous medical demain matin a dix heures merci";
    const duration = computeExerciseDuration({
      competence: "CO",
      metadata: { code: "CO2" },
      contenu: {
        script_audio: script,
        items: [{}, {}, {}],
      },
      nombre_ecoutes_max: 2,
    });

    expect(duration).not.toBe(720);
    expect(duration).toBeGreaterThanOrEqual(60);
    expect(duration).toBeLessThanOrEqual(91);
  });

  it("CO sans script_audio, 3 items, 2 ecoutes → fallback ~45s par ecoute + items", () => {
    const duration = computeExerciseDuration({
      competence: "CO",
      contenu: {
        items: [{}, {}, {}],
      },
      nombre_ecoutes_max: 2,
    });

    expect(duration).toBe(240);
    expect(duration).toBeLessThan(300);
  });

  it("CO sans script_audio, 1 ecoute → duree reduite", () => {
    const duration = computeExerciseDuration({
      competence: "CO",
      contenu: {
        items: [{}, {}],
      },
      nombre_ecoutes_max: 1,
    });

    expect(duration).toBe(150);
  });

  it("CE avec texte et items → lecture + items + marge", () => {
    const texte = "Cher client votre rendez vous est confirme pour mardi prochain a quatorze heures merci de votre confiance";
    const duration = computeExerciseDuration({
      competence: "CE",
      metadata: { code: "CE2" },
      contenu: {
        texte,
        items: [{}, {}],
      },
    });

    expect(duration).toBeGreaterThanOrEqual(60);
    expect(duration).toBeLessThanOrEqual(130);
  });

  it("CO2 avec valeur brute enorme → clamp TCF max 91s", () => {
    const longScript = Array(500).fill("mot").join(" ");
    const duration = computeExerciseDuration({
      competence: "CO",
      metadata: { code: "CO2" },
      contenu: {
        script_audio: longScript,
        items: Array(10).fill({}),
      },
      nombre_ecoutes_max: 5,
    });

    expect(duration).toBeLessThanOrEqual(91);
    expect(duration).not.toBe(720);
  });

  it("Structures, 0 items → fallback 60s", () => {
    const duration = computeExerciseDuration({
      competence: "Structures",
      contenu: { items: [] },
    });

    expect(duration).toBe(60);
  });
});
