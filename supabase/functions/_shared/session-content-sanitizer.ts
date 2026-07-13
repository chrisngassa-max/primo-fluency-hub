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
