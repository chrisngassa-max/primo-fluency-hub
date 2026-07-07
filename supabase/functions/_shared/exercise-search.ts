// ════════════════════════════════════════════════════════════════════════
// MOTEUR DE RECHERCHE « SEARCH-FIRST »
// ------------------------------------------------------------------------
// Objectif : avant de GÉNÉRER un exercice par IA, CHERCHER d'abord dans la
// banque existante (`exercices`). On note chaque candidat avec le MÊME juge
// unique que le reste de l'app — `scoreExerciseCandidate()` (référentiel
// `exercise_scoring_rules.json`) — on croise avec la FRAÎCHEUR (historique
// `devoirs`/`resultats` de l'élève/du groupe) puis on applique la logique de
// décision validée :
//   score ≥ REUSE_SCORE_MIN  ET  non-vu-récemment  → RÉUTILISER (source banque)
//   sinon (score < REUSE_SCORE_MIN OU vu récemment) → laisser GÉNÉRER l'IA
//
// On ne crée PAS un second système de scoring : on réutilise strictement
// `scoreExerciseCandidate`. Le présent module se contente de MAPPER les
// colonnes réelles de la table `exercices` vers les champs attendus par le
// juge, d'ajouter un filet de validité (contenu exploitable) et la fraîcheur.
// ════════════════════════════════════════════════════════════════════════

import { getExerciseScoringRules, scoreExerciseCandidate } from "./referential-loader.ts";

// ─── Seuils configurables (juge unique 0-100 + fenêtre de fraîcheur) ───
export const REUSE_SCORE_MIN = 80; // score ≥ 80 → réutilisable depuis la banque
export const GENERATE_SCORE_MIN = 60; // score 60-79 → on préfère générer (puis scorer)
export const FRESHNESS_WINDOW_DAYS = 30; // fenêtre « vu récemment » (en jours)
export const FRESHNESS_MAX_OCCURRENCES = 1; // ≥ N occurrences récentes → considéré « vu récemment »
export const DEFAULT_CANDIDATE_LIMIT = 200; // garde-fou sur le volume requêté
export const CURRICULUM_SOURCE_BOOST = 15; // bonus search-first si exercice curriculum de la séance

const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2"];

const PRODUCTION_FORMATS = new Set(["production_ecrite", "production_orale"]);

// Formats pédagogiquement cohérents par compétence — sert de `matrix.formats_autorises`
// au juge (règle SCORE_14 / filtre EXCL_02). Volontairement permissif mais
// élimine les incohérences flagrantes (ex: production_ecrite tagué CO).
const FORMATS_BY_COMPETENCE: Record<string, string[]> = {
  CO: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation"],
  CE: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation"],
  EE: ["production_ecrite", "texte_lacunaire", "transformation", "qcm"],
  EO: ["production_orale", "qcm"],
  Structures: ["texte_lacunaire", "qcm", "transformation", "appariement", "vrai_faux"],
};

export function formatsAutorisesForCompetence(competence?: string | null): string[] {
  if (!competence) return [];
  return FORMATS_BY_COMPETENCE[competence] ?? [];
}

function levelIndex(niveau?: string | null): number {
  if (!niveau) return -1;
  return LEVEL_ORDER.indexOf(String(niveau).toUpperCase());
}

/** Fenêtre de niveaux acceptés autour du niveau cible (±1, borné au référentiel). */
export function niveauWindow(niveauVise?: string | null): string[] {
  const idx = levelIndex(niveauVise);
  if (idx < 0) return [...LEVEL_ORDER];
  const out: string[] = [];
  for (let i = Math.max(0, idx - 1); i <= Math.min(LEVEL_ORDER.length - 1, idx + 1); i++) {
    out.push(LEVEL_ORDER[i]);
  }
  return out;
}

/**
 * Filet de validité : un exercice ne peut être RÉUTILISÉ que s'il est
 * réellement jouable. Les formats « objectifs » (production écrite/orale) se
 * contentent d'une consigne ; les autres formats exigent des items.
 */
