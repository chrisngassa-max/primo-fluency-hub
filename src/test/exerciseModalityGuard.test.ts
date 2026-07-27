import { describe, expect, it } from "vitest";
import {
  assertExerciseModality,
  getExerciseReadingSupport,
  validateExerciseModality,
} from "@/lib/exerciseModalityGuard";

const base = {
  titre: "Exercice",
  consigne: "Réalise la tâche.",
};

describe("exerciseModalityGuard", () => {
  it("refuse une CO sans audio", () => {
    const issues = validateExerciseModality({
      ...base,
      competence: "CO",
      format: "qcm",
      contenu: { items: [{ question: "Qui parle ?" }] },
    });
    expect(issues.some((issue) => issue.code === "missing_listening_control")).toBe(true);
  });

  it("accepte une CO avec script et question", () => {
    expect(() => assertExerciseModality({
      ...base,
      competence: "CO",
      format: "qcm",
      contenu: {
        script_audio: "Bonjour, je voudrais prendre rendez-vous demain matin.",
        items: [{ question: "Pourquoi téléphone-t-il ?" }],
      },
    })).not.toThrow();
  });

  it("refuse une CE sans texte support", () => {
    const issues = validateExerciseModality({
      ...base,
      competence: "CE",
      format: "qcm",
      contenu: { items: [{ question: "Que dit le document ?" }] },
    });
    expect(issues.some((issue) => issue.code === "missing_reading_support")).toBe(true);
  });

  it("reconnaît les anciens champs de texte support", () => {
    expect(getExerciseReadingSupport({ texte_support: "Un texte à lire." })).toBe("Un texte à lire.");
  });

  it("refuse une EE sans zone de production", () => {
    const issues = validateExerciseModality({
      ...base,
      competence: "EE",
      format: "qcm",
      contenu: {},
    });
    expect(issues.some((issue) => issue.code === "missing_writing_control")).toBe(true);
  });

  it("refuse une EO sans format d'enregistrement", () => {
    const issues = validateExerciseModality({
      ...base,
      competence: "EO",
      format: "qcm",
      contenu: {},
    });
    expect(issues.some((issue) => issue.code === "missing_recording_control")).toBe(true);
  });
});
