import pedagogicalRulesData from "./referential/pedagogical_rules.json" with { type: "json" };
import errorRemediationData from "./referential/error_remediation_map.json" with { type: "json" };
import demarcheWeightsData from "./referential/demarche_weights.json" with { type: "json" };
import thresholdRulesData from "./referential/threshold_rules.json" with { type: "json" };
import formatAliasData from "./referential/format_alias_map.json" with { type: "json" };
import structuresPillarsData from "./referential/structures_pillars.json" with { type: "json" };
import structuresCurriculumData from "./referential/structures_curriculum.json" with { type: "json" };
import structuresMeasurementData from "./referential/structures_measurement_rules.json" with { type: "json" };
import structuresSwitchData from "./referential/structures_switch_rules.json" with { type: "json" };
import structuresErrorMapData from "./referential/structures_error_map.json" with { type: "json" };
import structuresSessionMixData from "./referential/structures_session_mix.json" with { type: "json" };

export type NiveauBand = "A0_A1" | "A2_B1" | "B2";
export type PilierId = "conjugaison" | "grammaire" | "phonetique" | "vocabulaire";
export type TypeDemarche = "titre_sejour" | "naturalisation";
export type ProgressionMode = "demarrage" | "remediation" | "consolide" | "augmente";

export interface PedagogicalRule {
  id: string;
  niveau_cecrl: string;
  competence: string;
  mode: ProgressionMode | string;
  type_demarche?: string;
  formats_recommandes?: string[];
  formats_interdits?: string[];
  regle_descente?: string;
  [key: string]: unknown;
}

export interface ErrorRemediationEntry {
  type_erreur_id: string;
  priorite_par_niveau?: Partial<Record<NiveauBand, number>>;
  formats_recommandes?: string[];
  formats_interdits?: string[];
  strategie?: string;
  [key: string]: unknown;
}

export interface StructuresSwitchRule {
  id: string;
  declencheur: string;
  type_erreur_id: string;
  seuil_pct: number;
  fenetre_resultats?: number;
  action: string;
  pilier_cible: string;
  volume_seance_pct?: number;
  competence_suspendue?: string;
  [key: string]: unknown;
}

export interface SwitchRuleContext {
  errorRates?: Record<string, number>;
  errorCounts?: Record<string, number>;
  competenceScores?: Record<string, number>;
  niveauCecrl?: string | null;
  totalErrors?: number;
}

export interface FormatAliasResolution {
  formatId: string;
  generateur: string;
  options: string[];
}

const pedagogicalRules = (pedagogicalRulesData as { rules: PedagogicalRule[] }).rules ?? [];
const errorRemediationEntries =
  (errorRemediationData as { entries: ErrorRemediationEntry[] }).entries ?? [];
const demarcheWeights = demarcheWeightsData as Record<string, unknown>;
const thresholdRules = thresholdRulesData as Record<string, unknown>;
const formatAliasMap = formatAliasData as Record<string, { generateur?: string; options?: string[] } | string>;
const structuresPillars = (structuresPillarsData as { pillars: Record<string, unknown>[] }).pillars ?? [];
const structuresCurriculum =
  (structuresCurriculumData as { entries: Record<string, unknown>[] }).entries ?? [];
const structuresMeasurementRules =
  (structuresMeasurementData as { rules: Record<string, unknown>[] }).rules ?? [];
const structuresSwitchRules =
  (structuresSwitchData as { rules: StructuresSwitchRule[] }).rules ?? [];
const structuresErrorEntries =
  (structuresErrorMapData as { entries: Record<string, unknown>[] }).entries ?? [];
const structuresSessionMixes =
  (structuresSessionMixData as { mixes: Record<string, unknown>[] }).mixes ?? [];

export function niveauToBand(niveauCecrl?: string | null): NiveauBand {
  const n = (niveauCecrl ?? "A1").toUpperCase();
  if (n === "B2") return "B2";
  if (n === "A2" || n === "B1") return "A2_B1";
  return "A0_A1";
}

