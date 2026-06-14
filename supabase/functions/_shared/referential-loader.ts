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
import sessionBlockRulesData from "./referential/session_block_rules.json" with { type: "json" };
import themeSessionTemplatesData from "./referential/theme_session_templates.json" with { type: "json" };
import clusterVariantRulesData from "./referential/cluster_variant_rules.json" with { type: "json" };
import exerciseScoringRulesData from "./referential/exercise_scoring_rules.json" with { type: "json" };

export type NiveauBand = "A0_A1" | "A2_B1" | "B2";
export type PilierId = "conjugaison" | "grammaire" | "phonetique" | "vocabulaire";
export type TypeDemarche = "titre_sejour" | "naturalisation";
export type ProgressionMode = "demarrage" | "remediation" | "consolide" | "augmente";
export type ClusterVariantId = "bas" | "standard" | "haut";
export type EtayageLevel = "fort" | "moyen" | "faible";

export interface PedagogicalRule {
  id: string;
  niveau_cecrl: string;
  competence: string;
  mode: ProgressionMode | string;
  type_demarche?: string;
  formats_recommandes?: string[];
  formats_interdits?: string[];
  regle_descente?: string;
  tache_type?: string;
  etayage_default?: EtayageLevel;
  [key: string]: unknown;
}

export interface ThemeSessionTemplate {
  theme_id: string;
  label: string;
  domaine_irn: string;
  situation_type: string;
  support_commun: string;
  personnages?: string[];
  lieux?: string[];
  donnees_chiffrees_cles?: string[];
  lexique_noyau: string[];
  competences_prioritaires?: Record<string, string[]>;
  objectif_pedagogique_global?: string;
  duree_minutes: number;
  phases: ThemePhase[];
}

export interface ThemePhase {
  id: string;
  duree_min: number;
  commun: boolean;
  competences: string[];
  pilier?: PilierId;
  tache_type?: string;
}

export interface ClusterVariantRule {
  id: ClusterVariantId;
  niveau_cecrl: string[];
  niveau_variante: ClusterVariantId;
  focus: string;
  etayage_default: EtayageLevel;
  description?: string;
}

export interface ScoringRule {
  id: string;
  condition: string;
  points?: number;
  reason: string;
}

export interface HardFilter {
  id: string;
  condition: string;
  reason: string;
}

export interface ExerciseScoringContext {
  exercise: Record<string, unknown>;
  session: Record<string, unknown>;
  student: Record<string, unknown>;
  matrix?: { formats_autorises?: string[] };
}

export interface ExerciseScoreResult {
  score: number;
  excluded: boolean;
  exclusionReason?: string;
  matchedRules: string[];
  appliedFilters: string[];
}

