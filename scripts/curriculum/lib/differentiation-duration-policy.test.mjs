// Lot 1 (correctif, point 2) — politique temporelle "warning" (opérationnelle
// mais recalibrable), sans toucher aux durées réelles du corpus figé.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DIFFERENTIATION_COMPETENCES,
  DIFFERENTIATION_LEVELS,
  getDifferentiationLevelContracts,
} from "./differentiation-referential.mjs";
import {
  effectiveDurationPolicySeverity,
  isBlockingGateSatisfied,
} from "./duration-policy-gate.mjs";
import { diffAgainstBaseline } from "./s01-snapshot-diff.mjs";
import { buildInteractiveS01 } from "../generate-s01-interactive.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BASELINE_PATH = join(
  ROOT,
  "content",
  "curriculum",
  "v2",
  "S01-v3",
  "__snapshots__",
  "s01-v3-corpus-baseline.json",
);

async function loadBaseline() {
  return JSON.parse(await readFile(BASELINE_PATH, "utf8"));
}

function allTwentyContracts() {
  const contracts = getDifferentiationLevelContracts();
  const cells = [];
  for (const competence of DIFFERENTIATION_COMPETENCES) {
    for (const level of DIFFERENTIATION_LEVELS) {
      cells.push({ competence, level, contract: contracts.contracts[competence][level] });
    }
  }
  return cells;
}

describe("Politique temporelle des vingt contrats — mode warning (Lot 1 correctif, point 2)", () => {
  it("1. les vingt contrats utilisent mode: \"warning\"", () => {
    const cells = allTwentyContracts();
    expect(cells).toHaveLength(20);
    for (const { competence, level, contract } of cells) {
      expect(contract.duration_policy.mode, `${competence}/${level}`).toBe("warning");
    }
  });

  it("2. aucun contrat ne reste en mode \"informative\"", () => {
    for (const { competence, level, contract } of allTwentyContracts()) {
      expect(contract.duration_policy.mode, `${competence}/${level}`).not.toBe("informative");
    }
  });

  it("conserve target_seconds et calibration_id à null tant qu'aucune cible/calibration n'est validée", () => {
    for (const { competence, level, contract } of allTwentyContracts()) {
      expect(contract.duration_policy.target_seconds, `${competence}/${level}`).toBeNull();
      expect(contract.duration_policy.calibration_id, `${competence}/${level}`).toBeNull();
    }
  });

  it("3. aucun contrat n'utilise \"blocking\" sans cible et calibration (les vingt contrats actuels, plus des fixtures couvrant les trois conditions)", () => {
    for (const { competence, level, contract } of allTwentyContracts()) {
      if (contract.duration_policy.mode === "blocking") {
        expect(isBlockingGateSatisfied(contract.duration_policy), `${competence}/${level}`).toBe(true);
      }
    }

    // Fixture : "blocking" sans aucune cible ni calibration -> refusé.
    expect(isBlockingGateSatisfied({ mode: "blocking", target_seconds: null, calibration_id: null })).toBe(false);
    // Fixture : cible positive mais pas de calibration_id -> refusé.
    expect(isBlockingGateSatisfied({ mode: "blocking", target_seconds: 300, calibration_id: null })).toBe(false);
    // Fixture : cible + calibration_id posés, mais calibration absente du
    // registre (aucune campagne de calibration versionnée n'existe encore)
    // -> refusé : condition 3 (statut explicitement validé) non remplie.
    expect(
      isBlockingGateSatisfied({ mode: "blocking", target_seconds: 300, calibration_id: "CAL-2026-S01" }, {}),
    ).toBe(false);
    // Fixture : cible + calibration_id + registre déclarant un statut "en
    // cours" (pas "validated") -> toujours refusé.
    expect(
      isBlockingGateSatisfied(
        { mode: "blocking", target_seconds: 300, calibration_id: "CAL-2026-S01" },
        { "CAL-2026-S01": { status: "en_cours" } },
      ),
    ).toBe(false);
    // Fixture : les trois conditions réunies (cible positive, calibration_id
    // non vide, registre validé) -> seul cas accepté.
    expect(
      isBlockingGateSatisfied(
        { mode: "blocking", target_seconds: 300, calibration_id: "CAL-2026-S01" },
        { "CAL-2026-S01": { status: "validated" } },
      ),
    ).toBe(true);
  });

  it("6. une politique non calibrée produit au maximum un avertissement, jamais un échec bloquant", () => {
    // Les vingt contrats réels (mode warning, non calibrés) restent à
    // "warning".
    for (const { contract } of allTwentyContracts()) {
      expect(effectiveDurationPolicySeverity(contract.duration_policy)).toBe("warning");
    }
    // Un mode "blocking" mal posé (non calibré) est plafonné à "warning" —
    // jamais "blocking" — par effectiveDurationPolicySeverity().
    expect(effectiveDurationPolicySeverity({ mode: "blocking", target_seconds: null, calibration_id: null })).toBe(
      "warning",
    );
    expect(
      effectiveDurationPolicySeverity({ mode: "blocking", target_seconds: 300, calibration_id: "CAL-X" }, {}),
    ).toBe("warning");
    // Seul un "blocking" pleinement calibré produit réellement "blocking".
    expect(
      effectiveDurationPolicySeverity(
        { mode: "blocking", target_seconds: 300, calibration_id: "CAL-X" },
        { "CAL-X": { status: "validated" } },
      ),
    ).toBe("blocking");
  });

  it("4. les 59 exercices du corpus S01-v3 conservent exactement leurs durée_limite_secondes actuelles", async () => {
    const baseline = await loadBaseline();
    const payload = await buildInteractiveS01();
    expect(payload.exercises).toHaveLength(59);
    for (const entry of payload.exercises) {
      const expected = baseline.exercises[entry.metadata_code];
      expect(expected, entry.metadata_code).toBeDefined();
      expect(entry.duree_limite_secondes, entry.metadata_code).toBe(expected.duree_limite_secondes);
    }
  });

  it("5. le snapshot du Lot 0 reste intégralement vert après ce correctif (aucune violation d'enveloppe)", async () => {
    const baseline = await loadBaseline();
    const payload = await buildInteractiveS01();
    expect(diffAgainstBaseline(baseline, payload)).toEqual([]);
  });
});