export function hasUsableContent(row: ExerciseRow): boolean {
  if (!row.consigne || String(row.consigne).trim().length === 0) return false;
  const format = String(row.format ?? "");
  if (PRODUCTION_FORMATS.has(format)) return true;
  const contenu = (row.contenu ?? {}) as Record<string, unknown>;
  const items = contenu.items;
  return Array.isArray(items) && items.length > 0;
}

export interface ExerciseRow {
  id: string;
  titre?: string | null;
  consigne?: string | null;
  competence?: string | null;
  niveau_vise?: string | null;
  format?: string | null;
  difficulte?: number | null;
  contenu?: unknown;
  contexte_irn?: string | null;
  theme?: string | null;
  niveau_guidage?: string | null;
  sous_competence?: string | null;
  metadata_code?: string | null;
  metadata_skill?: string | null;
  mode?: string | null;
  objectif_tcf?: string | null;
  is_ai_generated?: boolean | null;
  source?: string | null;
  [key: string]: unknown;
}

export interface SearchTarget {
  competence: string;
  niveauVise: string;
  typeDemarche?: string;
  /** Optionnel : thème de séance. Voir note théme dans buildScoringContexts. */
  themeId?: string | null;
  /** Optionnel : démarche pédagogique de l'élève cible (remediation/augmente…). */
  studentMode?: string | null;
  /** Optionnel : code séance curriculum (S01…) pour booster les exercices publiés. */
  preferCurriculumSessionCode?: string | null;
  /** Optionnel : uuid training_sessions pour filtrer le pont curriculum. */
  preferCurriculumTrainingSessionId?: string | null;
}

// ─── Thème : vocabulaire canonique de `exercices.theme` (CHECK chk_exercices_theme_v4) ───
// La colonne `theme` (backfillée, ~48% de couverture) utilise STRICTEMENT ces
// valeurs. C'est le vocabulaire commun aux DEUX côtés (candidat + cible).
const CANONICAL_THEMES = new Set([
  "logement",
  "sante",
  "travail",
  "transport",
  "banque",
  "prefecture",
  "ecole",
  "vie_citoyenne",
]);

// Alias explicites tolérés (variantes/préfixes) → valeur canonique. Volontairement
// restreint (correspondance EXACTE après normalisation) : on n'infère JAMAIS un
// thème à partir de texte libre, pour ne pas EXCLURE un candidat à tort (EXCL_01).
const THEME_ALIASES: Record<string, string> = {
  sante: "sante",
  "vie citoyenne": "vie_citoyenne",
  citoyennete: "vie_citoyenne",
  ecole: "ecole",
  education: "ecole",
  préfecture: "prefecture",
};

// Sentinelle de neutralité : utilisée DES DEUX CÔTÉS quand la dimension thème
// ne doit pas s'appliquer (un seul côté renseigné). Identique des deux côtés →
// EXCL_01 (`!=`) ne déclenche pas (pas d'exclusion injuste). Le bonus SCORE_01
// qui en résulte est ensuite RETIRÉ (voir scoreCandidateWithTheme).
const THEME_NEUTRAL = "__theme_neutral__";

// Bonus thème (SCORE_01) lu dynamiquement depuis le référentiel pour rester
// aligné si le barème évolue (pas de valeur magique en dur).
const THEME_BONUS_RULE_ID = "SCORE_01";
const THEME_BONUS_POINTS = getExerciseScoringRules().scoring_rules.find(
  (r) => r.id === THEME_BONUS_RULE_ID,
)?.points ?? 40;

/**
 * Normalise une valeur de thème vers le vocabulaire canonique de `exercices.theme`.
 * Renvoie la valeur canonique si reconnue (8 valeurs + quelques alias exacts),
 * sinon `null` (= « pas de thème exploitable »). Aucune inférence floue : une
 * valeur non reconnue est traitée comme absente (neutralité, jamais d'exclusion).
 */
