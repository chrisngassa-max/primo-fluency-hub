/**
 * Projection nettoyée d'un item/exercice pour l'apprenant. Module PUR (pas
 * d'import Deno/esm.sh) afin d'être testable sous Vitest/Node — voir
 * supabase/functions/_shared/session-content-sanitizer.test.mjs.
 *
 * Règle absolue (relecture indépendante 2026-07-13, point 1) : jamais
 * bonne_reponse, explication, justification_attendue, criteres_evaluation,
 * mots_cles_attendus, ni aucun champ de barème dans la sortie.
 */

export interface RawItem {
  question?: string;
  texte?: string;
  enonce?: string;
  consigne?: string;
  options?: string[];
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
}

const ALLOWED_ITEM_KEYS = ["question", "texte", "enonce", "consigne", "options"] as const;

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
