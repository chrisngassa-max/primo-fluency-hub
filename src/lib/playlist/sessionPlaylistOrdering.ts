/**
 * Logique PURE de réordonnancement de la playlist d'une séance
 * (`session_exercices.ordre`). Aucune dépendance Supabase ici : ce module
 * ne fait que du calcul sur des tableaux en mémoire, pour rester
 * entièrement testable sans base de données. Le composant React
 * (`SessionPlaylistPanel.tsx`) appelle ces fonctions puis persiste le
 * résultat (`{ id, ordre }[]`) via une mise à jour Supabase.
 *
 * Règle d'or : l'identifiant stable (`id` = `session_exercices.id`) n'est
 * JAMAIS modifié par ces fonctions — seul `ordre` change. Les résultats
 * (`resultats`, `exercise_attempts`) sont liés à `exercice_id`, jamais à
 * `ordre` ni à la position affichée : le réordonnancement ne peut donc
 * jamais casser un résultat déjà enregistré.
 *
 * Verrouillage : une activité est `locked` (non déplaçable, non
 * supprimable) dès qu'au moins une tentative existe pour son exercice
 * (`in_progress` ou `completed`) — voir `computeLockedState` dans
 * `SessionPlaylistPanel.tsx`, qui croise `session_exercices` avec
 * `exercise_attempts`. Un item verrouillé peut néanmoins voir son numéro
 * d'affichage « X sur N » changer si d'autres activités sont insérées ou
 * retirées autour de lui — ce n'est qu'un recalcul d'affichage, jamais un
 * déplacement actif de l'item verrouillé lui-même.
 */

export interface PlaylistItem {
  /** session_exercices.id — identifiant stable, jamais modifié ici. */
  id: string;
  /** session_exercices.ordre — seul champ que ce module recalcule. */
  ordre: number;
  /** true si au moins une tentative existe pour cette activité (in_progress ou completed). */
  locked: boolean;
}

export interface ReorderResult {
  ok: true;
  /** Liste complète, triée, avec `ordre` recalculé en 1..N contigu. */
  items: PlaylistItem[];
  /** Sous-ensemble à persister (seuls les items dont `ordre` a changé). */
  changed: { id: string; ordre: number }[];
}

export interface ReorderError {
  ok: false;
  reason: 'not_found' | 'locked' | 'invalid_position' | 'noop';
  message: string;
}

export type ReorderOutcome = ReorderResult | ReorderError;

export function sortByOrdre(items: PlaylistItem[]): PlaylistItem[] {
  return [...items].sort((a, b) => a.ordre - b.ordre);
}

/**
 * Renumérote 1..N (contigu) en respectant l'ORDRE DU TABLEAU tel que reçu
 * (pas un re-tri par l'ancien `ordre`, qui annulerait tout déplacement déjà
 * effectué au niveau des positions du tableau).
 */
function renumber(items: PlaylistItem[]): PlaylistItem[] {
  return items.map((item, index) => ({ ...item, ordre: index + 1 }));
}

function diffChanged(before: PlaylistItem[], after: PlaylistItem[]): { id: string; ordre: number }[] {
  const beforeMap = new Map(before.map((i) => [i.id, i.ordre]));
  return after
    .filter((item) => beforeMap.get(item.id) !== item.ordre)
    .map((item) => ({ id: item.id, ordre: item.ordre }));
}

function ok(before: PlaylistItem[], after: PlaylistItem[]): ReorderResult {
  const renumbered = renumber(after);
  return { ok: true, items: renumbered, changed: diffChanged(before, renumbered) };
}

function err(reason: ReorderError['reason'], message: string): ReorderError {
  return { ok: false, reason, message };
}

/** Retourne { position (1-based), total } pour l'affichage "Activité X sur N". */
export function positionOf(items: PlaylistItem[], id: string): { position: number; total: number } | null {
  const sorted = sortByOrdre(items);
  const index = sorted.findIndex((i) => i.id === id);
  if (index === -1) return null;
  return { position: index + 1, total: sorted.length };
}

