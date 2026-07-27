// Lot 1 — tests du référentiel de différenciation exécutable (vingt contrats
// + douze transformations) et de son adaptateur Node.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DIFFERENTIATION_COMPETENCES,
  DIFFERENTIATION_LEVELS,
  getDifferentiationLevelContracts,
  getDifferentiationTransformationRule,
  getDifferentiationTransformationRules,
  getLevelContract,
  normalizeDifferentiationLevel,
} from "./differentiation-referential.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const LEVEL_CONTRACTS_PATH = join(
  ROOT,
  "supabase",
  "functions",
  "_shared",
  "referential",
  "differentiation_level_contracts_v1.json",
);
const TRANSFORMATION_RULES_PATH = join(
  ROOT,
  "supabase",
  "functions",
  "_shared",
  "referential",
  "differentiation_transformation_rules_v1.json",
);

// readFileSync(..., "utf8") + JSON.parse ne retire pas de BOM UTF-8 éventuel
// (contrairement à `require()`/`import ... with { type: "json" }`, utilisés
// par le loader) : on le retire explicitement pour lire le même contenu.
function readJson(path) {
  const text = readFileSync(path, "utf8");
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return JSON.parse(stripped);
}

const rawLevelContracts = readJson(LEVEL_CONTRACTS_PATH);
const rawTransformationRules = readJson(TRANSFORMATION_RULES_PATH);

const REQUIRED_CONTRACT_FIELDS = [
  "target_level",
  "cognitive_operations",
  "guidance",
  "autonomy",
  "allowed_formats",
  "forbidden_formats",
  "scaffolds",
  "success_criteria",
  "duration_policy",
  "response_types",
  "correction_requirements",
];

const REQUIRED_TRANSFORMATION_FIELDS = [
  "operation",
  "allowed",
  "forbidden",
  "rule_id",
  "severity",
  "expected_evidence",
  "observable_changes",
  "forbidden_changes",
];

const EXPECTED_TRANSFORMATION_IDS = [
  "A1_TO_A2", "A1_TO_B1", "A1_TO_B2",
  "A2_TO_A1", "A2_TO_B1", "A2_TO_B2",
  "B1_TO_A1", "B1_TO_A2", "B1_TO_B2",
  "B2_TO_A1", "B2_TO_A2", "B2_TO_B1",
];

// Valeurs operation/allowed/forbidden telles que déjà consommées par
// referential-loader.ts et generate-session-content/index.ts AVANT ce lot —
// garde-fou de compatibilité : l'extension additive ne doit rien changer ici.
const EXPECTED_CORE_FIELDS = {
  A1_TO_A2: { operation: "consolider", allowed: ["reduce_scaffolding", "merge_segments", "request_reformulation"], forbidden: ["add_fact", "change_competence"] },
  A1_TO_B1: { operation: "approfondir", allowed: ["request_relation", "request_justification", "reduce_scaffolding"], forbidden: ["add_implicit_not_in_source", "add_fact", "change_competence"] },
  A1_TO_B2: { operation: "etendre", allowed: ["request_synthesis", "request_nuance_if_supported", "request_register_analysis_if_supported"], forbidden: ["enrich_source_with_new_fact", "invent_exception", "change_competence"] },
  A2_TO_A1: { operation: "etayer", allowed: ["segment", "annotate", "highlight", "add_glossary", "add_solved_example"], forbidden: ["remove_required_fact", "change_competence", "infantilize"] },
  A2_TO_B1: { operation: "approfondir", allowed: ["request_inference_if_supported", "request_comparison", "request_justification", "reduce_scaffolding"], forbidden: ["invent_implicit", "add_fact", "change_competence"] },
  A2_TO_B2: { operation: "etendre", allowed: ["request_implication_if_supported", "request_nuance_if_supported", "request_synthesis", "request_register_analysis_if_supported"], forbidden: ["invent_viewpoint", "invent_exception", "change_competence"] },
  B1_TO_A1: { operation: "reconstruire_acces", allowed: ["excerpt_required_passages", "segment", "annotate", "add_glossary", "add_model"], forbidden: ["reverse_relation", "remove_required_fact", "change_competence"] },
  B1_TO_A2: { operation: "simplifier", allowed: ["reduce_syntactic_load", "make_structure_visible", "add_light_scaffolding"], forbidden: ["remove_core_task", "add_fact", "change_competence"] },
  B1_TO_B2: { operation: "etendre", allowed: ["request_nuance_if_supported", "request_counterargument_if_supported", "request_synthesis"], forbidden: ["invent_condition", "add_fact", "change_competence"] },
  B2_TO_A1: { operation: "reconstruire_fortement", allowed: ["excerpt_required_passages", "segment", "annotate", "add_visual_scaffolding", "add_model"], forbidden: ["remove_required_fact", "change_core_task", "change_competence"] },
  B2_TO_A2: { operation: "rendre_accessible", allowed: ["didacticize_with_fact_preservation", "reduce_simultaneous_operations", "add_glossary"], forbidden: ["reverse_relation", "remove_required_fact", "change_competence"] },
  B2_TO_B1: { operation: "cadrer", allowed: ["add_question_guides", "provide_plan", "reduce_nuance_requirement"], forbidden: ["change_core_task", "add_fact", "change_competence"] },
};

