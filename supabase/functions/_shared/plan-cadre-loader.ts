import planCadreEnrichiData from "./referential/plan_cadre_v1_enrichi_s8_s20.json" with { type: "json" };
import planCadreOptionnelData from "./referential/plan_cadre_v1_module_optionnel.json" with { type: "json" };
import formatAliasData from "./referential/format_alias_map.json" with { type: "json" };

export type TypeDemarche = "titre_sejour" | "naturalisation";

const formatAliasMap = formatAliasData as Record<
  string,
  { generateur?: string; options?: string[] } | string
>;

function resolveFormatForGenerator(formatId: string): string {
  const entry = formatAliasMap[formatId];
  if (!entry || typeof entry === "string") return formatId;
  return entry.generateur ?? formatId;
}

const DOMAIN_FORMATS = new Set([
  "comprehension_orale",
  "comprehension_ecrite",
  "expression_ecrite",
  "expression_orale",
]);

const DOMAIN_FORMAT_DEFAULTS: Record<string, string> = {
  comprehension_orale: "qcm",
  comprehension_ecrite: "qcm",
  expression_ecrite: "production_ecrite",
  expression_orale: "production_orale",
};

export interface PlanCadreStudentProfileSchema {
  source?: string;
  niveaux_par_competence?: Record<string, string>;
  niveaux_structures_par_pilier?: Record<string, string>;
  cluster_mapping?: Record<string, string>;
}

export interface PlanCadreStudentProfile {
  type_demarche?: TypeDemarche | string;
  mention?: string;
  premiere_demande_CSP?: boolean;
  premiere_demande_CR_eligible?: boolean;
  re_signature_civique?: boolean;
  examen_civique_obligatoire?: boolean;
  [key: string]: unknown;
}

export interface CiviqueVisibleRouting {
  default?: boolean;
  conditions_true?: string[];
  note?: string;
}

export interface PlanCadreSession {
  numero: number;
  module_id?: string;
  type?: string;
  theme_id: string;
  theme_id_alias?: string[];
  domaine_irn?: string;
  duree_min?: number;
  civique_visible?: boolean | CiviqueVisibleRouting;
  phases?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PlanCadreFile {
  version?: string;
  parcours_id?: string;
  student_profile_schema?: PlanCadreStudentProfileSchema;
  activation?: {
    enabled_by_default?: boolean;
    conditions_all?: string[];
  };
  seances: PlanCadreSession[];
}

const enrichedPlan = planCadreEnrichiData as PlanCadreFile;
const optionalPlan = planCadreOptionnelData as PlanCadreFile;

const enrichedSessionsByNumero = new Map<number, PlanCadreSession>(
  enrichedPlan.seances.map((session) => [session.numero, normalizePlanCadreSession(session)]),
);

const optionalSessions = optionalPlan.seances.map(normalizePlanCadreSession);

function evaluateProfileCondition(condition: string, profile: PlanCadreStudentProfile): boolean {
  const trimmed = condition.trim();
  const stringEq = trimmed.match(/^(\w+)\s*==\s*'([^']*)'$/);
  if (stringEq) {
    const field = stringEq[1];
    const value = stringEq[2];
    return String(profile[field] ?? "") === value;
  }
  const boolEq = trimmed.match(/^(\w+)\s*==\s*(true|false)$/);
  if (boolEq) {
    const field = boolEq[1];
    const value = boolEq[2] === "true";
    return profile[field] === value;
  }
  return false;
}

export function normalizePlanCadreFormat(
  format: string,
  formatPedagogiqueAlias?: string,
): string {
  if (formatPedagogiqueAlias) {
    return resolveFormatForGenerator(formatPedagogiqueAlias);
  }
  if (DOMAIN_FORMATS.has(format)) {
    return resolveFormatForGenerator(DOMAIN_FORMAT_DEFAULTS[format] ?? format);
  }
  return resolveFormatForGenerator(format);
}

function normalizeFormatFields(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(normalizeFormatFields);
    return;
  }
  if (!node || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  if (typeof obj.format === "string") {
    const alias = typeof obj.format_pedagogique_alias === "string"
      ? obj.format_pedagogique_alias
      : undefined;
    obj.format_domain = obj.format;
    obj.format = normalizePlanCadreFormat(obj.format, alias);
  }

  for (const value of Object.values(obj)) {
    normalizeFormatFields(value);
  }
}

function normalizePlanCadreSession(session: PlanCadreSession): PlanCadreSession {
  const copy = structuredClone(session) as PlanCadreSession;
  normalizeFormatFields(copy);
  return copy;
}

export function getEnrichedSession(numero: number): PlanCadreSession | null {
  if (numero < 8 || numero > 20) return null;
  return enrichedSessionsByNumero.get(numero) ?? null;
}

export function getOptionalModuleSessions(): PlanCadreSession[] {
  return optionalSessions;
}

export function isOptionalModuleActive(studentProfile: PlanCadreStudentProfile): boolean {
  const activation = optionalPlan.activation;
  if (activation?.enabled_by_default) return true;
  const conditions = activation?.conditions_all ?? [];
  if (conditions.length === 0) return false;
  return conditions.every((condition) => evaluateProfileCondition(condition, studentProfile));
}

export function isCiviqueVisible(
  session: PlanCadreSession,
  studentProfile: PlanCadreStudentProfile,
): boolean {
  const civiqueVisible = session.civique_visible;
  if (typeof civiqueVisible === "boolean") return civiqueVisible;
  if (!civiqueVisible || typeof civiqueVisible !== "object") return false;

  const conditions = civiqueVisible.conditions_true ?? [];
  if (conditions.some((condition) => evaluateProfileCondition(condition, studentProfile))) {
    return true;
  }
  return civiqueVisible.default ?? false;
}

export function resolvePlanCadreThemeId(session: PlanCadreSession): string {
  return session.theme_id_alias?.[0] ?? session.theme_id;
}

export function getPlanCadreStudentProfileSchema(): PlanCadreStudentProfileSchema | undefined {
  return enrichedPlan.student_profile_schema;
}
