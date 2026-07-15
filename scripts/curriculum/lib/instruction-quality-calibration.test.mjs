import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { validateInstructionQuality } from "./instruction-quality-validator.mjs";

const CORPUS_PATH = join(process.cwd(), "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json");
const CALIBRATION_PATH = join(process.cwd(), "supabase", "functions", "_shared", "referential", "instruction_quality_calibration_s01_v1.json");
let corpus;
let calibration;

beforeAll(async () => {
  [corpus, calibration] = await Promise.all([
    readFile(CORPUS_PATH, "utf8").then(JSON.parse),
    readFile(CALIBRATION_PATH, "utf8").then(JSON.parse),
  ]);
});

function buildEntry(testCase) {
  const source = corpus.exercises.find((entry) => entry.metadata_code === testCase.source_metadata_code);
  if (!source) throw new Error(`Source absente : ${testCase.source_metadata_code}`);
  const entry = structuredClone(source);
  entry.consigne = testCase.consigne;
  if (testCase.title_override) entry.titre = testCase.title_override;
  if (testCase.item_patch) {
    const item = entry.contenu.items[testCase.item_patch.index];
    item.justification_prompt = testCase.item_patch.justification_prompt_template
      .replace("{{bonne_reponse}}", item.bonne_reponse);
  }
  return entry;
}

describe("corpus candidat de calibration des consignes S01", () => {
  it("contient exactement 20 cas et ne prétend pas être validé humainement", () => {
    expect(calibration.cases).toHaveLength(20);
    expect(calibration.status).toBe("candidate_pending_human_validation");
    expect(calibration.approved_by).toBeNull();
    expect(calibration.approved_at).toBeNull();
    expect(calibration.cases.every((entry) => entry.human_validation.status === "pending")).toBe(true);
  });

  it("couvre les quatre niveaux, les cinq compétences et les formats principaux", () => {
    const sources = calibration.cases.map(buildEntry);
    expect(new Set(sources.map((entry) => entry.niveau_vise))).toEqual(new Set(["A1", "A2", "B1", "B2"]));
    expect(new Set(sources.map((entry) => entry.competence))).toEqual(new Set(["CE", "CO", "EE", "EO", "Structures"]));
    const formats = new Set(sources.map((entry) => entry.format));
    for (const format of ["qcm", "appariement", "texte_lacunaire", "transformation", "production_ecrite", "production_orale"]) {
      expect(formats.has(format), format).toBe(true);
    }
  });

  it("reproduit les verdicts machine candidats sans les confondre avec un accord humain", () => {
    for (const testCase of calibration.cases) {
      const report = validateInstructionQuality(buildEntry(testCase));
      const nonPass = report.rules.filter((rule) => rule.status !== "pass");
      const actualOverall = report.valid
        ? (nonPass.some((rule) => rule.status === "warning") ? "warning" : "pass")
        : "fail";
      expect(actualOverall, testCase.id).toBe(testCase.expected.overall);
      if (testCase.expected.rule_id) {
        const target = report.rules.find((rule) => rule.rule_id === testCase.expected.rule_id);
        expect(target?.status, testCase.id).toBe(testCase.expected.rule_status);
      } else {
        expect(nonPass, testCase.id).toEqual([]);
      }
    }
  });
});