export interface StructuresCompetenceMapping {
  competence: "Structures" | string;
  pilier?: PilierId;
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
  declencheur?: string;
  type_erreur_id?: string;
  seuil_pct?: number;
  fenetre_resultats?: number;
  action: string;
  pilier_cible?: string;
  volume_seance_pct?: number;
  competence_suspendue?: string;
  rule_type?: string;
  condition?: string;
  scope?: string;
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
const sessionBlockRules = sessionBlockRulesData as Record<string, unknown>;
const themeSessionTemplates =
  (themeSessionTemplatesData as { themes: ThemeSessionTemplate[] }).themes ?? [];
const clusterVariantRules =
  (clusterVariantRulesData as {
    max_clusters_per_session: number;
    clusters: ClusterVariantRule[];
    invariants_obligatoires: string[];
    elements_adaptables: string[];
  });
const exerciseScoringRules =
  (exerciseScoringRulesData as { scoring_rules: ScoringRule[]; hard_filters: HardFilter[] });

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
    if (rule.rule_type === "intra_session") continue;

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

const CECRL_ORDER = ["A0", "A1", "A2", "B1", "B2"];

function cecrlIndex(niveau: string): number {
  const idx = CECRL_ORDER.indexOf(niveau.toUpperCase());
  return idx >= 0 ? idx : 1;
}

export function mapStructuresCompetence(competence: string): StructuresCompetenceMapping {
  const raw = competence.trim();
  if (raw === "Structures") return { competence: "Structures" };
  const match = raw.match(/^Structures[_\s-]?(Vocabulaire|Phonetique|Grammaire|Conjugaison)$/i);
  if (match) {
    const pilier = match[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") as PilierId;
    return { competence: "Structures", pilier };
  }
  return { competence: raw };
}

export function resolveFormatForGenerator(formatId: string): string {
  return resolveFormatAlias(formatId)?.generateur ?? formatId;
}

export function getThemeTemplate(themeId: string): ThemeSessionTemplate | null {
  const normalized = themeId.replace(/^THEME_/, "").toUpperCase();
  return themeSessionTemplates.find((theme) => {
    const id = theme.theme_id.toUpperCase();
    return id === normalized || id === themeId.toUpperCase() || `THEME_${id}` === themeId.toUpperCase();
  }) ?? null;
}

export function inferThemeFromText(text: string): ThemeSessionTemplate | null {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mappings: { keywords: string[]; themeId: string }[] = [
    { keywords: ["caf", "allocataire", "guichet", "prefecture", "admin"], themeId: "ADMIN_CAF_01" },
    { keywords: ["medecin", "sante", "ordonnance", "symptome", "pharmacie"], themeId: "SANTE_MED_01" },
    { keywords: ["logement", "fuite", "plombier", "loyer", "proprietaire", "degat"], themeId: "LOG_FUITE_01" },
  ];
  for (const mapping of mappings) {
    if (mapping.keywords.some((kw) => lower.includes(kw))) {
      return getThemeTemplate(mapping.themeId);
    }
  }
  return null;
}

export function getClusterVariantRules(): typeof clusterVariantRules {
  return clusterVariantRules;
}

export function assignClusterVariant(
  niveauCecrl: string,
  niveauVariante: ClusterVariantId,
): ClusterVariantRule | null {
  const niveau = niveauCecrl.toUpperCase();
  const direct = clusterVariantRules.clusters.find((c) => c.niveau_variante === niveauVariante);
  if (direct && direct.niveau_cecrl.some((n) => n.toUpperCase() === niveau)) return direct;
  return clusterVariantRules.clusters.find((c) => c.niveau_variante === niveauVariante) ?? null;
}

export function getExerciseScoringRules(): { scoring_rules: ScoringRule[]; hard_filters: HardFilter[] } {
  return exerciseScoringRules;
}

export function getSessionBlockRules(): Record<string, unknown> {
  const { version: _v, ...rules } = sessionBlockRules;
  return rules;
}

export function getSessionMinimumsForDuration(dureeMinutes: number): Record<string, number> | null {
  const minimums = sessionBlockRules.minimums_seance as Record<string, Record<string, number>> | undefined;
  if (!minimums) return null;
  if (dureeMinutes >= 90) return minimums["90_min"] ?? null;
  if (dureeMinutes >= 60) return minimums["60_min"] ?? null;
  return minimums["45_min"] ?? null;
}

function evaluateScoringCondition(condition: string, ctx: ExerciseScoringContext): boolean {
  const ex = ctx.exercise;
  const session = ctx.session;
  const student = ctx.student;
  const matrix = ctx.matrix ?? {};

  if (condition === "exercise.theme_id == session.theme_id") {
    return ex.theme_id === session.theme_id;
  }
  if (condition === "exercise.domaine_irn == session.domaine_irn") {
    return ex.domaine_irn === session.domaine_irn;
  }
  if (condition === "exercise.niveau_cecrl == student.niveau_cecrl") {
    return String(ex.niveau_cecrl).toUpperCase() === String(student.niveau_cecrl).toUpperCase();
  }
  if (condition === "exercise.niveau_cecrl == (student.niveau_cecrl - 1)") {
    const studentIdx = cecrlIndex(String(student.niveau_cecrl));
    return cecrlIndex(String(ex.niveau_cecrl)) === studentIdx - 1;
  }
  if (condition === "exercise.mode_cible == student.mode") {
    return ex.mode_cible === student.mode;
  }
  if (condition === "exercise.erreur_cible_id == student.dominantErrorType") {
    return ex.erreur_cible_id === student.dominantErrorType;
  }
  if (condition === "student.mode == 'remediation' AND exercise.etayage == 'fort'") {
    return student.mode === "remediation" && ex.etayage === "fort";
  }
  if (condition === "student.mode == 'augmente' AND exercise.etayage == 'faible'") {
    return student.mode === "augmente" && ex.etayage === "faible";
  }
  if (condition === "exercise.competence == session.current_phase_competence") {
    return ex.competence === session.current_phase_competence;
  }
  if (condition === "exercise.pilier == student.structures_pilier_faible") {
    return ex.pilier === student.structures_pilier_faible;
  }
  if (condition === "session.type_demarche == 'titre_sejour' AND (exercise.competence == 'CO' OR exercise.competence == 'CE')") {
    return session.type_demarche === "titre_sejour" && (ex.competence === "CO" || ex.competence === "CE");
  }
  if (condition === "session.type_demarche == 'naturalisation' AND exercise.niveau_cecrl == 'B2'") {
    return session.type_demarche === "naturalisation" && ex.niveau_cecrl === "B2";
  }
  if (condition === "student.niveau_variante == 'bas' AND exercise.limite_mots_max <= 40") {
    return student.niveau_variante === "bas" && Number(ex.limite_mots_max) <= 40;
  }
  if (condition === "exercise.format IN matrix.formats_autorises") {
    const formats = matrix.formats_autorises ?? [];
    const resolved = resolveFormatForGenerator(String(ex.format ?? ""));
    return formats.includes(String(ex.format)) || formats.includes(resolved);
  }
  if (condition === "exercise.mots_cles IN session.lexique_noyau") {
    const lexique = (session.lexique_noyau as string[] | undefined) ?? [];
    const mots = ex.mots_cles;
    if (Array.isArray(mots)) return mots.some((m) => lexique.includes(String(m)));
    return lexique.includes(String(mots));
  }

  // Hard filters
  if (condition === "exercise.theme_id != session.theme_id") {
    return ex.theme_id !== session.theme_id;
  }
  if (condition === "exercise.format NOT IN matrix.formats_autorises") {
    const formats = matrix.formats_autorises ?? [];
    if (formats.length === 0) return false;
    const resolved = resolveFormatForGenerator(String(ex.format ?? ""));
    return !formats.includes(String(ex.format)) && !formats.includes(resolved);
  }
  if (condition === "(exercise.competence == 'EE' OR exercise.competence == 'EO') AND exercise.limite_mots_max > 90") {
    return (ex.competence === "EE" || ex.competence === "EO") && Number(ex.limite_mots_max) > 90;
  }
  if (condition === "student.niveau_cecrl == 'A0' AND exercise.format == 'production_ecrite'") {
    return student.niveau_cecrl === "A0" && ex.format === "production_ecrite";
  }
  if (condition === "student.mode == 'remediation' AND exercise.etayage == 'faible'") {
    return student.mode === "remediation" && ex.etayage === "faible";
  }
  if (condition === "exercise.niveau_cecrl > (student.niveau_cecrl + 1)") {
    return cecrlIndex(String(ex.niveau_cecrl)) > cecrlIndex(String(student.niveau_cecrl)) + 1;
  }
  if (condition === "exercise.niveau_cecrl < (student.niveau_cecrl - 1)") {
    return cecrlIndex(String(ex.niveau_cecrl)) < cecrlIndex(String(student.niveau_cecrl)) - 1;
  }
  if (condition === "student.niveau_cecrl == 'A0' AND exercise.competence == 'CE' AND exercise.tache_type == 'comprehension_implicite'") {
    return student.niveau_cecrl === "A0" && ex.competence === "CE" && ex.tache_type === "comprehension_implicite";
  }
  if (condition === "session.type_demarche == 'titre_sejour' AND exercise.niveau_cecrl == 'B2'") {
    return session.type_demarche === "titre_sejour" && ex.niveau_cecrl === "B2";
  }
  if (condition === "student.error_id == 'CONSIGNE_NC' AND exercise.consigne_max_mots > 10") {
    return student.error_id === "CONSIGNE_NC" && Number(ex.consigne_max_mots) > 10;
  }

  return false;
}

export function scoreExerciseCandidate(context: ExerciseScoringContext): ExerciseScoreResult {
  const matchedRules: string[] = [];
  const appliedFilters: string[] = [];
  let score = 0;

  for (const filter of exerciseScoringRules.hard_filters) {
    if (evaluateScoringCondition(filter.condition, context)) {
      appliedFilters.push(filter.id);
      return {
        score: 0,
        excluded: true,
        exclusionReason: filter.reason,
        matchedRules,
        appliedFilters,
      };
    }
  }

  for (const rule of exerciseScoringRules.scoring_rules) {
    if (evaluateScoringCondition(rule.condition, context)) {
      matchedRules.push(rule.id);
      score += rule.points ?? 0;
    }
  }

  return { score: Math.min(score, 100), excluded: false, matchedRules, appliedFilters };
}

export function deriveFormatsForCluster(
  niveauCecrl: string,
  niveauVariante: ClusterVariantId,
  competence: string,
  mode: string,
  typeDemarche?: TypeDemarche,
): { formats: string[]; interdits: string[]; rule: PedagogicalRule | null } {
  const mapped = mapStructuresCompetence(competence);
  const compNorm = mapped.competence;
  const rule = getPedagogicalRule(niveauCecrl, compNorm, mode, typeDemarche);
  const cluster = assignClusterVariant(niveauCecrl, niveauVariante);
  const rawFormats = rule?.formats_recommandes ?? ["qcm", "vrai_faux"];
  const formats = resolveFormatsToGenerateurs(rawFormats);
  const interdits = resolveFormatsToGenerateurs(rule?.formats_interdits ?? []);
  if (cluster?.etayage_default === "fort") {
    interdits.push("production_ecrite", "production_ecrite_libre");
  }
  return { formats, interdits: Array.from(new Set(interdits)), rule };
}

export function formatReferentialPromptBlock(options: {
  theme?: ThemeSessionTemplate | null;
  dureeMinutes?: number;
  clusterVariants?: ClusterVariantId[];
  typeDemarche?: TypeDemarche;
}): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════",
    "REFERENTIEL PEDAGOGIQUE — THEME ET DIFFERENCIATION",
    "═══════════════════════════════════════════════════",
  ];

