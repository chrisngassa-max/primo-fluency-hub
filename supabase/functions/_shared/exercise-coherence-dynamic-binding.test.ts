import { describe, expect, it } from "vitest";
import { validateAndFix, validateExercise } from "./exercise-validator.ts";
import { runLayerL1Structure } from "./validation-chain.ts";

function validDynamicQcm() {
  const options = ["80 heures", "40 heures", "120 heures"];
  return {
    titre: "Durée du parcours",
    consigne: "Choisissez la bonne réponse.",
    competence: "CE",
    format: "qcm",
    niveau_vise: "A2",
    difficulte: 2,
    contenu: {
      texte: "Awa suit un parcours de formation qui dure exactement quatre-vingts heures.",
      items: [{
        question: "Combien d'heures dure le parcours ?",
        options,
        bonne_reponse: "80 heures",
        correction: {
          bonne_reponse: "80 heures",
          preuve_support: "Le parcours dure quatre-vingts heures.",
          explication_distracteurs: ["40 heures est trop court.", "120 heures est trop long."],
          remediation: "Relisez la durée indiquée dans le texte.",
        },
      }],
    },
  };
}

describe("branchement dynamique du garde-fou de cohérence", () => {
  it("laisse passer un exercice complet", () => {
    const result = validateExercise(validDynamicQcm());
    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.code.startsWith("COHERENCE_"))).toBe(false);
  });

  it("remonte une incohérence lacunaire dans validateExercise et dans L1", () => {
    const exercise = validDynamicQcm();
    exercise.format = "texte_lacunaire";
    exercise.contenu.items[0].question = "Mot manquant 1";
    const direct = validateExercise(exercise);
    expect(direct.issues.some((issue) => issue.code === "COHERENCE_GAP_COUNT" && issue.severity === "error")).toBe(true);
    const layer = runLayerL1Structure(exercise);
    expect(layer.some((issue) => issue.code === "COHERENCE_GAP_COUNT" && issue.layer === "L1_structure")).toBe(true);
  });

  it("utilise les plafonds progressifs de caractères au lieu de la limite universelle de quinze mots", () => {
    const exercise = validDynamicQcm();
    exercise.niveau_vise = "A1";
    exercise.consigne = "Choisissez la réponse qui correspond exactement aux informations données dans le texte affiché sur votre écran.";
    const shortEnough = validateExercise(exercise);
    expect(shortEnough.issues.some((issue) => issue.code === "consigne_too_long")).toBe(false);
    expect(shortEnough.issues.some((issue) => issue.code === "INSTRUCTION_TOO_COMPLEX")).toBe(false);

    exercise.consigne = "L".repeat(181);
    const tooLong = validateExercise(exercise);
    expect(tooLong.issues.some((issue) => issue.code === "INSTRUCTION_TOO_COMPLEX" && issue.severity === "warning")).toBe(true);
  });

  it("bloque une anomalie structurelle sans appeler la régénération IA", async () => {
    const exercise = validDynamicQcm();
    delete exercise.contenu.items[0].correction.remediation;
    await expect(validateAndFix(exercise, { niveau: "A2" })).resolves.toBeNull();
  });
});