export function canonicalizeTheme(value?: string | null): string | null {
  if (value == null) return null;
  const norm = String(value).trim().toLowerCase();
  if (norm.length === 0) return null;
  if (CANONICAL_THEMES.has(norm)) return norm;
  // normalisation sans accents pour matcher le set canonique / alias
  const noAccents = norm.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (CANONICAL_THEMES.has(noAccents)) return noAccents;
  return THEME_ALIASES[norm] ?? THEME_ALIASES[noAccents] ?? null;
}

/**
 * Mappe une ligne `exercices` réelle vers l'objet `exercise` attendu par le
 * juge `scoreExerciseCandidate`.
 *
 * THÈME (rebranché) : le thème RÉEL du candidat provient de `row.theme`
 * (colonne backfillée, valeurs canoniques). On ne recopie plus le thème de la
 * cible sur le candidat (ce qui neutralisait la dimension). Le rapprochement /
 * filtre thématique vs la cible est géré par `scoreCandidateWithTheme`, qui
 * n'active EXCL_01/SCORE_01 que lorsque les DEUX côtés ont un thème.
 */
export function mapRowToScoringExercise(
  row: ExerciseRow,
  _target: SearchTarget,
): Record<string, unknown> {
  const etayage = ["fort", "moyen", "faible"].includes(String(row.niveau_guidage ?? ""))
    ? row.niveau_guidage
    : undefined;
  return {
    // thème canonique du CANDIDAT (depuis row.theme), `undefined` si absent/non reconnu
    theme_id: canonicalizeTheme(row.theme) ?? undefined,
    // domaine_irn renseigné seulement si présent en base (sinon non noté)
    domaine_irn: row.contexte_irn ?? undefined,
    niveau_cecrl: row.niveau_vise ?? undefined,
    competence: row.competence ?? undefined,
    format: row.format ?? undefined,
    etayage,
  };
}

export interface ScoringContexts {
  session: Record<string, unknown>;
  student: Record<string, unknown>;
  matrix: { formats_autorises?: string[] };
}

export function buildScoringContexts(target: SearchTarget): ScoringContexts {
  return {
    session: {
      // thème canonique de la CIBLE (séance/compétence), `undefined` si absent/non reconnu.
      // L'activation effective du thème est décidée par scoreCandidateWithTheme.
      theme_id: canonicalizeTheme(target.themeId) ?? undefined,
      // sentinelle : empêche un bonus domaine uniforme quand le domaine n'est pas ciblé
      domaine_irn: "__no_domaine_target__",
      current_phase_competence: target.competence,
      type_demarche: target.typeDemarche ?? "titre_sejour",
    },
    student: {
      niveau_cecrl: target.niveauVise,
      mode: target.studentMode ?? undefined,
    },
    matrix: { formats_autorises: formatsAutorisesForCompetence(target.competence) },
  };
}

/**
 * Score un candidat en gérant la dimension THÈME selon la règle :
 * « contrainte/bonus thème actifs UNIQUEMENT quand le candidat ET la cible ont
 * un thème renseigné ». On ne FORK PAS le juge : on ajuste seulement ce qu'on
 * lui passe (et on retire le bonus parasite dans le cas neutralisé).
 *
 * Rappel : EXCL_01 (`exercise.theme_id != session.theme_id`) et SCORE_01
 * (`exercise.theme_id == session.theme_id`) sont des conditions exactement
 * OPPOSÉES. Pour une même paire de valeurs, l'une OU l'autre se déclenche
 * toujours — il est donc impossible d'obtenir « ni exclusion ni bonus » en une
 * seule passe. On procède donc ainsi :
 *   • candidat ET cible thémés     → valeurs réelles (bonus si égal, sinon exclu)
 *   • un seul côté thémé           → sentinelle des 2 côtés (pas d'exclusion) PUIS
 *                                     retrait du bonus SCORE_01 (« perd le bonus »)
 *   • aucun côté thémé             → thème non ciblé : on laisse le comportement
 *                                     uniforme historique (les deux `undefined`),
 *                                     neutre pour le classement et la calibration
 *                                     du seuil (bonus identique pour tous).
 */
