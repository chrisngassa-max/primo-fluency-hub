import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AutoHomeworkPreviewDialog from '@/components/AutoHomeworkPreviewDialog';
import EndOfSessionSection from '@/components/EndOfSessionSection';

const state = vi.hoisted(() => ({
  mode: 'validation', content: {} as any, failExerciseAt: 0,
  writes: [] as { table: string; rows: any }[], exercises: [] as any[], devoirs: [] as any[],
  rpc: vi.fn(), deferMembers: null as null | Promise<any>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/AbsentMakeupDialog', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: (...args: any[]) => state.rpc(...args),
  from(table: string) {
    let mutation: { operation: string; rows: any } | undefined;
    const query: any = {
      select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
      single: () => query, maybeSingle: () => query,
      insert: (rows: any) => { mutation = { operation: 'insert', rows }; return query; },
      update: (rows: any) => { mutation = { operation: 'update', rows }; return query; },
      then(resolve: any, reject: any) {
        if (!mutation && table === 'group_members' && state.deferMembers) return state.deferMembers.then(resolve, reject);
        const exercise = { id: 'exercise', titre: 'Le rendez-vous', competence: 'CE', format: 'qcm',
          niveau_vise: 'A2', difficulte: 3, consigne: 'Lis et choisis.', contenu: state.content, point_a_maitriser_id: 'point' };
        let data: any; let error: any = null;
        if (mutation) {
          state.writes.push({ table, rows: mutation.rows });
          if (table === 'exercices') {
            const attempts = state.writes.filter(w => w.table === 'exercices').length;
            if (attempts === state.failExerciseAt) error = { message: 'Échec simulé de création' };
            else { data = { id: `created-${attempts}` }; state.exercises.push({ ...mutation.rows, ...data }); }
          }
          if (table === 'devoirs') state.devoirs.push(...[mutation.rows].flat());
        } else {
          data = table === 'groups' ? { homework_delivery_mode: state.mode }
            : table === 'group_members' ? [{ eleve_id: 'student', profiles: { id: 'student', prenom: 'Recette', nom: 'Fictive' }, eleve: { id: 'student', prenom: 'Recette', nom: 'Fictive' } }]
            : table === 'session_exercices' ? [{ exercice_id: 'exercise', exercices: exercise }]
            : table === 'exercices' ? [exercise]
            : table === 'points_a_maitriser' ? { id: 'point' } : [];
        }
        return Promise.resolve({ data, error }).then(resolve, reject);
      },
    };
    return query;
  },
} }));

let root: Root; let host: HTMLDivElement; let client: QueryClient;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const complete = { texte: 'Le rendez-vous est mardi.', items: [{ question: 'Quel jour ?', options: ['Mardi', 'Jeudi'], bonne_reponse: 'Mardi' }] };
async function render(manual = false) {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{manual
      ? <EndOfSessionSection sessionId="session" groupId="group" userId="teacher" sessionStatut="en_cours" checkedExerciseIds={['exercise']} />
      : <AutoHomeworkPreviewDialog open onOpenChange={() => {}} sessionId="session" groupId="group" userId="teacher" durationMinutes={8} />
    }</QueryClientProvider>);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
}
function button(pattern: RegExp) {
  const found = [...document.querySelectorAll('button')].find(node => pattern.test(node.textContent ?? ''));
  if (!found) throw new Error(`Bouton absent : ${pattern}`);
  return found;
}
async function click(node: HTMLElement) { await act(async () => node.click()); }
beforeEach(() => {
  state.mode = 'validation'; state.content = structuredClone(complete); state.failExerciseAt = 0;
  state.writes = []; state.exercises = []; state.devoirs = [];
  state.deferMembers = null;
  state.rpc.mockReset().mockImplementation(async (_name, payload) => {
    // Only a transaction-shaped test double. Real rollback/mirror tests run in PostgreSQL.
    if (state.failExerciseAt) return { data: null, error: { message: 'Échec simulé au milieu de la transaction' } };
    state.writes.push({ table: 'rpc', rows: payload });
    state.exercises.push(...payload.p_entries.map((entry: any) => entry.exercise));
    state.devoirs.push(...payload.p_entries);
    return { data: { request_id: payload.p_request_id, homework_count: payload.p_entries.length }, error: null };
  });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); client?.clear(); });