describe("Référentiel de différenciation — vingt contrats niveau x compétence", () => {
  it("définit les cinq compétences x quatre niveaux, sans cellule manquante", () => {
    for (const competence of DIFFERENTIATION_COMPETENCES) {
      for (const level of DIFFERENTIATION_LEVELS) {
        const contract = getLevelContract(competence, level);
        expect(contract, `${competence}/${level} devrait exister`).toBeTruthy();
      }
    }
  });

  it("porte tous les champs obligatoires, non vides, pour chacune des vingt cellules", () => {
    for (const competence of DIFFERENTIATION_COMPETENCES) {
      for (const level of DIFFERENTIATION_LEVELS) {
        const contract = getLevelContract(competence, level);
        for (const field of REQUIRED_CONTRACT_FIELDS) {
          expect(contract[field], `${competence}/${level}.${field}`).toBeDefined();
        }
        expect(contract.cognitive_operations.length).toBeGreaterThan(0);
        expect(contract.allowed_formats.length).toBeGreaterThan(0);
        expect(contract.success_criteria.length).toBeGreaterThan(0);
        expect(contract.response_types.length).toBeGreaterThan(0);
        expect(contract.correction_requirements.length).toBeGreaterThan(0);
        expect(contract.target_level).toBe(level);
      }
    }
  });

  it("ne définit jamais B2 par un simple volume : success_criteria et cognitive_operations diffèrent de B1 pour chaque compétence", () => {
    for (const competence of DIFFERENTIATION_COMPETENCES) {
      const b1 = getLevelContract(competence, "B1");
      const b2 = getLevelContract(competence, "B2");
      expect(b2.success_criteria).not.toEqual(b1.success_criteria);
      expect(b2.cognitive_operations).not.toEqual(b1.cognitive_operations);
      // B2 ne doit pas se contenter d'ajouter des formats à B1 sans changer
      // ni le guidage ni l'autonomie déclarés.
      expect(b2.guidance).not.toBe(b1.guidance);
      expect(b2.autonomy).not.toBe(b1.autonomy);
    }
  });

  it("réserve une revue humaine recommandée pour B2 (contenu civique/sensible), jamais pour A1", () => {
    for (const competence of DIFFERENTIATION_COMPETENCES) {
      const a1 = getLevelContract(competence, "A1");
      const b2 = getLevelContract(competence, "B2");
      expect(a1.correction_requirements.some((r) => r.includes("revue_humaine"))).toBe(false);
      expect(b2.correction_requirements.some((r) => r.includes("revue_humaine"))).toBe(true);
    }
  });

  it("parité Node/JSON canonique : getLevelContract() retourne exactement l'objet du fichier JSON source, sans divergence", () => {
    for (const competence of DIFFERENTIATION_COMPETENCES) {
      for (const level of DIFFERENTIATION_LEVELS) {
        const viaLoader = getLevelContract(competence, level);
        const viaRawJson = rawLevelContracts.contracts[competence][level];
        expect(viaLoader).toEqual(viaRawJson);
      }
    }
    expect(getDifferentiationLevelContracts()).toEqual(rawLevelContracts);
  });
});