export function scoreCandidateWithTheme(
  exercise: Record<string, unknown>,
  ctx: ScoringContexts,
  targetThemeId: string | null,
): { score: number; excluded: boolean; exclusionReason?: string; matchedRules: string[] } {
  const candidateTheme = canonicalizeTheme(exercise.theme_id as string | null | undefined);
  const bothThemed = candidateTheme !== null && targetThemeId !== null;
  const oneThemed = (candidateTheme !== null) !== (targetThemeId !== null);

  let exerciseThemeId: string | undefined;
  let sessionThemeId: string | undefined;
  if (bothThemed) {
    // Comparaison réelle : EXCL_01 exclut si différent, SCORE_01 bonifie si égal.
    exerciseThemeId = candidateTheme;
    sessionThemeId = targetThemeId;
  } else if (oneThemed) {
    // Neutralisation : mêmes valeurs → pas d'exclusion ; bonus retiré ensuite.
    exerciseThemeId = THEME_NEUTRAL;
    sessionThemeId = THEME_NEUTRAL;
  } else {
    // Aucun thème ciblé : comportement uniforme historique (deux `undefined`).
    exerciseThemeId = undefined;
    sessionThemeId = undefined;
  }

  const result = scoreExerciseCandidate({
    exercise: { ...exercise, theme_id: exerciseThemeId },
    session: { ...ctx.session, theme_id: sessionThemeId },
    student: ctx.student,
    matrix: ctx.matrix,
  });

  if (oneThemed && result.matchedRules.includes(THEME_BONUS_RULE_ID)) {
    return {
      score: Math.max(0, result.score - THEME_BONUS_POINTS),
      excluded: result.excluded,
      exclusionReason: result.exclusionReason,
      matchedRules: result.matchedRules.filter((id) => id !== THEME_BONUS_RULE_ID),
    };
  }

  return {
    score: result.score,
    excluded: result.excluded,
    exclusionReason: result.exclusionReason,
    matchedRules: result.matchedRules,
  };
}

export interface ScoredCandidate {
  id: string;
  titre: string | null;
  competence: string | null;
  format: string | null;
  niveau_vise: string | null;
  difficulte: number | null;
  score: number;
  excluded: boolean;
  exclusionReason?: string;
  matchedRules: string[];
  fresh: boolean;
  recentOccurrences: number;
  source: "banque";
}

export interface ReuseDecisionReport {
  bank_candidates: number;
  content_valid: number;
  scored_passed_filters: number;
  fresh_eligible: number;
  reused: number;
  reuse_score_min: number;
  generate_score_min: number;
  freshness_window_days: number;
}

export interface ReuseResult {
  reusable: ScoredCandidate[];
  candidates: ScoredCandidate[];
  report: ReuseDecisionReport;
}

interface SupabaseLike {
  from: (table: string) => any;
}

export interface FindReusableParams extends SearchTarget {
  count: number;
  /** Élèves concernés — croisement de fraîcheur sur devoirs/resultats. */
  eleveIds?: string[];
  /** Exercices à ne jamais réutiliser (déjà dans la séance, déjà repris…). */
  excludeExerciceIds?: string[];
  reuseScoreMin?: number;
  freshnessWindowDays?: number;
  freshnessMaxOccurrences?: number;
  candidateLimit?: number;
}

function curriculumMatchBoost(row: ExerciseRow, params: FindReusableParams): number {
  if (row.source !== "curriculum_v2") return 0;
  const meta = (row.contenu ?? {}) as { metadata?: Record<string, unknown> };
  const sessionCode = meta.metadata?.session_code;
  const trainingId = meta.metadata?.training_session_id;
  if (params.preferCurriculumSessionCode && sessionCode === params.preferCurriculumSessionCode) {
    return CURRICULUM_SOURCE_BOOST;
  }
  if (
    params.preferCurriculumTrainingSessionId &&
    trainingId === params.preferCurriculumTrainingSessionId
  ) {
    return CURRICULUM_SOURCE_BOOST;
  }
  return 0;
}

