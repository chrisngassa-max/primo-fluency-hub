import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AutoHomeworkPreviewDialog from '@/components/AutoHomeworkPreviewDialog';
import EndOfSessionSection from '@/components/EndOfSessionSection';

const state = vi.hoisted(() => ({
  mode: 'validation', content: {} as any, failExerciseAt: 0,
  writes: [] as { table: string; rows: any }[], exercises: [] as any[], devoirs: [] as any[],
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/AbsentMakeupDialog', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from(table: string) {
    let mutation: { operation: string; rows: any } | undefined;
    const query: any = {
      select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
      single: () => query, maybeSingle: () => query,
      insert: (rows: any) => { mutation = { operation: 'insert', rows }; return query; },
      update: (rows: any) => { mutation = { operation: 'update', rows }; return query; },
      then(resolve: any, reject: any) {
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
  });
  it('conserve le chemin manuel avec exercice existant et envoi explicite', async () => {
    await render(true); await click(button(/^Envoyer les devoirs$/)); expect(state.writes).toEqual([]);
    await click(button(/^Envoyer \(/));
    expect(state.exercises).toEqual([]);
    expect(state.devoirs).toEqual([expect.objectContaining({ exercice_id: 'exercise', eleve_id: 'student', source_label: 'session_manual_validated' })]);
  });
});