describe('P0 — contrat devoirs automatiques sûrs, sans réseau', () => {
  it('ouvrir même en mode automatique mémorisé ne crée ni exercice ni attribution', async () => {
    state.mode = 'automatic'; await render(); expect(state.writes).toEqual([]);
  });
  it.each([{}, { texte: 'Un texte', items: [] }, { texte: 'Un texte', items: [{ question: 'Quel jour ?' }] }])(
    'refuse un contenu vide ou incomplet avant toute écriture (%j)', async contenu => {
      state.content = contenu; await render(); await click(button(/Valider et envoyer/));
      expect(state.writes).toEqual([]);
      expect(document.body.textContent).toMatch(/incomplet|inexécutable|contenu.*manquant|aucun exercice.*valide/i);
    },
  );
  it('montre le support et la question d’un exercice complet avant confirmation', async () => {
    await render(); expect(document.body.textContent).toContain('Le rendez-vous est mardi.');
    expect(document.body.textContent).toContain('Quel jour ?'); expect(state.writes).toEqual([]);
  });
  it('demande une confirmation explicite après la prévisualisation, puis envoie', async () => {
    await render(); await click(button(/Valider et envoyer/)); expect(state.writes).toEqual([]);
    await click(button(/Confirmer l.envoi/)); expect(state.devoirs.length).toBeGreaterThan(0);
  });
  it('un échec partiel ne conserve ni création partielle ni attribution', async () => {
    state.failExerciseAt = 2; await render(); await click(button(/Valider et envoyer/));
    const confirm = [...document.querySelectorAll('button')].find(n => /Confirmer l.envoi/.test(n.textContent ?? ''));
    if (confirm) await click(confirm);
    expect(state.devoirs).toEqual([]); expect(state.exercises).toEqual([]);
    expect(state.rpc).toHaveBeenCalledOnce();
  });
  it('conserve le chemin manuel avec exercice existant et envoi explicite', async () => {
    await render(true); await click(button(/^Envoyer les devoirs$/)); expect(state.writes).toEqual([]);
    await click(button(/^Envoyer \(/));
    expect(state.exercises).toEqual([]);
    expect(state.devoirs).toEqual([expect.objectContaining({ exercice_id: 'exercise', eleve_id: 'student', source_label: 'session_manual_validated' })]);
  });
  it('double clic final : une seule requête, sans insertion directe', async () => {
    await render(); await click(button(/Valider et envoyer/));
    const confirm = button(/Confirmer l.envoi/);
    await act(async () => { confirm.click(); confirm.click(); });
    expect(state.rpc).toHaveBeenCalledOnce();
    expect(state.writes.every(w => w.table === 'rpc')).toBe(true);
  });
  it('une réponse tardive de préparation après fermeture ne repeuple pas le dialogue', async () => {
    let resolve!: (value: any) => void;
    state.deferMembers = new Promise(r => { resolve = r; });
    await render();
    await act(async () => root.render(<QueryClientProvider client={client}><AutoHomeworkPreviewDialog open={false} onOpenChange={() => {}} sessionId="session" groupId="group" userId="teacher" durationMinutes={8} /></QueryClientProvider>));
    await act(async () => resolve({ data: [{ eleve_id: 'old', profiles: { prenom: 'Ancienne ouverture' } }], error: null }));
    expect(document.body.textContent).not.toContain('Ancienne ouverture');
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.writes).toEqual([]);
  });
  it('modifier l’échéance invalide la confirmation', async () => {
    await render(); await click(button(/Valider et envoyer/));
    const input = document.querySelector<HTMLInputElement>('#homework-deadline')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2099-01-01');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain('Confirmer l’envoi');
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('réessaie un résultat réseau incertain avec le même request_id', async () => {
    state.failExerciseAt = 2;
    await render(); await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    await click(button(/Confirmer l.envoi/));
    expect(state.rpc).toHaveBeenCalledTimes(2);
    expect(state.rpc.mock.calls[0][1].p_request_id).toBe(state.rpc.mock.calls[1][1].p_request_id);
  });
  it('changer la sélection ou repréparer le contenu annule la confirmation', async () => {
    await render(); await click(button(/Valider et envoyer/));
    await click(document.querySelector<HTMLElement>('[role="checkbox"]')!);
    expect(document.body.textContent).not.toContain('Confirmer l’envoi');
    await click(document.querySelector<HTMLElement>('[role="checkbox"]')!);
    await click(button(/Valider et envoyer/));
    state.content = { ...complete, texte: 'Un nouveau support.' };
    await click(button(/Repréparer/));
    expect(document.body.textContent).toContain('Un nouveau support.');
    expect(document.body.textContent).not.toContain('Confirmer l’envoi');
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('montre aussi le support image réellement utilisé', async () => {
    state.content = { image_url: 'https://example.invalid/support.png', items: complete.items };
    await render();
    expect(document.querySelector('img')?.getAttribute('src')).toBe(state.content.image_url);
    expect(button(/Valider et envoyer/).disabled).toBe(false);
  });
  it('ignore la réponse d’envoi d’une ancienne ouverture et bloque le chevauchement', async () => {
    let resolve!: (value: any) => void;
    state.rpc.mockImplementation(() => new Promise(r => { resolve = r; }));
    const onSent = vi.fn(); const onOpenChange = vi.fn();
    await render();
    const reopen = async (open: boolean) => act(async () => root.render(<QueryClientProvider client={client}><AutoHomeworkPreviewDialog open={open} onOpenChange={onOpenChange} onSent={onSent} sessionId="session" groupId="group" userId="teacher" durationMinutes={8} /></QueryClientProvider>));
    await reopen(true);
    await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    const requestId = state.rpc.mock.calls[0][1].p_request_id;
    await reopen(false); await reopen(true);
    expect(button(/Valider et envoyer/).disabled).toBe(true);
    await act(async () => resolve({ data: { request_id: requestId, homework_count: 2 }, error: null }));
    expect(onSent).not.toHaveBeenCalled(); expect(onOpenChange).not.toHaveBeenCalled();
    expect(state.rpc).toHaveBeenCalledOnce(); expect(state.writes).toEqual([]);
    await click(button(/Repréparer/)); await click(button(/Valider et envoyer/));
    await click(button(/Confirmer l.envoi/));
    expect(state.rpc.mock.calls[1][1].p_request_id).toBe(requestId);
    await act(async () => resolve({ data: null, error: { message: 'RPC indisponible' } }));
    expect(state.writes).toEqual([]);
  });
});
