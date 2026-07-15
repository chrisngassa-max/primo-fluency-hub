import { describe, expect, it } from "vitest";
import { validateInstructionQuality } from "./instruction-quality-validator.mjs";
import { getInstructionQualityRules as getNodeRules } from "./differentiation-referential.mjs";
import { getInstructionQualityRules as getDenoRules } from "../../../supabase/functions/_shared/referential-loader.ts";

function fixture(overrides = {}) {
  return {
    metadata_code: "fixture:instruction:A2",
    titre: "Compléter une phrase",
    consigne: "Dans chaque phrase, un mot manque. Choisissez parmi les quatre propositions le mot qui complète correctement la phrase.",
    competence: "CE",
    format: "appariement",
    niveau_vise: "A2",
    contenu: {
      items: [{
        question: "Son ________ est clair.",
        options: ["objectif", "devoir"],
        bonne_reponse: "objectif",
      }],
    },
    ...overrides,
  };
}

function rule(report, id) {
  return report.rules.find((entry) => entry.rule_id === id);
}

describe("garde-fou qualité des consignes", () => {
  it("accepte une consigne explicite, actionnable et cohérente avec le format", () => {
    const report = validateInstructionQuality(fixture());
    expect(report.valid).toBe(true);
    expect(report.rules.every((entry) => entry.status === "pass")).toBe(true);
  });

  it("bloque le jargon destiné à l'apprenant et propose une reformulation", () => {
    const report = validateInstructionQuality(fixture({
      consigne: "Associez chaque exemple d'emploi au mot approprié.",
    }));
    expect(rule(report, "INSTRUCTION_JARGON_UNEXPLAINED").status).toBe("fail");
    expect(rule(report, "INSTRUCTION_JARGON_UNEXPLAINED").suggested_rewrite).toBeTruthy();
  });

  it("bloque une consigne sans action ni objet de réponse clair", () => {
    const report = validateInstructionQuality(fixture({ consigne: "À vous de jouer." }));
    expect(rule(report, "INSTRUCTION_ACTION_MISSING").status).toBe("fail");
    expect(rule(report, "INSTRUCTION_OUTPUT_UNCLEAR").status).toBe("fail");
  });

  it("signale plusieurs actions sans ordre explicite", () => {
    const report = validateInstructionQuality(fixture({
      consigne: "Choisissez un mot et expliquez votre réponse dans la phrase.",
    }));
    expect(rule(report, "INSTRUCTION_MULTISTEP_UNMARKED").status).toBe("warning");
  });

  it("bloque une action incompatible avec le format interactif", () => {
    const report = validateInstructionQuality(fixture({
      format: "qcm",
      consigne: "Écrivez un texte à partir de la question.",
    }));
    expect(rule(report, "INSTRUCTION_FORMAT_MISMATCH").status).toBe("fail");
  });

  it("bloque une réponse révélée dans la justification", () => {
    const entry = fixture();
    entry.contenu.items[0].justification_prompt = "Justifiez pourquoi objectif est la bonne réponse.";
    const report = validateInstructionQuality(entry);
    expect(rule(report, "INSTRUCTION_ANSWER_LEAK").status).toBe("fail");
  });

  it("avertit sur une consigne trop longue et un titre incohérent", () => {
    const report = validateInstructionQuality(fixture({
      titre: "Associer chaque mot à sa définition",
      niveau_vise: "A1",
      consigne: `Dans chaque phrase, choisissez le mot qui convient. ${"Lisez attentivement la phrase. ".repeat(8)}`,
    }));
    expect(rule(report, "INSTRUCTION_TOO_COMPLEX").status).toBe("warning");
    expect(rule(report, "INSTRUCTION_TITLE_MISMATCH").status).toBe("warning");
  });

  it("utilise exactement le même contrat côté Node et Deno", () => {
    expect(getNodeRules()).toEqual(getDenoRules());
  });
});