/**
 * Projection nettoyée d'un item/exercice pour l'apprenant. Module PUR (pas
 * d'import Deno/esm.sh) afin d'être testable sous Vitest/Node — voir
 * supabase/functions/_shared/session-content-sanitizer.test.mjs.
 *
 * Règle absolue (relecture indépendante 2026-07-13, point 1) : jamais
 * bonne_reponse, explication, justification_attendue, criteres_evaluation,
 * mots_cles_attendus, ni aucun champ de barème dans la sortie.
 *
 * `justification_prompt`/`justification_required`/`justification_type`
 * (Lot 2, différenciation S01) sont distincts de `justification_attendue` :
 * ce ne sont jamais des données de corrigé, seulement le pilotage du champ
 * de saisie affiché à l'apprenant —
 *   - justification_prompt  : la CONSIGNE affichée demandant de justifier ;
 *   - justification_required: si vrai, le client doit bloquer la validation
 *     tant que ce champ est vide (contrat B1/B2) — revérifié côté serveur ;
 *   - justification_type    : nuance du type de justification attendu
 *     (ex. "justification" vs "nuance"), purement informatif pour l'UI.
 * `indice` (Lot 2, étayage A1) est un extrait RÉEL déjà rédigé dans la
 * source (jamais généré), affiché en amont pour aider à repérer la bonne
 * réponse (annotation/surlignage du support — cf. transformation A2_TO_A1
 * "highlight"). Distinct de `bonne_reponse`/`correction` : il pointe vers un
 * passage du support, jamais vers "quelle option choisir".
 * `banque_mots` (Lot 2, texte_lacunaire A1/A2) est l'ensemble RÉEL des mots
 * à placer, mélangé, jamais associé à un trou précis : une banque de mots
 * n'indique pas quel mot va où, contrairement à `bonne_reponse`.
 *
 * Volontairement ajoutés à la liste blanche — ne jamais y ajouter
 * justification_attendue/bonne_reponse/explication/criteres_evaluation/
 * correction/etc.
 */

export interface RawItem {
  question?: string;
  texte?: string;
  enonce?: string;
  consigne?: string;
  options?: string[];
  indice?: string;
  banque_mots?: string[];
  justification_prompt?: string;
  justification_required?: boolean;
  justification_type?: string;
  bonne_reponse?: string;
  explication?: string;
  justification_attendue?: string;
  criteres_evaluation?: unknown;
  mots_cles_attendus?: string[];
  [key: string]: unknown;
}

export interface SanitizedItem {
  question?: string;
  texte?: string;
  enonce?: string;
  consigne?: string;
  options?: string[];
  indice?: string;
  banque_mots?: string[];
  justification_prompt?: string;
  justification_required?: boolean;
  justification_type?: string;
}
export interface RawWorkedExample {
  level?: string;
  format?: string;
  instruction?: string;
  question?: string;
  highlighted_text?: string;
  options?: string[];
  response?: string;
  completed_response?: string;
  explanation_steps?: string[];
  [key: string]: unknown;
}

export interface SanitizedWorkedExample {
  level: string;
  format: string;
  instruction: string;
  question: string;
  highlighted_text?: string;
  options?: string[];
  response: string;
  completed_response?: string;
  explanation_steps: string[];
}

const ALLOWED_ITEM_KEYS = [
  "question", "texte", "enonce", "consigne", "options", "indice", "banque_mots",
  "justification_prompt", "justification_required", "justification_type",
] as const;

