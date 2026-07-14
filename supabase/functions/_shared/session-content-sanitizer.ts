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

export interface RawExercice {
  id: string;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: string;
  civic_content?: boolean;
  contenu?: { items?: RawItem[] };
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
}

export function sanitizeExercice(exercice: RawExercice): SanitizedExercice {
  const items = Array.isArray(exercice.contenu?.items) ? exercice.contenu!.items! : [];
  return {
    id: exercice.id,
    titre: exercice.titre,
    consigne: exercice.consigne,
    competence: exercice.competence,
    format: exercice.format,
    niveau_vise: exercice.niveau_vise,
    civic_content: Boolean(exercice.civic_content),
    items: items.map(sanitizeItem),
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