  const { theme, dureeMinutes = 60, clusterVariants, typeDemarche } = options;

  if (theme) {
    lines.push(
      `THEME DE SEANCE: ${theme.label} (${theme.theme_id})`,
      `Domaine IRN: ${theme.domaine_irn} | Situation: ${theme.situation_type}`,
      `Support commun: ${theme.support_commun}`,
      `Lexique noyau OBLIGATOIRE: ${theme.lexique_noyau.join(", ")}`,
      `Personnages fixes: ${(theme.personnages ?? []).join(", ") || "selon support"}`,
      `Lieux fixes: ${(theme.lieux ?? []).join(", ") || "selon support"}`,
      `Donnees chiffrees cles: ${(theme.donnees_chiffrees_cles ?? []).join(", ") || "selon support"}`,
      `Objectif global: ${theme.objectif_pedagogique_global ?? "—"}`,
      "",
      "PHASES DE SEANCE (60 min):",
    );
    for (const phase of theme.phases) {
      const pilierNote = phase.pilier ? ` (pilier ${phase.pilier})` : "";
      lines.push(
        `- ${phase.id} (${phase.duree_min} min, ${phase.commun ? "COMMUN" : "DIFFERENCIE"}): ${phase.competences.join("/")}${pilierNote}`,
      );
    }
    if (typeDemarche && theme.competences_prioritaires?.[typeDemarche]) {
      lines.push(`Competences prioritaires (${typeDemarche}): ${theme.competences_prioritaires[typeDemarche].join(", ")}`);
    }
  }