export function moveUp(items: PlaylistItem[], id: string): ReorderOutcome {
  const sorted = sortByOrdre(items);
  const index = sorted.findIndex((i) => i.id === id);
  if (index === -1) return err('not_found', `Activité ${id} introuvable.`);
  if (sorted[index].locked) return err('locked', 'Une activité déjà commencée ou terminée ne peut pas être déplacée.');
  if (index === 0) return err('noop', 'Déjà en première position.');
  const swapped = [...sorted];
  [swapped[index - 1], swapped[index]] = [swapped[index], swapped[index - 1]];
  return ok(items, swapped);
}

export function moveDown(items: PlaylistItem[], id: string): ReorderOutcome {
  const sorted = sortByOrdre(items);
  const index = sorted.findIndex((i) => i.id === id);
  if (index === -1) return err('not_found', `Activité ${id} introuvable.`);
  if (sorted[index].locked) return err('locked', 'Une activité déjà commencée ou terminée ne peut pas être déplacée.');
  if (index === sorted.length - 1) return err('noop', 'Déjà en dernière position.');
  const swapped = [...sorted];
  [swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]];
  return ok(items, swapped);
}

/** Déplace l'activité `id` à la position 1-based `position` (parmi la liste complète). */
export function moveToPosition(items: PlaylistItem[], id: string, position: number): ReorderOutcome {
  const sorted = sortByOrdre(items);
  const index = sorted.findIndex((i) => i.id === id);
  if (index === -1) return err('not_found', `Activité ${id} introuvable.`);
  if (sorted[index].locked) return err('locked', 'Une activité déjà commencée ou terminée ne peut pas être déplacée.');
  if (position < 1 || position > sorted.length) {
    return err('invalid_position', `Position ${position} hors limites (1 à ${sorted.length}).`);
  }
  const targetIndex = position - 1;
  if (targetIndex === index) return err('noop', 'Déjà à cette position.');
  const withoutItem = sorted.filter((i) => i.id !== id);
  withoutItem.splice(targetIndex, 0, sorted[index]);
  return ok(items, withoutItem);
}

/** Insère un nouvel item (déjà créé côté DB, id fourni) avant ou après `referenceId`. */
export function insertItem(
  items: PlaylistItem[],
  referenceId: string,
  position: 'before' | 'after',
  newItem: Omit<PlaylistItem, 'ordre'>,
): ReorderOutcome {
  const sorted = sortByOrdre(items);
  const refIndex = sorted.findIndex((i) => i.id === referenceId);
  if (refIndex === -1) return err('not_found', `Activité de référence ${referenceId} introuvable.`);
  const insertIndex = position === 'before' ? refIndex : refIndex + 1;
  const withInsertion = [...sorted];
  withInsertion.splice(insertIndex, 0, { ...newItem, ordre: 0 });
  return ok(items, withInsertion);
}

/**
 * Place un clone immédiatement après son original — cas particulier
 * d'`insertItem` avec `position: 'after'`, exposé séparément pour lisibilité
 * côté appelant (bouton "Cloner").
 */
export function insertCloneAfterOriginal(
  items: PlaylistItem[],
  originalId: string,
  clone: Omit<PlaylistItem, 'ordre'>,
): ReorderOutcome {
  return insertItem(items, originalId, 'after', clone);
}

/** Retire une activité — refuse si verrouillée (déjà commencée/terminée). */
export function removeItem(items: PlaylistItem[], id: string): ReorderOutcome {
  const sorted = sortByOrdre(items);
  const target = sorted.find((i) => i.id === id);
  if (!target) return err('not_found', `Activité ${id} introuvable.`);
  if (target.locked) return err('locked', 'Une activité déjà commencée ou terminée ne peut pas être retirée.');
  const remaining = sorted.filter((i) => i.id !== id);
  return ok(items, remaining);
}
