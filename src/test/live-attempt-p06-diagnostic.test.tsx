import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveAttemptSync } from '@/hooks/useLiveAttemptSync';

// Read-only catalog + UI2 logs, 2026-10-04: UPDATE fails with 42703 in
// guard_exercise_attempts_eleve_update (source_resultat_id is absent).
// The INSERT fallback then fails with 23505 (one active attempt per pair).
// This models those observed responses; it does not execute PostgreSQL.
const db = vi.hoisted(() => ({
  brokenGuard: true,
  row: null as Record<string, any> | null,
  calls: [] as Array<{ operation: string; payload: any; filters: Record<string, string> }>,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    expect(table).toBe('exercise_attempts');
    let operation = ''; let payload: any; const filters: Record<string, string> = {};
    const query = {
      update: (value: any) => { operation = 'update'; payload = value; return query; },
      insert: (value: any) => { operation = 'insert'; payload = value; return query; },
      eq: (key: string, value: string) => { filters[key] = value; return query; },
      select: () => query,
      maybeSingle: async () => {
        db.calls.push({ operation, payload: structuredClone(payload), filters });
        if (operation === 'update') {
          if (!db.row) return { data: null, error: null };
          if (db.brokenGuard) return { data: null, error: {
            code: '42703', message: 'record "new" has no field "source_resultat_id"',
          } };
          Object.assign(db.row, payload);
          return { data: { id: db.row.id }, error: null };
        }
        if (db.row) return { data: null, error: { code: '23505', message: 'duplicate active attempt' } };
        db.row = { id: 'attempt-test', ...payload };
        return { data: { id: db.row.id }, error: null };
      },
    };
    return query;
  },
} }));

const options = (answers: Record<string, string>) => ({
  exerciseId: 'exercise-test', learnerId: 'learner-test', answers,
  items: [{ question: 'Jour ?', bonne_reponse: 'Mardi' }],
});
let root: Root; let host: HTMLDivElement;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function renderHook<P,>(useHook: (props: P) => unknown, config?: { initialProps: P }) {
  function Harness({ value }: { value: P }) { useHook(value); return null; }
  const rerender = (value: P) => { act(() => root.render(<Harness value={value} />)); };
  rerender(config?.initialProps as P);
  return { rerender };
}
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(800); }); }
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.useFakeTimers(); db.brokenGuard = true; db.row = null; db.calls = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('P0.6 — diagnostic du hook réel, réponses serveur observées', () => {
  it('doit persister la sélection après la création initiale vide (défaut serveur connu)', async () => {
    const hook = renderHook(({ answers }) => useLiveAttemptSync(options(answers)), {
      initialProps: { answers: {} as Record<string, string> },
    });
    await tick();
    expect(db.row?.answers).toEqual({});
    hook.rerender({ answers: { 0: 'Mardi' } });
    await tick();
    // Payload correct, même paire, pas de fermeture obsolète ni confusion 0/"0".
    const update = db.calls.filter(call => call.operation === 'update').at(-1)!;
    expect(update.payload.answers).toEqual({ 0: 'Mardi' });
    expect(update.payload.item_results.answered).toBe(1);
    expect(update.filters).toEqual({ exercise_id: 'exercise-test', learner_id: 'learner-test', status: 'in_progress' });
    expect(db.calls.map(call => call.operation)).toEqual(['update', 'insert', 'update', 'insert']);
    expect(db.row?.answers).toEqual({ 0: 'Mardi' });
    expect(db.row?.item_results.answered).toBe(1);
  });

  it('témoin : la même sélection est persistée si UPDATE réussit', async () => {
    db.brokenGuard = false;
    const hook = renderHook(({ answers }) => useLiveAttemptSync(options(answers)), {
      initialProps: { answers: {} as Record<string, string> },
    });
    await tick(); hook.rerender({ answers: { 0: 'Mardi' } }); await tick();
    expect(db.row?.answers).toEqual({ 0: 'Mardi' });
    expect(db.row?.item_results.answered).toBe(1);
    expect(db.calls.map(call => call.operation)).toEqual(['update', 'insert', 'update']);
  });

  it('témoin : une réponse restaurée au montage reprend la tentative existante', async () => {
    db.brokenGuard = false;
    db.row = { id: 'attempt-test', answers: {}, status: 'in_progress' };
    renderHook(() => useLiveAttemptSync(options({ '0': 'Mardi' })));
    await tick();
    expect(db.row.answers).toEqual({ '0': 'Mardi' });
    expect(db.calls.map(call => call.operation)).toEqual(['update']);
    expect(db.calls[0].payload).not.toHaveProperty('status');
    expect(db.calls[0].payload).not.toHaveProperty('score_normalized');
    expect(db.calls[0].payload).not.toHaveProperty('completed_at');
  });

  it('ne synchronise pas après désactivation / affichage du résultat', async () => {
    renderHook(() => useLiveAttemptSync({ ...options({ '0': 'Mardi' }), disabled: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(db.calls).toEqual([]);
  });
});
