import { describe, expect, it } from 'vitest';
import {
  insertCloneAfterOriginal,
  insertItem,
  moveDown,
  moveToPosition,
  moveUp,
  positionOf,
  removeItem,
  sortByOrdre,
  type PlaylistItem,
} from './sessionPlaylistOrdering';

function item(id: string, ordre: number, locked = false): PlaylistItem {
  return { id, ordre, locked };
}

describe('sessionPlaylistOrdering', () => {
  const base: PlaylistItem[] = [item('a', 1), item('b', 2), item('c', 3), item('d', 4)];

  it('insertion en première position', () => {
    const result = insertItem(base, 'a', 'before', { id: 'new', locked: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(['new', 'a', 'b', 'c', 'd']);
    expect(result.items[0].ordre).toBe(1);
    // identifiant stable : aucun id existant n'est modifié, seul ordre change.
    expect(result.items.find((i) => i.id === 'a')!.ordre).toBe(2);
  });

  it('insertion intermediaire', () => {
    const result = insertItem(base, 'b', 'after', { id: 'new', locked: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'new', 'c', 'd']);
  });

  it('insertion apres l\'original (cas clonage)', () => {
    const result = insertCloneAfterOriginal(base, 'c', { id: 'clone-of-c', locked: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'clone-of-c', 'd']);
    // Le clone est immediatement apres son original, jamais ailleurs.
    const originalIndex = result.items.findIndex((i) => i.id === 'c');
    const cloneIndex = result.items.findIndex((i) => i.id === 'clone-of-c');
    expect(cloneIndex).toBe(originalIndex + 1);
  });

  it('deplacement (monter/descendre)', () => {
    const up = moveUp(base, 'c');
    expect(up.ok).toBe(true);
    if (up.ok) expect(up.items.map((i) => i.id)).toEqual(['a', 'c', 'b', 'd']);

    const down = moveDown(base, 'b');
    expect(down.ok).toBe(true);
    if (down.ok) expect(down.items.map((i) => i.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('deplacement a une position precise', () => {
    const result = moveToPosition(base, 'd', 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('suppression', () => {
    const result = removeItem(base, 'b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((i) => i.id)).toEqual(['a', 'c', 'd']);
    // Renumerotation contigue apres suppression.
    expect(result.items.map((i) => i.ordre)).toEqual([1, 2, 3]);
  });

  it('conflit de positions : deux activites au meme ordre sont triees de facon stable puis renumerotees', () => {
    const conflicting: PlaylistItem[] = [item('a', 1), item('b', 1), item('c', 2)];
    const sorted = sortByOrdre(conflicting);
    // Array.prototype.sort est stable en JS moderne : 'a' garde la priorite sur 'b'.
    expect(sorted.map((i) => i.id)).toEqual(['a', 'b', 'c']);

    // Toute operation de reordonnancement renumerotera 1..N sans doublon.
    const result = moveDown(conflicting, 'c');
    // 'c' est deja en derniere position apres tri stable -> noop attendu.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('noop');
  });

  it('position invalide (hors limites) est rejetee explicitement', () => {
    const result = moveToPosition(base, 'a', 99);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_position');
  });

  it('activite deja commencee (locked=true) : deplacement et suppression refuses', () => {
    const withStarted: PlaylistItem[] = [item('a', 1), item('b', 2, true), item('c', 3)];

    const moveResult = moveUp(withStarted, 'b');
    expect(moveResult.ok).toBe(false);
    if (!moveResult.ok) expect(moveResult.reason).toBe('locked');

    const positionResult = moveToPosition(withStarted, 'b', 1);
    expect(positionResult.ok).toBe(false);
    if (!positionResult.ok) expect(positionResult.reason).toBe('locked');

    const removeResult = removeItem(withStarted, 'b');
    expect(removeResult.ok).toBe(false);
    if (!removeResult.ok) expect(removeResult.reason).toBe('locked');
  });

  it('activite terminee : conserve son ordre historique relatif, non deplacable', () => {
    const withCompleted: PlaylistItem[] = [item('a', 1, true), item('b', 2, true), item('c', 3), item('d', 4)];

    // Les deux activites terminees ('a', 'b') ne sont pas deplacables...
    expect(moveDown(withCompleted, 'a').ok).toBe(false);
    expect(moveUp(withCompleted, 'b').ok).toBe(false);

    // ...mais une insertion avant elles est possible et ne change pas leur
    // ORDRE RELATIF entre elles (a reste juste avant b).
    const result = insertItem(withCompleted, 'a', 'before', { id: 'new', locked: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const aIdx = result.items.findIndex((i) => i.id === 'a');
    const bIdx = result.items.findIndex((i) => i.id === 'b');
    expect(bIdx).toBe(aIdx + 1); // toujours consecutives, dans le meme ordre relatif
  });

  it('recalcul "X sur N" apres insertion et suppression', () => {
    expect(positionOf(base, 'c')).toEqual({ position: 3, total: 4 });

    const afterInsert = insertItem(base, 'a', 'after', { id: 'new', locked: false });
    if (!afterInsert.ok) throw new Error('expected ok');
    // 'c' etait 3/4, devient 4/5 apres insertion d'un nouvel item avant lui.
    expect(positionOf(afterInsert.items, 'c')).toEqual({ position: 4, total: 5 });

    const afterRemove = removeItem(base, 'a');
    if (!afterRemove.ok) throw new Error('expected ok');
    // 'c' etait 3/4, devient 2/3 apres suppression d'un item avant lui.
    expect(positionOf(afterRemove.items, 'c')).toEqual({ position: 2, total: 3 });
  });

  it('un item terminee peut voir son numero "X sur N" recalcule sans etre lui-meme deplace', () => {
    const withCompleted: PlaylistItem[] = [item('a', 1), item('b', 2, true), item('c', 3)];
    expect(positionOf(withCompleted, 'b')).toEqual({ position: 2, total: 3 });

    const result = insertItem(withCompleted, 'a', 'after', { id: 'new', locked: false });
    if (!result.ok) throw new Error('expected ok');
    // 'b' (terminee) est passee de la position 2 a la position 3 : simple
    // consequence d'affichage, PAS un deplacement actif de 'b' (elle est
    // toujours immediatement apres 'a'/'new' et avant 'c', son ordre relatif
    // aux items non verrouilles autour d'elle n'a pas change).
    expect(positionOf(result.items, 'b')).toEqual({ position: 3, total: 4 });
  });

  it('identifiant stable : l\'id ne change jamais, seul ordre est recalcule', () => {
    const result = moveToPosition(base, 'd', 2);
    if (!result.ok) throw new Error('expected ok');
    const ids = base.map((i) => i.id).sort();
    const resultIds = result.items.map((i) => i.id).sort();
    expect(resultIds).toEqual(ids); // aucun id perdu ni invente
  });
});