export function getPedagogicalRule(
  niveau: string,
  competence: string,
  mode: string,
  typeDemarche?: TypeDemarche,
): PedagogicalRule | null {
  const niveauNorm = niveau.toUpperCase();
  const compNorm = competence.trim();
  const modeNorm = mode.toLowerCase();

  const matches = pedagogicalRules.filter((rule) => {
    if (rule.niveau_cecrl?.toUpperCase() !== niveauNorm) return false;
    if (rule.competence !== compNorm) return false;
    if (String(rule.mode).toLowerCase() !== modeNorm) return false;
    if (!rule.type_demarche || rule.type_demarche === "both") return true;
    if (!typeDemarche) return true;
    return rule.type_demarche === typeDemarche;
  });

  if (matches.length === 0) return null;
  if (typeDemarche) {
    const demarcheMatch = matches.find((r) => r.type_demarche === typeDemarche);
    if (demarcheMatch) return demarcheMatch;
  }
  return matches[0];
}

export function getErrorRemediation(
  typeErreurId: string,
  niveauBand: NiveauBand,
): ErrorRemediationEntry | null {
  const entry = errorRemediationEntries.find((e) => e.type_erreur_id === typeErreurId);
  if (!entry) return null;
  return {
    ...entry,
    priorite: entry.priorite_par_niveau?.[niveauBand] ?? entry.priorite,
  };
}

export function getDemarcheWeights(typeDemarche: TypeDemarche): Record<string, number | string> {
  const weights = demarcheWeights[typeDemarche];
  if (!weights || typeof weights !== "object") {
    return { CO: 0.35, CE: 0.35, EE: 0.15, EO: 0.15, niveau_cible: "B1" };
  }
  return weights as Record<string, number | string>;
}

export function getThresholdRules(): Record<string, unknown> {
  const { version: _v, ...rules } = thresholdRules;
  return rules;
}

export function resolveFormatAlias(formatId: string): FormatAliasResolution | null {
  const entry = formatAliasMap[formatId];
  if (!entry || typeof entry === "string") return null;
  if (!entry.generateur) return null;
  return {
    formatId,
    generateur: entry.generateur,
    options: entry.options ?? [],
  };
}

export function resolveFormatsToGenerateurs(formatIds: string[]): string[] {
  const resolved = formatIds.map((id) => resolveFormatAlias(id)?.generateur ?? id);
  return Array.from(new Set(resolved.filter(Boolean)));
}

export function getStructuresPillar(pilierId: PilierId): Record<string, unknown> | null {
  return structuresPillars.find((p) => p.id === pilierId) ?? null;
}

export function getStructuresCurriculum(
  niveau: string,
  pilier: PilierId,
): Record<string, unknown>[] {
  return structuresCurriculum.filter(
    (entry) =>
      String(entry.niveau_cecrl).toUpperCase() === niveau.toUpperCase() &&
      entry.pilier === pilier,
  );
}

export function getStructuresMeasurementRule(pilier: PilierId): Record<string, unknown> | null {
  return structuresMeasurementRules.find((rule) => rule.pilier === pilier) ?? null;
}

export function getStructuresSwitchRules(): StructuresSwitchRule[] {
  return structuresSwitchRules;
}

function normalizeNiveau(niveau?: string | null): string {
  return (niveau ?? "A1").toUpperCase();
}

function errorRateFromContext(
  typeErreurId: string,
  context: SwitchRuleContext,
): number {
  if (context.errorRates?.[typeErreurId] != null) {
    return context.errorRates[typeErreurId];
  }
  const count = context.errorCounts?.[typeErreurId] ?? 0;
  const total = context.totalErrors
    ?? Object.values(context.errorCounts ?? {}).reduce((sum, n) => sum + n, 0);
  if (total <= 0) return 0;
  return (count / total) * 100;
}

export function matchSwitchRule(context: SwitchRuleContext): StructuresSwitchRule | null {
  const niveau = normalizeNiveau(context.niveauCecrl);

  for (const rule of structuresSwitchRules) {
    if (rule.declencheur === "level_init") {
      if (niveau === "A0" && rule.id === "SW-NSA-A0-INIT") return rule;
      continue;
    }

    if (rule.declencheur === "level_check") {
      if (niveau === "A1" && rule.type_erreur_id === "GRAM_TEMPS") {
        const rate = errorRateFromContext("GRAM_TEMPS", context);
        if (rate >= rule.seuil_pct) return rule;
      }
      continue;
    }

    if (rule.declencheur === "global_score_drop") {
      const ee = context.competenceScores?.EE;
      const eo = context.competenceScores?.EO;
      if (ee != null && eo != null && ee < rule.seuil_pct && eo < rule.seuil_pct) {
        return rule;
      }
      continue;
    }

    if (rule.declencheur === "score_drop") {
      const co = context.competenceScores?.CO;
      const rate = errorRateFromContext(rule.type_erreur_id, context);
      if (co != null && co < 50 && rate >= rule.seuil_pct) return rule;
      continue;
    }

    if (rule.declencheur === "error_rate") {
      if (rule.type_erreur_id === "ANY") continue;
      const rate = errorRateFromContext(rule.type_erreur_id, context);
      if (rate >= rule.seuil_pct) return rule;
    }
  }

  return null;
}