export function sanitizeItem(item: RawItem): SanitizedItem {
  const out: SanitizedItem = {};
  for (const key of ALLOWED_ITEM_KEYS) {
    if (item[key] !== undefined) (out as Record<string, unknown>)[key] = item[key];
  }
  return out;
}
export function sanitizeWorkedExample(value: RawWorkedExample | undefined): SanitizedWorkedExample | undefined {
  if (!value || typeof value !== "object") return undefined;
  const level = String(value.level ?? "").trim();
  const format = String(value.format ?? "").trim();
  const instruction = String(value.instruction ?? "").trim();
  const question = String(value.question ?? "").trim();
  const response = String(value.response ?? "").trim();
  const explanationSteps = Array.isArray(value.explanation_steps)
    ? value.explanation_steps.map((step) => String(step).trim()).filter(Boolean)
    : [];
  if (!level || !format || !instruction || !question || !response || explanationSteps.length === 0) return undefined;
  return {
    level,
    format,
    instruction,
    question,
    ...(String(value.highlighted_text ?? "").trim() ? { highlighted_text: String(value.highlighted_text).trim() } : {}),
    ...(Array.isArray(value.options) ? { options: value.options.map((option) => String(option)) } : {}),
    response,
    ...(String(value.completed_response ?? "").trim()
      ? { completed_response: String(value.completed_response).trim() }
      : {}),
    explanation_steps: explanationSteps,
  };
}

export interface RawExercice {
  id: string;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: string;
  civic_content?: boolean;
  /** `audio` est la référence stable à la source audio originale (voir
   *  family-to-exercice-adapter). Elle ne doit JAMAIS être retransmise à
   *  l'apprenant : seule la présence d'un original déclenche la résolution
   *  côté serveur. `script_audio` (la transcription complète) est
   *  délibérément NON transmis en séance : exposer la transcription permettrait
   *  à l'apprenant de lire les réponses dans le trafic réseau. */
  contenu?: { items?: RawItem[]; worked_example?: RawWorkedExample; audio?: unknown };
}

export interface SanitizedExercice {
  id: string;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: string;
  civic_content: boolean;
  items: SanitizedItem[];
  worked_example?: SanitizedWorkedExample;
  /** Indique qu'un audio original résolvable existe (le frontend appellera
   *  resolve-exercise-audio). Ne transporte ni la réf, ni le hash, ni le chemin
   *  Storage, ni la transcription. */
  has_original_audio?: boolean;
}

export function sanitizeExercice(exercice: RawExercice): SanitizedExercice {
  const items = Array.isArray(exercice.contenu?.items) ? exercice.contenu!.items! : [];
  const workedExample = sanitizeWorkedExample(exercice.contenu?.worked_example);
  const hasOriginalAudio = (exercice.competence ?? "").toUpperCase() === "CO"
    && exercice.contenu?.audio !== null && exercice.contenu?.audio !== undefined
    && typeof exercice.contenu?.audio === "object";
  return {
    id: exercice.id,
    titre: exercice.titre,
    consigne: exercice.consigne,
    competence: exercice.competence,
    format: exercice.format,
    niveau_vise: exercice.niveau_vise,
    civic_content: Boolean(exercice.civic_content),
    items: items.map(sanitizeItem),
    ...(workedExample ? { worked_example: workedExample } : {}),
    ...(hasOriginalAudio ? { has_original_audio: true } : {}),
  };
}

/**
 * Liste noire récursive pour `session_documents.content_json` (relecture
 * indépendante, point 5). Contrairement à content_html (assaini par
 * DOMPurify côté client) et aux items d'exercice (liste BLANCHE stricte
 * ci-dessus), content_json n'a pas de forme fixe aujourd'hui (colonne
 * réservée, non encore peuplée en pratique — vérifié par grep sur le
 * dépôt) : on ne peut donc pas énumérer une liste blanche de clés a priori.
 * On applique donc une liste NOIRE récursive, appliquée à toute profondeur
 * (objets et tableaux), qui retire structurellement toute clé pouvant
 * révéler un fichier ou une correction, quelle que soit la forme future de
 * ce contenu.
 */
const BLOCKED_JSON_KEYS = new Set([
  "file_url", "storage_path", "source_file_path", "bonne_reponse", "corrige",
  "correction", "bareme", "barème", "explication", "justification_attendue",
  "criteres_evaluation", "mots_cles_attendus", "score", "score_normalized",
]);

export function sanitizeContentJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeContentJson);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_JSON_KEYS.has(key)) continue;
      out[key] = sanitizeContentJson(v);
    }
    return out;
  }
  return value;
}
