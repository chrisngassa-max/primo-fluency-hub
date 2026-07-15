// Adaptateur Node pour le référentiel de différenciation.
//
// `supabase/functions/_shared/referential-loader.ts` est un module Deno
// (syntaxe d'import relatif .ts, exécuté par les Edge Functions Supabase) ;
// aucun script Node de scripts/curriculum/ ne peut l'importer directement.
// Ce module lit les MÊMES fichiers JSON canoniques (source unique de vérité,
// aucune règle pédagogique dupliquée ici) et expose les mêmes signatures que
// leurs équivalents Deno, pour que generate-s01-interactive.mjs (Lot 2)
// consomme le référentiel plutôt que des cartes littérales.
import differentiationTransformationRulesData from "../../../supabase/functions/_shared/referential/differentiation_transformation_rules_v1.json" with { type: "json" };
import differentiationLevelContractsData from "../../../supabase/functions/_shared/referential/differentiation_level_contracts_v1.json" with { type: "json" };
import instructionQualityRulesData from "../../../supabase/functions/_shared/referential/instruction_quality_rules_v1.json" with { type: "json" };

const LEVELS = ["A1", "A2", "B1", "B2"];
const COMPETENCES = ["CE", "CO", "EE", "EO", "Structures"];

export class DifferentiationLevelError extends Error {
  constructor(value) {
    super(`Niveau de différenciation invalide: ${JSON.stringify(value)}. Attendu: ${LEVELS.join(", ")}.`);
    this.name = "DifferentiationLevelError";
  }
}

export function normalizeDifferentiationLevel(niveau) {
  const normalized = String(niveau ?? "A2").trim().toUpperCase();
  if (normalized.startsWith("B2")) return "B2";
  if (normalized.startsWith("B1")) return "B1";
  if (normalized.startsWith("A2")) return "A2";
  return "A1";
}

// normalizeDifferentiationLevel() coerce silencieusement toute entrée
// inconnue (ex. "ZZ") vers "A1" — comportement historique conservé
// ci-dessus pour les consommateurs existants qui en dépendent.
//
// parseDifferentiationLevelStrict() est une API additive séparée, miroir
// exact de son équivalent Deno (referential-loader.ts) : elle rejette toute
// valeur qui n'est pas exactement A1, A2, B1 ou B2 (après trim/uppercase)
// au lieu de deviner.
export function parseDifferentiationLevelStrict(value) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (LEVELS.includes(normalized)) {
    return normalized;
  }
  throw new DifferentiationLevelError(value);
}

export function getDifferentiationTransformationRule(sourceLevel, targetLevel) {
  const source = normalizeDifferentiationLevel(sourceLevel);
  const target = normalizeDifferentiationLevel(targetLevel);
  if (source === target) {
    return {
      id: "IDENTITY",
      rule: { operation: "conserver", allowed: [], forbidden: ["add_fact", "change_competence"] },
    };
  }
  const id = `${source}_TO_${target}`;
  const rule = differentiationTransformationRulesData.transformations[id];
  return rule ? { id, rule } : null;
}

export function getLevelContract(competence, level) {
  if (!COMPETENCES.includes(competence)) return null;
  const normalizedLevel = normalizeDifferentiationLevel(level);
  const competenceContracts = differentiationLevelContractsData.contracts[competence];
  if (!competenceContracts) return null;
  return competenceContracts[normalizedLevel] ?? null;
}

export function getDifferentiationTransformationRules() {
  return differentiationTransformationRulesData;
}

export function getDifferentiationLevelContracts() {
  return differentiationLevelContractsData;
}

export const DIFFERENTIATION_LEVELS = LEVELS;
export const DIFFERENTIATION_COMPETENCES = COMPETENCES;

export function getInstructionQualityRules() {
  return instructionQualityRulesData;
}