export function getStructuresSessionMix(
  niveau: string,
  mode: string,
): Record<string, unknown> | null {
  const niveauNorm = niveau.toUpperCase();
  const modeNorm = mode.toLowerCase();
  return (
    structuresSessionMixes.find(
      (mix) =>
        String(mix.niveau_cecrl).toUpperCase() === niveauNorm &&
        String(mix.mode).toLowerCase() === modeNorm,
    ) ??
    structuresSessionMixes.find((mix) => String(mix.niveau_cecrl).toUpperCase() === niveauNorm) ??
    null
  );
}

export function getStructuresErrorMapping(typeErreurId: string): Record<string, unknown> | null {
  return structuresErrorEntries.find((entry) => entry.type_erreur_id === typeErreurId) ?? null;
}

export function getDominantPilierFromErrors(
  errorCounts: Record<string, number>,
  niveauBand: NiveauBand,
): PilierId | null {
  const totals = Object.values(errorCounts).reduce((sum, n) => sum + n, 0);
  if (totals <= 0) return null;

  const scores: Partial<Record<PilierId, number>> = {};

  for (const [typeErreurId, count] of Object.entries(errorCounts)) {
    const mapping = getStructuresErrorMapping(typeErreurId);
    if (!mapping) continue;
    const pilier = mapping.pilier_principal as PilierId | undefined;
    if (!pilier) continue;
    const priorite = (mapping.priorite_par_niveau as Record<string, number> | undefined)?.[niveauBand] ?? 3;
    const weight = count * (4 - priorite);
    scores[pilier] = (scores[pilier] ?? 0) + weight;
  }

  const ranked = Object.entries(scores).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
  return (ranked[0]?.[0] as PilierId | undefined) ?? null;
}

export function getDominantErrorType(
  errorCounts: Record<string, number>,
  niveauBand: NiveauBand,
): string | null {
  const total = Object.values(errorCounts).reduce((sum, n) => sum + n, 0);
  if (total <= 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const [typeErreurId, count] of Object.entries(errorCounts)) {
    const entry = getErrorRemediation(typeErreurId, niveauBand);
    const priorite = entry?.priorite_par_niveau?.[niveauBand] ?? 3;
    const score = count * (4 - priorite);
    if (!best || score > best.score) best = { id: typeErreurId, score };
  }
  return best?.id ?? null;
}

export function getMergedRemediationFormats(
  typeErreurId: string,
  niveauBand: NiveauBand,
): { formats: string[]; interdits: string[]; strategie?: string } {
  const general = getErrorRemediation(typeErreurId, niveauBand);
  const structures = getStructuresErrorMapping(typeErreurId);
  const rawFormats = [
    ...(general?.formats_recommandes ?? []),
    ...((structures?.formats_recommandes as string[] | undefined) ?? []),
  ];
  const rawInterdits = [
    ...(general?.formats_interdits ?? []),
  ];
  return {
    formats: resolveFormatsToGenerateurs(rawFormats),
    interdits: resolveFormatsToGenerateurs(rawInterdits),
    strategie: general?.strategie as string | undefined,
  };
}

export function formatDemarcheWeightGuidance(typeDemarche: TypeDemarche): string {
  const weights = getDemarcheWeights(typeDemarche);
  const parts = ["CO", "CE", "EE", "EO"].map((comp) => {
    const w = weights[comp];
    return typeof w === "number" ? `${comp} ${Math.round(w * 100)}%` : null;
  }).filter(Boolean);
  const niveau = weights.niveau_cible ?? (typeDemarche === "naturalisation" ? "B2" : "B1");
  return `Ponderation hebdomadaire ${typeDemarche} (cible ${niveau}): ${parts.join(", ")}.`;
}
