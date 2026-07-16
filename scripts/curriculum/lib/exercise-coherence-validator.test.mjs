import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { validateExerciseCoherence } from "./exercise-coherence-validator.mjs";
import { getExerciseCoherenceRules as getNodeRules } from "./differentiation-referential.mjs";
import { getExerciseCoherenceRules as getDenoRules } from "../../../supabase/functions/_shared/referential-loader.ts";

function closedCorrection(answer, options = [answer, "Autre", "Encore une autre"]) {
  return {
    bonne_reponse: answer,
    preuve_support: "Preuve issue du support.",
    explication_distracteurs: options.filter((option) => option !== answer).map((option) => `${option} ne convient pas.`),
    remediation: "Relisez le passage utile.",
  };
}

function qcmFixture() {
  const options = ["80 heures", "40 heures", "120 heures"];
  return {
    metadata_code: "fixture:qcm:A2",
    titre: "Duree du parcours",
    consigne: "Choisissez la bonne reponse pour chaque question.",
    format: "qcm",
    contenu: { items: [{ question: "Combien d'heures dure le parcours ?", options, bonne_reponse: "80 heures", correction: closedCorrection("80 heures", options) }] },
  };
}

function rule(report, id) {
  return report.rules.find((entry) => entry.rule_id === id);
}

let s01;
beforeAll(async () => {
  s01 = JSON.parse(await readFile(join(process.cwd(), "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json"), "utf8"));
});

describe("garde-fou de coherence structurelle des exercices", () => {
  it("accepte un QCM complet, rendu et corrige", () => {
    const report = validateExerciseCoherence(qcmFixture());
    expect(report.valid).toBe(true);
    expect(report.rules.every((entry) => entry.status === "pass")).toBe(true);
  });

  it("bloque les options absentes, dupliquees ou sans la bonne reponse", () => {
    const missing = qcmFixture();
    missing.contenu.items[0].options = [];
    expect(rule(validateExerciseCoherence(missing), "COHERENCE_OPTIONS_REQUIRED").status).toBe("fail");

    const duplicated = qcmFixture();
    duplicated.contenu.items[0].options = ["80 heures", "80 heures", "40 heures"];
    expect(rule(validateExerciseCoherence(duplicated), "COHERENCE_OPTIONS_UNIQUE").status).toBe("fail");

    const absent = qcmFixture();
    absent.contenu.items[0].bonne_reponse = "25 heures";
    expect(rule(validateExerciseCoherence(absent), "COHERENCE_ANSWER_IN_OPTIONS").status).toBe("fail");
  });

  it("avertit quand le nombre de distracteurs est trop faible", () => {
    const exercise = qcmFixture();
    exercise.contenu.items[0].options = ["80 heures", "40 heures"];
    exercise.contenu.items[0].correction = closedCorrection("80 heures", exercise.contenu.items[0].options);
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_DISTRACTOR_COUNT").status).toBe("warning");
  });

  it("exige exactement un trou visible par item de texte lacunaire", () => {
    const exercise = {
      metadata_code: "fixture:gap:B2",
      titre: "Phrase a completer",
      consigne: "Dans chaque phrase, un mot manque. Completez l'espace.",
      format: "texte_lacunaire",
      contenu: { items: [{ question: "Awa suit un ________ de 80 heures.", bonne_reponse: "parcours", correction: closedCorrection("parcours", []) }] },
    };
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_GAP_COUNT").status).toBe("pass");
    exercise.contenu.items[0].question = "Mot manquant 1";
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_GAP_COUNT").status).toBe("fail");
  });

  it("bloque une consigne qui annonce trois espaces alors que chaque item n'en affiche qu'un", () => {
    const exercise = {
      metadata_code: "fixture:count:B2",
      titre: "Phrase a completer",
      consigne: "Completez les trois espaces.",
      format: "texte_lacunaire",
      contenu: { items: [{ question: "Awa suit un ________ de 80 heures.", bonne_reponse: "parcours", correction: closedCorrection("parcours", []) }] },
    };
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_DECLARED_COUNT_MATCH").status).toBe("fail");
  });

  it("verifie que la banque de mots contient la reponse sans doublon", () => {
    const exercise = {
      metadata_code: "fixture:bank:A1",
      titre: "Phrase a completer",
      consigne: "Completez l'espace avec un mot de la banque.",
      format: "texte_lacunaire",
      contenu: { items: [{ question: "Awa suit un ________.", bonne_reponse: "parcours", banque_mots: ["objectif", "objectif"], correction: closedCorrection("parcours", []) }] },
    };
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_WORD_BANK").status).toBe("fail");
  });

  it("bloque une justification sans attentes et criteres de correction", () => {
    const exercise = qcmFixture();
    exercise.contenu.items[0].justification_required = true;
    exercise.contenu.items[0].justification_prompt = "Justifiez votre choix.";
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_JUSTIFICATION_CONTRACT").status).toBe("fail");
  });

  it("bloque une correction fermee incomplete", () => {
    const exercise = qcmFixture();
    delete exercise.contenu.items[0].correction.remediation;
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_CORRECTION_COMPLETE").status).toBe("fail");
  });

  it("bloque une production sans modele ni criteres", () => {
    const exercise = { metadata_code: "fixture:oral:B1", titre: "Parler", consigne: "Enregistrez une reponse.", format: "production_orale", contenu: { items: [{ question: "Presentez-vous." }] } };
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_OPEN_RUBRIC").status).toBe("fail");
  });

  it("audite le corpus reel : le lexique lacunaire repare passe, les faux textes lacunaires sont detectes", () => {
    const repaired = s01.exercises.find((entry) => entry.metadata_code === "cv2:S01:v3:lexique-texte-lacunaire:B2");
    expect(rule(validateExerciseCoherence(repaired), "COHERENCE_GAP_COUNT").status).toBe("pass");

    const mislabeled = s01.exercises.find((entry) => entry.metadata_code === "cv2:S01:v3:co-comprehension:B2");
    expect(rule(validateExerciseCoherence(mislabeled), "COHERENCE_GAP_COUNT").status).toBe("fail");
  });

  it("accepte une production ouverte dont l'explication fournit le modele de correction", () => {
    const exercise = { metadata_code: "fixture:oral:A1", titre: "Parler", consigne: "Enregistrez une reponse.", format: "production_orale", contenu: { items: [{ question: "Presentez-vous.", bonne_reponse: "", explication: "Nom et ville en une phrase correcte." }] } };
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_OPEN_RUBRIC").status).toBe("pass");
  });

  it("autorise la bonne forme affichee parmi plusieurs choix dans une phrase lacunaire", () => {
    const exercise = {
      metadata_code: "fixture:inline:A1",
      titre: "Choisir la forme",
      consigne: "Completez la phrase avec la forme correcte.",
      format: "texte_lacunaire",
      contenu: { items: [{ question: "Comment tu ________ ? (t'appelles / t'appelle)", bonne_reponse: "t'appelles", correction: closedCorrection("t'appelles", []) }] },
    };
    expect(rule(validateExerciseCoherence(exercise), "COHERENCE_GAP_ANSWER_HIDDEN").status).toBe("pass");
  });

  it("utilise exactement le meme contrat cote Node et Deno", () => {
    expect(getNodeRules()).toEqual(getDenoRules());
  });
});