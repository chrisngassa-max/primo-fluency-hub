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

import { scoreExerciseCandidate } from "./referential-loader.ts";

// ─── Seuils configurables (juge unique 0-100 + fenêtre de fraîcheur) ───
export const REUSE_SCORE_MIN = 80; // score ≥ 80 → réutilisable depuis la banque
export const GENERATE_SCORE_MIN = 60; // score 60-79 → on préfère générer (puis scorer)
export const FRESHNESS_WINDOW_DAYS = 30; // fenêtre « vu récemment » (en jours)
export const FRESHNESS_MAX_OCCURRENCES = 1; // ≥ N occurrences récentes → considéré « vu récemment »
export const DEFAULT_CANDIDATE_LIMIT = 200; // garde-fou sur le volume requêté

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
}

/**
 * Mappe une ligne `exercices` réelle vers l'objet `exercise` attendu par le
 * juge `scoreExerciseCandidate`.
 *
 * NOTE THÈME (important) : la table `exercices` ne renseigne pas de façon
 * fiable `theme`/`contexte_irn` (themes distincts ≈ 1, contexte_irn null ~97%).
 * Le juge applique un FILTRE DUR (EXCL_01) qui exclut tout exercice dont
 * `theme_id != session.theme_id`. Appliqué ici sur des thèmes vides, il
 * exclurait toute la banque et tuerait le « search-first ». On laisse donc
 * `theme_id` indéfini des DEUX côtés (exercise + session) quand aucun thème
 * strict n'est demandé : le juge l'évalue alors comme « concordant » (pas
 * d'exclusion, bonus SCORE_01 uniforme). On NE FORK PAS le juge — on neutralise
 * une dimension non renseignée dans les données.
 */
export function mapRowToScoringExercise(
  row: ExerciseRow,
  target: SearchTarget,
): Record<string, unknown> {
  const etayage = ["fort", "moyen", "faible"].includes(String(row.niveau_guidage ?? ""))
    ? row.niveau_guidage
    : undefined;
  return {
    theme_id: target.themeId ?? undefined,
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
      // theme_id volontairement omis (voir note dans mapRowToScoringExercise)
      theme_id: target.themeId ?? undefined,
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
      "id, titre, consigne, competence, niveau_vise, format, difficulte, contenu, contexte_irn, theme, niveau_guidage, sous_competence, metadata_code, metadata_skill, mode, objectif_tcf, animation_guide, variante_niveau_bas, variante_niveau_haut, is_ai_generated",
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
  const scored: ScoredCandidate[] = validRows.map((row) => {
    const result = scoreExerciseCandidate({
      exercise: mapRowToScoringExercise(row, params),
      session: ctx.session,
      student: ctx.student,
      matrix: ctx.matrix,
    });
    return {
      id: row.id,
      titre: row.titre ?? null,
      competence: row.competence ?? null,
      format: row.format ?? null,
      niveau_vise: row.niveau_vise ?? null,
      difficulte: row.difficulte ?? null,
      score: result.score,
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
    theme_id: target.themeId ?? undefined,
    domaine_irn: (draft.contexte_irn as string | undefined) ?? undefined,
    niveau_cecrl: (draft.niveau_vise as string | undefined) ?? target.niveauVise,
    competence: (draft.competence as string | undefined) ?? target.competence,
    format: (draft.format as string | undefined) ?? undefined,
  };
  const result = scoreExerciseCandidate({
    exercise,
    session: ctx.session,
    student: ctx.student,
    matrix: ctx.matrix,
  });
  return { score: result.score, matchedRules: result.matchedRules, excluded: result.excluded };
}