/**
 * Cœur du moteur search-first : requête la banque, score via le juge unique,
 * croise la fraîcheur, applique la logique de décision et renvoie jusqu'à
 * `count` exercices RÉUTILISABLES (triés par score puis fraîcheur).
 */
export async function findReusableExercises(
  supabase: SupabaseLike,
  params: FindReusableParams,
): Promise<ReuseResult> {
  const {
    competence,
    niveauVise,
    count,
    eleveIds = [],
    excludeExerciceIds = [],
    reuseScoreMin = REUSE_SCORE_MIN,
    freshnessWindowDays = FRESHNESS_WINDOW_DAYS,
    freshnessMaxOccurrences = FRESHNESS_MAX_OCCURRENCES,
    candidateLimit = DEFAULT_CANDIDATE_LIMIT,
  } = params;

  const emptyReport: ReuseDecisionReport = {
    bank_candidates: 0,
    content_valid: 0,
    scored_passed_filters: 0,
    fresh_eligible: 0,
    reused: 0,
    reuse_score_min: reuseScoreMin,
    generate_score_min: GENERATE_SCORE_MIN,
    freshness_window_days: freshnessWindowDays,
  };

  if (!competence || count <= 0) {
    return { reusable: [], candidates: [], report: emptyReport };
  }

  // ── 1. Requête banque : candidats pertinents (compétence + niveau ±1) ──
  let query = supabase
    .from("exercices")
    .select(
      "id, titre, consigne, competence, niveau_vise, format, difficulte, contenu, contexte_irn, theme, niveau_guidage, sous_competence, metadata_code, metadata_skill, mode, objectif_tcf, animation_guide, variante_niveau_bas, variante_niveau_haut, is_ai_generated, source",
    )
    .eq("competence", competence)
    .eq("is_template", false)
    .is("eleve_id", null)
    .in("niveau_vise", niveauWindow(niveauVise))
    .limit(candidateLimit);

  if (excludeExerciceIds.length > 0) {
    query = query.not("id", "in", `(${excludeExerciceIds.join(",")})`);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[exercise-search] bank query error:", error);
    return { reusable: [], candidates: [], report: emptyReport };
  }

  const bankRows: ExerciseRow[] = Array.isArray(rows) ? rows : [];
  emptyReport.bank_candidates = bankRows.length;
  if (bankRows.length === 0) {
    return { reusable: [], candidates: [], report: emptyReport };
  }

  // ── 2. Filet de validité (contenu jouable) ──
  const validRows = bankRows.filter((r) => hasUsableContent(r));
  emptyReport.content_valid = validRows.length;

  // ── 3. Scoring via le JUGE UNIQUE (hard filters + score 0-100) ──
  const ctx = buildScoringContexts(params);
  const targetThemeId = canonicalizeTheme(params.themeId);
  const scored: ScoredCandidate[] = validRows.map((row) => {
    const result = scoreCandidateWithTheme(
      mapRowToScoringExercise(row, params),
      ctx,
      targetThemeId,
    );
    const boost = curriculumMatchBoost(row, params);
    return {
      id: row.id,
      titre: row.titre ?? null,
      competence: row.competence ?? null,
      format: row.format ?? null,
      niveau_vise: row.niveau_vise ?? null,
      difficulte: row.difficulte ?? null,
      score: Math.min(100, result.score + boost),
      excluded: result.excluded,
      exclusionReason: result.exclusionReason,
      matchedRules: result.matchedRules,
      fresh: true,
      recentOccurrences: 0,
      source: "banque" as const,
    };
  });

  const passed = scored.filter((c) => !c.excluded);
  emptyReport.scored_passed_filters = passed.length;

  // ── 4. Croisement FRAÎCHEUR (historique devoirs + resultats de l'élève/groupe) ──
  const occurrences = await countRecentOccurrences(
    supabase,
    passed.map((c) => c.id),
    eleveIds,
    freshnessWindowDays,
  );
  for (const c of passed) {
    c.recentOccurrences = occurrences.get(c.id) ?? 0;
    c.fresh = c.recentOccurrences < freshnessMaxOccurrences;
  }

  // ── 5. Décision : score ≥ seuil ET frais → réutilisable ──
  const eligible = passed
    .filter((c) => c.score >= reuseScoreMin && c.fresh)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score; // meilleur score d'abord
      return a.recentOccurrences - b.recentOccurrences; // puis le plus « frais »
    });
  emptyReport.fresh_eligible = eligible.length;

  const reusable = eligible.slice(0, count);
  emptyReport.reused = reusable.length;

  return {
    reusable,
    candidates: passed.sort((a, b) => b.score - a.score),
    report: emptyReport,
  };
}

