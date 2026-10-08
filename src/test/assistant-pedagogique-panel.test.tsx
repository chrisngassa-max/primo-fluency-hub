import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import AvatarAssistantPanel from '@/components/eleve/AvatarAssistantPanel';
const { invoke, context } = vi.hoisted(() => ({
  invoke: vi.fn(),
  context: { niveau: 'A1', sessionCode: 'S01', exerciceTitre: 'Louise', pedagogical: {
    exerciseId: '62b06150-7942-4c41-bab9-fdba0a4d852c', sessionId: '20000000-0000-4000-8000-000000000001', itemIndex: 0,
  } },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '10000000-0000-4000-8000-000000000001' } }) }));
vi.mock('@/contexts/AidePedagogiqueContext', () => ({ useAidePedagogique: () => ({ context, setAideContext: vi.fn(), resetAideContext: vi.fn() }) }));
let container: HTMLDivElement;
let root: Root;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.clearAllMocks(); });
async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(button => (button.getAttribute('aria-label') || button.textContent) === label);
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}
async function open(text: string, refused = false, fallback = false) {
  invoke.mockResolvedValue({ data: { text, refused, provider: fallback ? 'faq_fallback' : 'server_context', visibleFallback: fallback, aiInvoked: false, realAiBlocked: true, tool: null }, error: null });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><AvatarAssistantPanel /></MemoryRouter>));
  await click('Ouvrir l’assistant CapTCF');
}
async function ask(question: string) {
  const input = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, question);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Poser la question');
}
describe('Lot 2A : panneau branché sur les décisions serveur', () => {
  it('affiche la consigne simplifiée et envoie seulement les sélecteurs', async () => {
    await open('Lis la question puis choisis une réponse.'); await ask('Explique la consigne plus simplement');
    expect(container.textContent).toContain('Lis la question puis choisis une réponse.');
    expect(invoke).toHaveBeenCalledWith('captcf-assistant-qa', { body: { kind: 'pedagogique', ...context.pedagogical, question: 'Explique la consigne plus simplement' } });
  });
  it('affiche le refus et le fallback sans remplacer par une réponse locale', async () => {
    await open('Contexte non vérifiable.', true, true); await ask('Pourquoi ma réponse est-elle fausse ?');
    expect(container.textContent).toContain('Contexte non vérifiable.');
    expect(container.textContent).toContain('FAQ locale — provider=faq_fallback');
  });
  it('affiche une explication libérée', async () => {
    await open('Explication validée après remise.'); await ask('Pourquoi ma réponse est-elle fausse ?');
    expect(container.textContent).toContain('Explication validée après remise.');
  });
  it('propose une action explicite pour le professeur', async () => {
    await open('Ta demande d’aide a été transmise au formateur.');
    await click('Demander au professeur');
    expect(container.textContent).toContain('Ta demande d’aide a été transmise au formateur.');
    expect(invoke.mock.calls[0][1].body.question).toBe('J’ai besoin du professeur');
  });
  it('affiche le motif pédagogique précis : aucun indice validé', async () => {
    await open('Aucun indice validé n’est disponible pour cet exercice.', true);
    await ask('Donne-moi un indice');
    expect(container.textContent).toContain('Aucun indice validé n’est disponible pour cet exercice.');
    expect(container.textContent).not.toContain('Le contexte serveur est indisponible');
  });
  it('affiche le motif pédagogique précis : explication après remise', async () => {
    await open('L’explication est disponible seulement après remise et libération de la correction, hors évaluation.', true);
    await ask('Pourquoi ma réponse est-elle fausse ?');
    expect(container.textContent).toContain('après remise et libération');
    expect(container.textContent).not.toContain('Le contexte serveur est indisponible');
  });
  it('affiche le refus spécifique à l’évaluation', async () => {
    await open('Les indices sont interdits pendant une évaluation.', true);
    await ask('Donne-moi un indice');
    expect(container.textContent).toContain('évaluation');
  });
  it('Lot 4 : propose Indice seulement pour un exercice banque validée', async () => {
    await open('Lis la question.');
    const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toContain('Indice');
  });
  it('Lot 4 : n’affiche pas Indice sans aide validée pour l’exercice', async () => {
    context.pedagogical = {
      exerciseId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0101',
      sessionId: '20000000-0000-4000-8000-000000000001',
      itemIndex: 0,
    };
    await open('Pas de banque.');
    const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).not.toContain('Indice');
    expect(labels).toContain('Expliquer');
    // restore Louise context for later isolation
    context.pedagogical = {
      exerciseId: '62b06150-7942-4c41-bab9-fdba0a4d852c',
      sessionId: '20000000-0000-4000-8000-000000000001',
      itemIndex: 0,
    };
  });
});
