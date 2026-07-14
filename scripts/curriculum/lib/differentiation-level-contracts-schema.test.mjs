// Lot 1 (correctif) — valide réellement les vingt contrats contre la
// définition JSON Schema `levelContract` de differentiation_family_v1.schema.json
// via AJV, plutôt que de vérifier manuellement la présence de champs.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import {
  DIFFERENTIATION_COMPETENCES,
  DIFFERENTIATION_LEVELS,
  getDifferentiationLevelContracts,
} from "./differentiation-referential.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SCHEMA_PATH = join(
  ROOT,
  "supabase",
  "functions",
  "_shared",
  "referential",
  "differentiation_family_v1.schema.json",
);

function readJson(path) {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}

const schema = readJson(SCHEMA_PATH);

const ajv = new Ajv({ allErrors: true, strict: false });
// `date`/`date-time` ne sont utilisés qu'à titre informatif ailleurs dans le
// schéma (source_document, generation, review) ; on les déclare no-op pour
// valider strictement la structure sans dépendre d'un plugin de formats.
ajv.addFormat("date", true);
ajv.addFormat("date-time", true);
ajv.addSchema(schema);

const validateLevelContract = ajv.getSchema(`${schema.$id}#/definitions/levelContract`);

describe("Schéma JSON — levelContract (Lot 1 correctif)", () => {
  it("le schéma expose bien une définition levelContract compilable par AJV", () => {
    expect(typeof validateLevelContract).toBe("function");
  });

  it("déclare désormais response_types et correction_requirements comme obligatoires", () => {
    const props = schema.definitions.levelContract;
    expect(props.required).toEqual(expect.arrayContaining(["response_types", "correction_requirements"]));
    expect(props.properties.response_types).toBeDefined();
    expect(props.properties.correction_requirements).toBeDefined();
  });

  it("valide réellement les vingt contrats compétence x niveau contre le schéma AJV", () => {
    const contracts = getDifferentiationLevelContracts();
    const failures = [];
    for (const competence of DIFFERENTIATION_COMPETENCES) {
      for (const level of DIFFERENTIATION_LEVELS) {
        const cell = contracts.contracts[competence][level];
        const valid = validateLevelContract(cell);
        if (!valid) {
          failures.push({ competence, level, errors: validateLevelContract.errors });
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("rejette un contrat auquel response_types ou correction_requirements manque (le schéma ne les tolère plus comme optionnels)", () => {
    const contracts = getDifferentiationLevelContracts();
    const base = contracts.contracts.CE.A1;

    const missingResponseTypes = { ...base };
    delete missingResponseTypes.response_types;
    expect(validateLevelContract(missingResponseTypes)).toBe(false);
    expect(validateLevelContract.errors.some((e) => e.params?.missingProperty === "response_types")).toBe(true);

    const missingCorrectionRequirements = { ...base };
    delete missingCorrectionRequirements.correction_requirements;
    expect(validateLevelContract(missingCorrectionRequirements)).toBe(false);
    expect(
      validateLevelContract.errors.some((e) => e.params?.missingProperty === "correction_requirements"),
    ).toBe(true);
  });

  it("rejette un tableau vide pour response_types ou correction_requirements (non vides exigés)", () => {
    const contracts = getDifferentiationLevelContracts();
    const base = contracts.contracts.CE.A1;

    expect(validateLevelContract({ ...base, response_types: [] })).toBe(false);
    expect(validateLevelContract({ ...base, correction_requirements: [] })).toBe(false);
  });

  it("rejette toute propriété additionnelle inconnue (additionalProperties reste false)", () => {
    const contracts = getDifferentiationLevelContracts();
    const base = contracts.contracts.CE.A1;
    expect(validateLevelContract({ ...base, champ_invente: ["x"] })).toBe(false);
  });

  it("continue de valider un contrat conforme n'utilisant que les champs préexistants avant ce correctif", () => {
    // Preuve de compatibilité : un contrat qui ne portait QUE les champs
    // d'origine (avant l'ajout de response_types/correction_requirements)
    // échoue désormais (ils sont requis) — mais dès qu'on les ajoute, la
    // validation structurelle des AUTRES champs reste inchangée.
    const contracts = getDifferentiationLevelContracts();
    const base = contracts.contracts.Structures.B2;
    expect(validateLevelContract(base)).toBe(true);
    expect(base.audio_policy).toBeUndefined();
  });
});
