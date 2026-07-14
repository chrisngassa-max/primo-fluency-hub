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

const LEVELS = ["A1", "A2", "B1", "B2"];
const COMPETENCES = ["CE", "CO", "EE", "EO", "Structures"];

export function normalizeDifferentiationLevel(niveau) {
  const normalized = String(niveau ?? "A2").trim().toUpperCase();
  if (normalized.startsWith("B2")) return "B2";
  if (normalized.startsWith("B1")) return "B1";
  if (normalized.startsWith("A2")) return "A2";
  return "A1";
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