/**
 * Compte, par exercice, le nombre de fois où il a été servi récemment (devoirs
 * + résultats) aux élèves donnés, dans la fenêtre de fraîcheur. Sans élèves
 * fournis, on regarde toute activité récente sur l'exercice.
 */
async function countRecentOccurrences(
  supabase: SupabaseLike,
  exerciceIds: string[],
  eleveIds: string[],
  windowDays: number,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (exerciceIds.length === 0) return counts;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const bump = (rows: { exercice_id?: string | null }[] | null | undefined) => {
    for (const r of rows ?? []) {
      if (!r.exercice_id) continue;
      counts.set(r.exercice_id, (counts.get(r.exercice_id) ?? 0) + 1);
    }
  };

  try {
    let devoirsQuery = supabase
      .from("devoirs")
      .select("exercice_id")
      .in("exercice_id", exerciceIds)
      .gte("created_at", since);
    if (eleveIds.length > 0) devoirsQuery = devoirsQuery.in("eleve_id", eleveIds);
    const { data: devoirs, error: devoirsErr } = await devoirsQuery;
    if (devoirsErr) console.error("[exercise-search] devoirs freshness error:", devoirsErr);
    bump(devoirs);

    let resultatsQuery = supabase
      .from("resultats")
      .select("exercice_id")
      .in("exercice_id", exerciceIds)
      .gte("created_at", since);
    if (eleveIds.length > 0) resultatsQuery = resultatsQuery.in("eleve_id", eleveIds);
    const { data: resultats, error: resultatsErr } = await resultatsQuery;
    if (resultatsErr) console.error("[exercise-search] resultats freshness error:", resultatsErr);
    bump(resultats);
  } catch (e) {
    console.error("[exercise-search] freshness crossing failed:", e);
  }

  return counts;
}

/**
 * Score un exercice GÉNÉRÉ par l'IA avec le MÊME juge unique, pour annoter la
 * réponse (cohérence du scoring global entre banque et génération).
 */
export function scoreGeneratedExercise(
  draft: Record<string, unknown>,
  target: SearchTarget,
): { score: number; matchedRules: string[]; excluded: boolean } {
  const ctx = buildScoringContexts(target);
  const exercise = {
    // exercice GÉNÉRÉ pour cette cible → son thème est celui de la cible (canonique)
    theme_id: canonicalizeTheme(target.themeId) ?? undefined,
    domaine_irn: (draft.contexte_irn as string | undefined) ?? undefined,
    niveau_cecrl: (draft.niveau_vise as string | undefined) ?? target.niveauVise,
    competence: (draft.competence as string | undefined) ?? target.competence,
    format: (draft.format as string | undefined) ?? undefined,
  };
  const result = scoreCandidateWithTheme(exercise, ctx, canonicalizeTheme(target.themeId));
  return { score: result.score, matchedRules: result.matchedRules, excluded: result.excluded };
}
