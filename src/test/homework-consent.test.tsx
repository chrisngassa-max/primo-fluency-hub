import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeworkConsentProvider, withHomeworkConsent } from '@/contexts/HomeworkConsentContext';
import WrittenHomeworkRoute from '@/components/WrittenHomeworkRoute';
import DevoirPassation from '@/pages/eleve/DevoirPassation';
import { consentCapabilities, consentTimestamps, isDeterministicWrittenHomework } from '@/lib/homeworkConsent';

const state = vi.hoisted(() => ({ consent: null as any, exercise: null as any, invoke: vi.fn() }));
vi.mock('@/hooks/useAIConsent', () => ({ useAIConsent: () => ({ consent: state.consent, loading: false,
  isFullyGranted: !!state.consent?.consent_ai && !!state.consent?.consent_biometric && !state.consent?.revoked_at,
  hasAnswered: !!state.consent, refresh: vi.fn(), accept: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'student' } }) }));
vi.mock('@/components/AIConsentModal', () => ({ default: () => <p>Consentement requis</p> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: (...args: any[]) => state.invoke(...args) },
  from: (table: string) => {
    // Remote P0 schema exposes both devoirs_exercice_id_fkey and
    // p0_homework_executable_fk: PostgREST rejects an unqualified embed.
    let ambiguous = false;
    const q: any = { select: (fields = '') => {
      ambiguous = table === 'devoirs' && /\bexercices\s*\(/.test(fields);
      return q;
    }, eq: () => q, in: () => q, order: () => q, limit: () => q,
      single: () => q, maybeSingle: () => q, insert: () => q,
      then: (resolve: any) => Promise.resolve(ambiguous
        ? { data: null, error: { code: 'PGRST201', message: 'Multiple relationships between devoirs and exercices', status: 300 } }
        : { error: null, data: table === 'devoirs'
        ? { id: 'homework', eleve_id: 'student', statut: 'en_attente', exercice: state.exercise }
        : table === 'profiles' ? { nom: 'Test', prenom: 'E2E' } : null }).then(resolve) };
    return q;
  },
} }));
vi.mock('@/hooks/useLiveAttemptSync', () => ({ useLiveAttemptSync: () => ({}) }));
vi.mock('@/hooks/usePedagogicalHelpContext', () => ({ usePedagogicalHelpContext: () => {} }));
vi.mock('@/lib/liveEventEmitter', () => ({ emitLiveEvent: vi.fn() }));
vi.mock('@/lib/updateProfilEleve', () => ({ updateProfilEleve: vi.fn() }));
vi.mock('@/lib/exerciseVariant', () => ({ resolveStudentExerciseLevel: async () => 'standard',
  applyExerciseVariant: (ex: any) => ({ consigne: ex.consigne, contenu: ex.contenu }) }));
vi.mock('@/lib/offlineExercise', () => ({ exerciseDraftKey: () => 'draft', loadExerciseDraft: async () => null,
  saveExerciseDraft: vi.fn(), deleteExerciseDraft: vi.fn(), queueSubmission: vi.fn() }));
vi.mock('@/components/eleve/InterventionPlayer', () => ({ default: () => <p>Audio intervention</p> }));
vi.mock('@/components/eleve/LearnerAccessibilityToolbar', () => ({ default: () => null }));
vi.mock('@/components/ui/TTSAudioPlayer', () => ({ default: () => <button>TTS protégé</button> }));
vi.mock('@/components/SmartText', () => ({ default: ({ text }: any) => <span>{text}</span> }));
vi.mock('@/components/SmartTextHint', () => ({ default: () => <span>Aide IA</span> }));
vi.mock('@/components/TranslatedInstruction', () => ({ default: () => <span>Traduction IA</span> }));
vi.mock('@/components/RegenerateItemButton', () => ({ default: () => <button>Générer IA</button> }));
vi.mock('@/components/ReportProblemButton', () => ({ default: () => null }));

let root: Root; let host: HTMLDivElement; let client: QueryClient;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  state.consent = null;
  state.exercise = { id: 'exercise', titre: 'Devoir écrit', consigne: 'Lis et choisis.', competence: 'CE', format: 'qcm', niveau_vise: 'A2',
    contenu: { texte: 'La mairie ouvre le mardi matin pour recevoir les habitants.', items: [{ question: 'Quel jour ?', options: ['Mardi', 'Lundi'], bonne_reponse: 'Mardi' }] } };
  state.invoke.mockReset().mockResolvedValue({ data: { score: 100, correction_detaillee: [], ai_failed: false }, error: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); });
