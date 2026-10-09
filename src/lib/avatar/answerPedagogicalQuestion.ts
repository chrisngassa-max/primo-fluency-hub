import type {
  ContextualAssistantAnswer,
  PedagogicalIntent,
  PedagogicalSelectors,
  PedagogicalLevel,
} from './pedagogicalTypes';

const HINT_ASK = /indice/i;

/** Transport CapTCF interne. Ni contenu client, ni mode/remise déclaré,
 * ni compteurs, ni contexte externe vers un fournisseur IA. */
export async function answerPedagogicalQuestion(
  question: string,
  selectors: PedagogicalSelectors,
  niveau: PedagogicalLevel,
  category?: 'technique',
  intent?: PedagogicalIntent | null,
): Promise<ContextualAssistantAnswer> {
  const wantsHint = intent === 'fournir_indice' || HINT_ASK.test(question);
  const base = {
    intent: (intent ?? 'expliquer') as ContextualAssistantAnswer['intent'],
    niveau,
    aiInvoked: false,
    disclaimer: 'Aide déterministe, sans IA. Les écoutes restent gérées par le lecteur.',
  };
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    // Devoir attribué : ne pas renvoyer aussi sessionId (sélecteur dérivé serveur).
    const body: Record<string, unknown> = {
      kind: 'pedagogique',
      exerciseId: selectors.exerciseId,
      itemIndex: selectors.itemIndex,
      question,
      ...(selectors.devoirId
        ? { devoirId: selectors.devoirId }
        : selectors.sessionId
        ? { sessionId: selectors.sessionId }
        : {}),
      ...(selectors.attemptId ? { attemptId: selectors.attemptId } : {}),
      ...(category ? { category } : {}),
      ...(wantsHint ? { tool: { name: 'deliver_validated_hint', args: { level: 1 } } } : {}),
    };
    const { data, error } = await supabase.functions.invoke('captcf-assistant-qa', { body });
    if (error || typeof data?.text !== 'string') throw new Error('unavailable');
    const route = data.tool?.allowed ? data.tool.route : null;
    const safeRoute = typeof route === 'string' && /^\/eleve\/(?:ma-seance|devoirs(?:\/[0-9a-f-]{36})?)$/i.test(route) ? route : null;
    const fallback = data.provider === 'faq_fallback';
    // Indice : ne jamais étiqueter FAQ locale si le serveur a répondu pédagogiquement.
    if (wantsHint && fallback) {
      return {
        ...base,
        intent: 'fournir_indice',
        text: typeof data.text === 'string' && data.text.trim()
          ? data.text
          : 'Aucun indice validé n’est disponible. Demande à ton formateur.',
        refused: true,
        uncertain: false,
        provider: 'server_context',
        visibleFallback: false,
        source: 'refuse',
        openRoute: null,
      };
    }
    return {
      ...base,
      text: data.text,
      refused: data.refused === true,
      uncertain: fallback,
      provider: fallback ? 'faq_fallback' : 'server_context',
      visibleFallback: fallback,
      source: fallback ? 'faq' : data.refused ? 'refuse' : 'contextual',
      openRoute: safeRoute,
    };
  } catch {
    if (wantsHint) {
      return {
        ...base,
        intent: 'fournir_indice',
        text: 'Aucun indice traçable n’est disponible pour cet exercice. Demande à ton formateur.',
        refused: true,
        uncertain: false,
        source: 'refuse',
        provider: 'server_context',
        visibleFallback: false,
      };
    }
    // Ne jamais retomber sur une aide construite à partir de textes client.
    return {
      ...base,
      text: 'Le contexte serveur est indisponible. Réessaie ou demande au formateur.',
      refused: true,
      uncertain: true,
      source: 'faq',
      provider: 'faq_fallback',
      visibleFallback: true,
    };
  }
}
