import type { ContextualAssistantAnswer, PedagogicalSelectors, PedagogicalLevel } from './pedagogicalTypes';

/** Transport CapTCF interne. Ni contenu client, ni mode/remise déclaré,
 * ni compteurs, ni contexte externe vers un fournisseur IA. */
export async function answerPedagogicalQuestion(question: string, selectors: PedagogicalSelectors, niveau: PedagogicalLevel, category?: 'technique'): Promise<ContextualAssistantAnswer> {
  const base = {
    intent: 'expliquer' as const, niveau, aiInvoked: false,
    disclaimer: 'Aide déterministe, sans IA. Les écoutes restent gérées par le lecteur.',
  };
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('captcf-assistant-qa', {
      body: {
        kind: 'pedagogique', exerciseId: selectors.exerciseId, itemIndex: selectors.itemIndex,
        ...(selectors.devoirId ? { devoirId: selectors.devoirId } : {}),
        ...(selectors.sessionId ? { sessionId: selectors.sessionId } : {}),
        ...(selectors.attemptId ? { attemptId: selectors.attemptId } : {}),
        question, ...(category ? { category } : {}),
      },
    });
    if (error || typeof data?.text !== 'string') throw new Error('unavailable');
    const route = data.tool?.allowed ? data.tool.route : null;
    const safeRoute = typeof route === 'string' && /^\/eleve\/(?:ma-seance|devoirs(?:\/[0-9a-f-]{36})?)$/i.test(route) ? route : null;
    const fallback = data.provider === 'faq_fallback';
    return {
      ...base, text: data.text, refused: data.refused === true, uncertain: fallback,
      provider: fallback ? 'faq_fallback' : 'server_context', visibleFallback: fallback,
      source: fallback ? 'faq' : data.refused ? 'refuse' : 'contextual', openRoute: safeRoute,
    };
  } catch {
    // Ne jamais retomber sur une aide construite à partir de textes client.
    return { ...base, text: 'Le contexte serveur est indisponible. Réessaie ou demande au formateur.', refused: true, uncertain: true, source: 'faq', provider: 'faq_fallback', visibleFallback: true };
  }
}