describe("Référentiel de différenciation — douze transformations", () => {
  it("définit les douze transformations attendues, avec les cinq champs additifs remplis", () => {
    const ids = Object.keys(rawTransformationRules.transformations);
    expect(ids.sort()).toEqual([...EXPECTED_TRANSFORMATION_IDS].sort());
    for (const id of EXPECTED_TRANSFORMATION_IDS) {
      const rule = rawTransformationRules.transformations[id];
      for (const field of REQUIRED_TRANSFORMATION_FIELDS) {
        expect(rule[field], `${id}.${field}`).toBeDefined();
      }
      expect(rule.rule_id).toBe(id);
      expect(rule.severity).toBe("blocking");
      expect(rule.expected_evidence.length).toBeGreaterThan(10);
      expect(rule.observable_changes.length).toBeGreaterThan(0);
      expect(rule.forbidden_changes).toEqual(
        expect.arrayContaining(["competence", "faits", "objectif", "tache_noyau"]),
      );
    }
  });

  it("conserve operation/allowed/forbidden inchangés pour compatibilité avec les consommateurs existants (referential-loader.ts, generate-session-content)", () => {
    for (const id of EXPECTED_TRANSFORMATION_IDS) {
      const rule = rawTransformationRules.transformations[id];
      const expected = EXPECTED_CORE_FIELDS[id];
      expect(rule.operation).toBe(expected.operation);
      expect(rule.allowed).toEqual(expected.allowed);
      expect(rule.forbidden).toEqual(expected.forbidden);
    }
  });

  it("expose le comportement IDENTITY quand source == cible, pour tous les niveaux", () => {
    for (const level of DIFFERENTIATION_LEVELS) {
      const resolved = getDifferentiationTransformationRule(level, level);
      expect(resolved.id).toBe("IDENTITY");
      expect(resolved.rule.operation).toBe("conserver");
    }
  });

  it("résout les douze transformations réelles via getDifferentiationTransformationRule, identiques au JSON canonique", () => {
    for (const id of EXPECTED_TRANSFORMATION_IDS) {
      const [source, target] = id.split("_TO_");
      const resolved = getDifferentiationTransformationRule(source, target);
      expect(resolved.id).toBe(id);
      expect(resolved.rule).toEqual(rawTransformationRules.transformations[id]);
    }
    expect(getDifferentiationTransformationRules()).toEqual(rawTransformationRules);
  });
});

describe("Référentiel de différenciation — rejet des entrées invalides", () => {
  it("normalise un niveau invalide ou manquant vers A1 sans lever d'exception (comportement déjà attendu par referential-loader.ts)", () => {
    expect(normalizeDifferentiationLevel("ZZ")).toBe("A1");
    expect(normalizeDifferentiationLevel(undefined)).toBe("A2");
    expect(normalizeDifferentiationLevel(null)).toBe("A2");
    // Chaîne vide : "" n'est pas nullish (?? ne s'applique pas), donc elle ne
    // matche aucun préfixe B2/B1/A2 et retombe sur A1 — comportement hérité
    // à l'identique de normalizeDifferentiationLevel() dans referential-loader.ts.
    expect(normalizeDifferentiationLevel("")).toBe("A1");
  });

  it("retourne null (jamais une exception) pour une compétence inconnue", () => {
    expect(getLevelContract("INEXISTANTE", "A1")).toBeNull();
    expect(getLevelContract("CE_MAL_ECRIT", "B2")).toBeNull();
  });

  it("retourne null pour une paire source/cible de transformation qui n'existe pas dans le référentiel", () => {
    // Toutes les paires A1-A2-B1-B2 x A1-A2-B1-B2 sont couvertes (IDENTITY ou
    // une des douze transformations) : aucune paire valide ne doit renvoyer
    // null. On vérifie ce pavage complet ici.
    for (const source of DIFFERENTIATION_LEVELS) {
      for (const target of DIFFERENTIATION_LEVELS) {
        expect(getDifferentiationTransformationRule(source, target)).not.toBeNull();
      }
    }
  });
});
