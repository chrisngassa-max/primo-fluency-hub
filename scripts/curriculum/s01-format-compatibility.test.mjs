// Lot 1 (correctif) — vérifie automatiquement que chaque combinaison
// compétence x niveau x format réellement présente dans le corpus S01-v3
// figé (Lot 0) est couverte par les `allowed_formats` des vingt contrats de
// différenciation (Lot 1). Ce test doit échouer si le corpus utilise un
// format qu'un contrat interdit implicitement, ou si un contrat manque.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getDifferentiationLevelContracts } from "./lib/differentiation-referential.mjs";
import { findFormatCompatibilityMismatches } from "./lib/s01-format-compatibility.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE_PATH = join(
  ROOT,
  "content",
  "curriculum",
  "v2",
  "S01-v3",
  "__snapshots__",
  "s01-v3-corpus-baseline.json",
);

function loadBaseline() {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

describe("Compatibilité corpus S01-v3 x contrats de différenciation (Lot 1 correctif)", () => {
  it("couvre bien 38 combinaisons compétence x niveau x format distinctes dans le corpus figé (garde-fou du test lui-même)", () => {
    const baseline = loadBaseline();
    const distinct = new Set(
      Object.values(baseline.exercises).map((e) => `${e.competence}|${e.niveau_vise}|${e.format}`),
    );
    expect(distinct.size).toBe(38);
  });

  it("n'a plus aucune incompatibilité entre le corpus figé et allowed_formats des vingt contrats", () => {
    const baseline = loadBaseline();
    const contracts = getDifferentiationLevelContracts();
    const mismatches = findFormatCompatibilityMismatches(baseline.exercises, contracts);
    expect(mismatches).toEqual([]);
  });

  it("preuve : le comparateur détecte réellement une incompatibilité injectée dans une fixture mutée, sans jamais modifier le corpus ou les contrats réels", () => {
    const baseline = loadBaseline();
    const contracts = getDifferentiationLevelContracts();

    // Le comparateur, sur les données réelles, ne remonte rien (cf. test
    // précédent) : on le confirme encore ici avant de le mettre en défaut.
    expect(findFormatCompatibilityMismatches(baseline.exercises, contracts)).toEqual([]);

    // Fixture A — copie des contrats avec un format retiré d'une cellule
    // réellement utilisée par le corpus : doit être détecté.
    const narrowedContracts = structuredClone(contracts);
    narrowedContracts.contracts.CE.A1.allowed_formats = narrowedContracts.contracts.CE.A1.allowed_formats.filter(
      (f) => f !== "qcm",
    );
    const violationsNarrowed = findFormatCompatibilityMismatches(baseline.exercises, narrowedContracts);
    expect(violationsNarrowed.some((m) => m.competence === "CE" && m.level === "A1" && m.format === "qcm")).toBe(
      true,
    );

    // Fixture B — copie du corpus avec un format inventé pour une cellule
    // existante : doit être détecté comme non couvert par allowed_formats.
    const mutatedBaseline = structuredClone(baseline);
    const [someCode] = Object.keys(mutatedBaseline.exercises);
    mutatedBaseline.exercises[someCode] = {
      ...mutatedBaseline.exercises[someCode],
      competence: "CE",
      niveau_vise: "A1",
      format: "format_qui_nexiste_pas",
    };
    const violationsFormat = findFormatCompatibilityMismatches(mutatedBaseline.exercises, contracts);
    expect(
      violationsFormat.some((m) => m.competence === "CE" && m.level === "A1" && m.format === "format_qui_nexiste_pas"),
    ).toBe(true);

    // Fixture C — copie des contrats à laquelle on retire une cellule
    // entière (ex. CO/B1) : toute combinaison réelle CO/B1/* doit ressortir
    // en `no_contract`.
    const missingContract = structuredClone(contracts);
    delete missingContract.contracts.CO.B1;
    const violationsMissing = findFormatCompatibilityMismatches(baseline.exercises, missingContract);
    expect(violationsMissing.some((m) => m.competence === "CO" && m.level === "B1" && m.reason === "no_contract")).toBe(
      true,
    );
  });
});
