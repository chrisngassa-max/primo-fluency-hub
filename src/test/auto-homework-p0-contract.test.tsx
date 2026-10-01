import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AutoHomeworkPreviewDialog from '@/components/AutoHomeworkPreviewDialog';
import EndOfSessionSection from '@/components/EndOfSessionSection';
import { webcrypto } from 'node:crypto';
import { toast } from 'sonner';
import { preserveHomeworkRequest } from '@/lib/homeworkSendRecovery';

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
Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
const complete = { texte: 'Le rendez-vous est mardi.', items: [{ question: 'Quel jour ?', options: ['Mardi', 'Jeudi'], bonne_reponse: 'Mardi' }] };
const onDialogChange = vi.fn();
async function render(manual = false, userId = 'teacher') {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{manual
      ? <EndOfSessionSection sessionId="session" groupId="group" userId="teacher" sessionStatut="en_cours" checkedExerciseIds={['exercise']} />
      : <AutoHomeworkPreviewDialog open onOpenChange={onDialogChange} sessionId="session" groupId="group" userId={userId} durationMinutes={8} />
    }</QueryClientProvider>);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
}
function button(pattern: RegExp) {
  const found = [...document.querySelectorAll('button')].find(node => pattern.test(node.textContent ?? ''));
  if (!found) throw new Error(`Bouton absent : ${pattern}`);
  return found;
}
async function click(node: HTMLElement) { await act(async () => { node.click(); await new Promise(r => setTimeout(r, 20)); }); }
async function reload(userId = 'teacher') {
  await act(async () => root.unmount()); host.remove(); client.clear();
  await render(false, userId);
}
const stored = () => Object.keys(sessionStorage).filter(key => key.startsWith('captcf:homework-send:')).map(key => JSON.parse(sessionStorage.getItem(key)!));
beforeEach(() => {
  onDialogChange.mockClear();
  vi.mocked(toast.error).mockClear();
  sessionStorage.clear();
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
  it.each([{ image: 'https://example.invalid/image.png', items: complete.items }, { ...complete, texte: 'Bonjour.' }])('explique le refus du support CE (%j)', async contenu => {
    state.content = contenu; await render();
    expect(document.body.textContent).toContain('Ajoutez un texte support d’au moins 20 caractères.');
    await click(button(/Valider et envoyer/));
    expect(state.rpc).not.toHaveBeenCalled();
  });
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
    await act(async () => { confirm.click(); confirm.click(); await new Promise(r => setTimeout(r, 20)); });
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
    state.content = { ...complete, texte: 'Un nouveau support préparé.' };
    await click(button(/Repréparer/));
    expect(document.body.textContent).toContain('Un nouveau support préparé.');
    expect(document.body.textContent).not.toContain('Confirmer l’envoi');
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('montre aussi le support image réellement utilisé', async () => {
    state.content = { ...complete, image_url: 'https://example.invalid/support.png' };
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
  it('rechargement et réponse perdue : même lot, même request_id, confirmation toujours requise', async () => {
    state.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await render();
    const input = document.querySelector<HTMLInputElement>('#homework-deadline')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2099-02-03');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    const first = state.rpc.mock.calls[0][1];
    expect(stored()).toHaveLength(1);
    await reload();
    expect(document.querySelector<HTMLInputElement>('#homework-deadline')!.value).toBe('2099-02-03');
    expect(state.rpc).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('Confirmer l’envoi');
    await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    expect(state.rpc.mock.calls[1][1].p_request_id).toBe(first.p_request_id);
    expect(stored()).toHaveLength(1);
  });
  it('contenu modifié après rechargement : nouvelle empreinte et confirmation', async () => {
    state.failExerciseAt = 2;
    await render(); await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    const first = stored()[0];
    state.content = { ...complete, texte: 'Autre contenu préparé.' };
    await reload(); expect(state.rpc).toHaveBeenCalledOnce();
    await click(button(/Valider et envoyer/)); expect(state.rpc).toHaveBeenCalledOnce();
    await click(button(/Confirmer l.envoi/));
    expect(state.rpc.mock.calls[1][1].p_request_id).not.toBe(first.requestId);
    expect(stored().find(r => r.requestId !== first.requestId)?.fingerprint).not.toBe(first.fingerprint);
  });
  it('succès serveur confirmé : efface uniquement la reprise correspondante', async () => {
    state.failExerciseAt = 2;
    await render(); await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    expect(stored()).toHaveLength(1); await reload(); state.failExerciseAt = 0;
    await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    expect(stored()).toEqual([]); expect(state.rpc.mock.calls[1][1].p_request_id).toBe(state.rpc.mock.calls[0][1].p_request_id);
  });
  it('autre compte : aucune reprise du premier utilisateur', async () => {
    state.failExerciseAt = 2;
    await render(); await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    await reload('other-teacher');
    await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
    expect(state.rpc.mock.calls[1][1].p_request_id).not.toBe(state.rpc.mock.calls[0][1].p_request_id);
    expect(stored().map(r => r.userId).sort()).toEqual(['other-teacher', 'teacher']);
  });
  it('stockage minimal, empreinte déterministe et échéance/destinataires isolés', async () => {
    const scope = { userId: 'teacher', sessionId: 'session', groupId: 'group' };
    const batch = { entries: [{ student_id: 'student', exercise: complete }], deadline: '2099-01-01' };
    const first = await preserveHomeworkRequest(scope, batch.deadline, batch);
    const reordered = await preserveHomeworkRequest(scope, batch.deadline, { deadline: batch.deadline, entries: batch.entries });
    expect(reordered.requestId).toBe(first.requestId);
    for (const changed of [{ ...batch, deadline: '2099-01-02' }, { ...batch, entries: [{ student_id: 'other-student', exercise: complete }] }, { ...batch, entries: [] }]) {
      const next = await preserveHomeworkRequest(scope, changed.deadline, changed);
      expect(next.fingerprint).not.toBe(first.fingerprint); expect(next.requestId).not.toBe(first.requestId);
    }
    for (const value of stored()) expect(Object.keys(value).sort()).toEqual(['createdAt', 'deadline', 'fingerprint', 'groupId', 'requestId', 'sessionId', 'userId']);
    expect(JSON.stringify(stored())).not.toMatch(/rendez-vous|Mardi|bonne_reponse|student|JWT|email|secret/);
  });
  it('stockage indisponible : aucun appel réseau ni insertion de secours', async () => {
    await render();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded'); });
    try {
      await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
      expect(state.rpc).not.toHaveBeenCalled(); expect(state.writes).toEqual([]);
      expect(document.body.textContent).toContain('Aucun envoi effectué');
    } finally { spy.mockRestore(); }
  });
});

const safeMessages = {
  conflict: 'La préparation a changé depuis votre dernière confirmation. Actualisez l’aperçu, puis confirmez de nouveau.',
  recipient: 'Vous ne pouvez pas envoyer ce devoir au groupe ou à l’élève sélectionné. Vérifiez le destinataire.',
  content: 'Au moins un exercice n’est pas prêt à être envoyé. Corrigez les éléments signalés, puis réessayez.',
  busy: 'Cet exercice est en cours de modification ou d’attribution. Réessayez dans un instant.',
  unknown: 'Le devoir n’a pas pu être envoyé. Aucun contenu n’a été créé. Réessayez ou actualisez la page.',
};
it.each([
  [{ message: 'homework_request_conflict' }, safeMessages.conflict],
  [{ message: 'homework_group_forbidden' }, safeMessages.recipient],
  [{ message: 'homework_inexecutable' }, safeMessages.content],
  [{ details: 'homework_exercise_busy' }, safeMessages.busy],
  [{ code: '55P03', message: 'SQLSTATE 55P03 public.exercices' }, safeMessages.busy],
  [{ message: 'SELECT * FROM public.devoirs; at send_automatic_homework stack' }, safeMessages.unknown],
  [null, safeMessages.unknown],
  [{ unexpected: ['private stack'] }, safeMessages.unknown],
])('P0.5 — erreur sûre, dialogue ouvert, aucun retry (%j)', async (error, expected) => {
  state.rpc.mockRejectedValue(error);
  await render(); await click(button(/Valider et envoyer/)); await click(button(/Confirmer l.envoi/));
  await act(async () => { await new Promise(r => setTimeout(r, 80)); });
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(expected);
  expect(document.body.textContent).not.toMatch(/homework_|55P03|SQLSTATE|SELECT|public\.|stack|send_automatic/);
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(onDialogChange).not.toHaveBeenCalled();
  expect(state.rpc).toHaveBeenCalledOnce(); expect(state.writes).toEqual([]);
});
it('P0.5 — erreur de préparation également masquée', async () => {
  state.deferMembers = Promise.reject({ message: 'SQLSTATE SELECT public.group_members stack' });
  await render();
  expect(toast.error).toHaveBeenCalledWith('Préparation impossible', { description: safeMessages.unknown });
  expect(state.rpc).not.toHaveBeenCalled();
});