  const invariants = clusterVariantRules.invariants_obligatoires;
  lines.push(
    "",
    "INVARIANTS OBLIGATOIRES (identiques sur TOUS les clusters):",
    invariants.map((i) => `- ${i}`).join("\n"),
    "",
    "ELEMENTS ADAPTABLES par cluster:",
    clusterVariantRules.elements_adaptables.map((e) => `- ${e}`).join("\n"),
  );

  if (clusterVariants?.length) {
    lines.push("", "CLUSTERS ACTIFS (max 3):");
    for (const variant of clusterVariants) {
      const cluster = clusterVariantRules.clusters.find((c) => c.niveau_variante === variant);
      if (cluster) {
        lines.push(`- ${cluster.id}: focus ${cluster.focus}, etayage ${cluster.etayage_default}, niveaux ${cluster.niveau_cecrl.join("/")}`);
      }
    }
  }

  const minimums = getSessionMinimumsForDuration(dureeMinutes);
  if (minimums) {
    const minText = Object.entries(minimums)
      .map(([comp, count]) => `${comp} >= ${count}`)
      .join(", ");
    lines.push("", `MINIMUMS COMPETENCES (${dureeMinutes} min): ${minText}`);
    lines.push("Verifier la couverture des competences cibles avant de finaliser.");
  }

  lines.push(
    "",
    "REGLE TCF IRN: productions EE/EO limitees a 90 mots maximum.",
    "Ne jamais changer situation_type, personnages, lieux ou chiffres cles entre variantes.",
  );

  return lines.join("\n");
}

export function getIntraSessionRules(): StructuresSwitchRule[] {
  return structuresSwitchRules.filter((rule) => rule.rule_type === "intra_session");
}