async function render(children: React.ReactNode) {
  await act(async () => {
    root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/eleve/devoirs/homework']}>
      <HomeworkConsentProvider><Routes><Route path='/eleve/devoirs/:devoirId' element={children} />
        <Route path='/eleve/acces-limite' element={<p>Accès limité</p>} /></Routes></HomeworkConsentProvider>
    </MemoryRouter></QueryClientProvider>);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
}

describe('Accès écrit et protections ciblées', () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])('IA=%s voix=%s : écrit accessible, capacités séparées', async (ai, voice) => {
    state.consent = { consent_ai: ai, consent_biometric: voice, revoked_at: null };
    const AI = withHomeworkConsent(() => <b>Aide IA autorisée</b>, 'ai');
    const Voice = withHomeworkConsent(() => <b>Voix autorisée</b>, 'voice');
    await render(<WrittenHomeworkRoute><p>Devoir disponible</p><AI /><Voice /></WrittenHomeworkRoute>);
    expect(host.textContent).toContain('Devoir disponible');
    expect(host.textContent?.includes('Aide IA autorisée')).toBe(ai);
    expect(host.textContent?.includes('Voix autorisée')).toBe(voice);
  });
  it.each(['ai', 'voice'] as const)('révocation %s : écrit maintenu, capacité retirée', async capability => {
    state.consent = { consent_ai: true, consent_biometric: true, revoked_at: null };
    const Capability = withHomeworkConsent(() => <b>Capacité active</b>, capability);
    await render(<WrittenHomeworkRoute><p>Devoir disponible</p><Capability /></WrittenHomeworkRoute>);
    expect(host.textContent).toContain('Capacité active');
    state.consent = { ...state.consent, [capability === 'ai' ? 'consent_ai' : 'consent_biometric']: false };
    await render(<WrittenHomeworkRoute><p>Devoir disponible</p><Capability /></WrittenHomeworkRoute>);
    expect(host.textContent).toContain('Devoir disponible');
    expect(host.textContent).not.toContain('Capacité active');
  });
  it('une production libre reste protégée avant montage', async () => {
    state.exercise.competence = 'EE'; state.exercise.format = 'production_ecrite';
    await render(<WrittenHomeworkRoute><p>Production libre</p></WrittenHomeworkRoute>);
    expect(host.textContent).toContain('Consentement requis'); expect(host.textContent).not.toContain('Production libre');
  });
  it('refuse les formats inconnus et les réponses modèle sans options', () => {
    expect(isDeterministicWrittenHomework({ ...state.exercise, format: 'nouveau' })).toBe(false);
    state.exercise.contenu.items = [{ bonne_reponse: "L’apprenant doit expliquer son avis." }];
    expect(isDeterministicWrittenHomework(state.exercise)).toBe(false);
  });
  it('consentement partiel nouveau et ancienne révocation globale restent distincts', () => {
    expect(consentTimestamps(true, false, 'now').revoked_at).toBeNull();
    expect(consentTimestamps(false, true, 'now').revoked_at).toBeNull();
    expect(consentTimestamps(false, false, 'now').revoked_at).toBe('now');
    expect(consentCapabilities({ consent_ai: true, consent_biometric: true, revoked_at: 'old' })).toEqual({ ai: false, voice: false });
  });
  it('remise du composant réel sans IA : un appel de remise, aucun bilan ni TTS', async () => {
    await render(<WrittenHomeworkRoute><DevoirPassation /></WrittenHomeworkRoute>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(host.textContent).toContain('Quel jour ?');
    expect(host.textContent).not.toMatch(/Aide IA|Traduction IA|Générer IA|TTS protégé|Audio intervention/);
    const option = [...host.querySelectorAll('[role=button]')].find(el => el.textContent?.includes('Mardi')) as HTMLElement;
    await act(async () => option.click());
    const send = [...host.querySelectorAll('button')].find(el => /soumettre|envoyer|terminer|valider/i.test(el.textContent ?? ''))!;
    expect(send).toBeDefined();
    await act(async () => send.click());
    expect(state.invoke.mock.calls.map(call => call[0])).toEqual(['submit-devoir-result']);
    expect(state.invoke.mock.calls[0][1].body).toMatchObject({ devoir_id: 'homework', answers: { 0: 'Mardi' } });
  });
  it('TTS réel imbriqué : IA seule ne donne pas accès au lecteur audio', async () => {
    state.consent = { consent_ai: true, consent_biometric: false, revoked_at: null };
    const { default: TTS } = await vi.importActual<typeof import('@/components/ui/TTSAudioPlayer')>('@/components/ui/TTSAudioPlayer');
    await render(<TTS text='Lecture test' />);
    expect(host.querySelector('button')).toBeNull();
    expect(state.invoke).not.toHaveBeenCalled();
  });
  it('avec accords : bilan en échec mais remise et résultat conservés', async () => {
    state.consent = { consent_ai: true, consent_biometric: true, revoked_at: null };
    state.invoke.mockImplementation(async (name: string) => name === 'generate-post-devoir-bilan'
      ? { data: null, error: new Error('Bilan indisponible') }
      : { data: { score: 100, correction_detaillee: [], ai_failed: false }, error: null });
    await render(<WrittenHomeworkRoute><DevoirPassation /></WrittenHomeworkRoute>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    const option = [...host.querySelectorAll('[role=button]')].find(el => el.textContent?.includes('Mardi')) as HTMLElement;
    await act(async () => option.click());
    const send = [...host.querySelectorAll('button')].find(el => /soumettre|envoyer|terminer|valider/i.test(el.textContent ?? ''))!;
    await act(async () => send.click());
    expect(state.invoke.mock.calls.map(call => call[0])).toEqual(['submit-devoir-result', 'generate-post-devoir-bilan']);
    expect(host.querySelector('[role=button][aria-pressed]')).toBeNull();
    expect(host.textContent).toMatch(/résultat|réussi|correction|terminé/i);
  });
});
