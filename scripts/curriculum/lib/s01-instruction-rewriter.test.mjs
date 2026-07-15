import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { validateInstructionQuality } from "./instruction-quality-validator.mjs";
import {
  getS01InstructionPolicyStatus,
  getS01RewrittenInstruction,
  rewriteS01Instructions,
} from "./s01-instruction-rewriter.mjs";

const DATA_PATH = join(process.cwd(), "content", "curriculum", "v2", "S01-v3", "exercices-interactifs.json");
let payload;

beforeAll(async () => {
  payload = JSON.parse(await readFile(DATA_PATH, "utf8"));
});

function protectedView(entry) {
  const clone = structuredClone(entry);
  delete clone.consigne;
  delete clone.contenu?.metadata?.instruction_policy_version;
  delete clone.contenu?.metadata?.instruction_human_validation_status;
  return clone;
}

describe("réécriture complète des consignes S01", () => {
  it("couvre exactement les 59 exercices générés", () => {
    expect(payload.exercises).toHaveLength(59);
    for (const exercise of payload.exercises) {
      expect(getS01RewrittenInstruction(exercise)).toBe(exercise.consigne);
    }
  });

  it("fait passer les huit contrôles de qualité sur les 59 consignes", () => {
    for (const exercise of payload.exercises) {
      const report = validateInstructionQuality(exercise);
      expect(
        report.rules.filter((rule) => rule.status !== "pass"),
        exercise.metadata_code,
      ).toEqual([]);
    }
  });

  it("conserve compétence, format, support, faits, questions, réponses et nombre d’items", () => {
    const originals = payload.exercises.map((entry) => ({
      ...structuredClone(entry),
      consigne: `Ancienne consigne de ${entry.metadata_code}`,
    }));
    const rewritten = rewriteS01Instructions(originals);
    expect(rewritten).toHaveLength(originals.length);
    originals.forEach((original, index) => {
      expect(protectedView(rewritten[index])).toEqual(protectedView(original));
      expect(rewritten[index].contenu.items).toHaveLength(original.contenu.items.length);
    });
  });

  it("marque chaque proposition comme en attente de validation humaine", () => {
    expect(getS01InstructionPolicyStatus()).toEqual({
      policy_version: "instruction-quality-v1",
      human_validation_status: "pending_pedagogical_owner",
    });
    for (const exercise of payload.exercises) {
      expect(exercise.contenu.metadata.instruction_human_validation_status).toBe("pending_pedagogical_owner");
    }
  });

  it("refuse silencieusement aucun exercice non couvert", () => {
    expect(() => getS01RewrittenInstruction({
      metadata_code: "cv2:S01:v3:famille-inconnue:A2",
      niveau_vise: "A2",
    })).toThrow(/instruction missing/i);
  });
});